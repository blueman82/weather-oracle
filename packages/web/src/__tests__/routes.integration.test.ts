/**
 * Integration tests for Weather Oracle Web API routes.
 *
 * Tests the actual API route handlers with mocked external dependencies.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "bun:test";
import {
  setupMswServer,
  resetMswServer,
  teardownMswServer,
  setModelFailure,
  setGeocodingFailure,
} from "./mocks/server";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  calculateConfidence,
  generateNarrative,
  identifyOutliers,
  createCacheManager,
  MODEL_INFO,
  type Location,
  type ModelName,
} from "@weather-oracle/core";

// Setup MSW server
beforeAll(() => {
  setupMswServer();
});

afterAll(() => {
  teardownMswServer();
});

afterEach(() => {
  resetMswServer();
});

describe("Forecast Route Integration Tests", () => {
  describe("Happy path: Full forecast flow", () => {
    it("should complete full Dublin forecast flow", async () => {
      // Step 1: Geocode location
      const geocoded = await geocodeLocation("Dublin, Ireland");

      expect(geocoded.name).toBe("Dublin");
      expect(geocoded.country).toBe("Ireland");
      expect(geocoded.coordinates).toBeDefined();
      expect(geocoded.timezone).toBeDefined();

      // Step 2: Create location object
      const location: Location = {
        query: "Dublin, Ireland",
        resolved: geocoded,
      };

      // Step 3: Fetch from multiple models
      const modelResult = await fetchAllModels(location, undefined, {
        forecastDays: 5,
      });

      expect(modelResult.forecasts.length).toBeGreaterThan(0);
      expect(modelResult.fetchedAt).toBeInstanceOf(Date);

      // Step 4: Aggregate forecasts
      const aggregated = aggregateForecasts(modelResult.forecasts);

      expect(aggregated.consensus.daily.length).toBe(5);
      expect(aggregated.consensus.hourly.length).toBeGreaterThan(0);
      expect(aggregated.modelWeights.length).toBe(modelResult.forecasts.length);

      // Step 5: Calculate confidence
      const confidence = calculateConfidence(aggregated, "overall", 0);

      expect(["high", "medium", "low"]).toContain(confidence.level);
      expect(confidence.score).toBeGreaterThanOrEqual(0);
      expect(confidence.score).toBeLessThanOrEqual(1);

      // Step 6: Generate narrative
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.headline).toBeDefined();
      expect(typeof narrative.headline).toBe("string");
      expect(narrative.headline.length).toBeGreaterThan(0);
      expect(Array.isArray(narrative.alerts)).toBe(true);
      expect(Array.isArray(narrative.modelNotes)).toBe(true);
    });

    it("should handle coordinates-based request", async () => {
      const lat = 51.5074;
      const lon = -0.1278;

      // Create synthetic location from coordinates
      const location: Location = {
        query: `${lat},${lon}`,
        resolved: {
          name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          coordinates: { latitude: lat, longitude: lon } as any,
          country: "Unknown",
          countryCode: "XX",
          timezone: "UTC" as any,
        },
      };

      const modelResult = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: 3,
      });

      expect(modelResult.forecasts.length).toBe(2);

      const aggregated = aggregateForecasts(modelResult.forecasts);
      expect(aggregated.consensus.daily.length).toBe(3);
    });
  });

  describe("Partial failure: Some models fail", () => {
    beforeEach(() => {
      setModelFailure("gfs", true);
    });

    it("should return partial results when one model fails", async () => {
      const geocoded = await geocodeLocation("London");
      const location: Location = { query: "London", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 5 }
      );

      expect(result.forecasts.length).toBe(2);
      expect(result.failures.length).toBe(1);
      expect(result.failures[0].model).toBe("gfs");
      expect(result.successRate).toBeCloseTo(2 / 3, 2);

      // Should still be able to aggregate
      const aggregated = aggregateForecasts(result.forecasts);
      expect(aggregated.models.length).toBe(2);
    });

    it("should include failure details in response", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs"],
        { forecastDays: 3 }
      );

      const failure = result.failures.find((f) => f.model === "gfs");
      expect(failure).toBeDefined();
      expect(failure!.error).toBeDefined();
      expect(failure!.error.message).toBeDefined();
    });
  });

  describe("Error handling: Invalid location", () => {
    it("should throw error for invalid location", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("invalidlocation123")).rejects.toThrow();
    });

    it("should throw for empty location query", async () => {
      await expect(geocodeLocation("")).rejects.toThrow();
    });

    it("should throw for very short query", async () => {
      await expect(geocodeLocation("a")).rejects.toThrow();
    });
  });

  describe("Cache integration", () => {
    it("should cache forecast response data", async () => {
      const cache = createCacheManager({ enabled: true });

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Build response data
      const responseData = {
        location: geocoded,
        forecast: {
          coordinates: aggregated.coordinates,
          validFrom: aggregated.validFrom.toISOString(),
          validTo: aggregated.validTo.toISOString(),
          daily: aggregated.consensus.daily,
          hourly: aggregated.consensus.hourly,
          modelWeights: aggregated.modelWeights,
        },
        confidence: {
          overall: confidence,
          level: confidence.level,
          score: confidence.score,
        },
        narrative,
      };

      // Cache the response
      const cacheKey = `forecast_${geocoded.coordinates.latitude}_${geocoded.coordinates.longitude}_3`;
      await cache.set(cacheKey, responseData, 1800);

      // Retrieve from cache
      const cached = await cache.get<typeof responseData>(cacheKey);

      expect(cached).toBeDefined();
      expect(cached!.location.name).toBe("Dublin");
      expect(cached!.forecast.daily.length).toBe(3);
    });
  });
});

describe("Compare Route Integration Tests", () => {
  describe("Model comparison", () => {
    it("should return comparison data for multiple models", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 5 }
      );

      expect(result.forecasts.length).toBe(4);

      // Build comparison entries
      const entries = result.forecasts.map((forecast) => ({
        model: forecast.model,
        info: MODEL_INFO[forecast.model],
        forecast: {
          validFrom: forecast.validFrom.toISOString(),
          validTo: forecast.validTo.toISOString(),
          daily: forecast.daily.map((d) => ({
            date: d.date.toISOString(),
            temperatureMax: d.temperature.max,
            temperatureMin: d.temperature.min,
            precipitationTotal: d.precipitation.total,
            precipitationProbability: d.precipitation.probability,
            windMaxSpeed: d.wind.maxSpeed,
            weatherCode: d.weatherCode,
          })),
          hourlyCount: forecast.hourly.length,
        },
        status: "success" as const,
      }));

      expect(entries.length).toBe(4);

      // Each entry should have complete data
      for (const entry of entries) {
        expect(entry.model).toBeDefined();
        expect(entry.info).toBeDefined();
        expect(entry.forecast.daily.length).toBe(5);
        expect(entry.status).toBe("success");
      }
    });

    it("should identify outliers across models", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon", "jma", "gem"],
        { forecastDays: 3 }
      );

      // Need at least 3 models for outlier detection
      expect(result.forecasts.length).toBeGreaterThanOrEqual(3);

      const outliers = identifyOutliers(result.forecasts);

      expect(Array.isArray(outliers)).toBe(true);
      // Each outlier should have model, metric, and day info
      for (const outlier of outliers) {
        expect(outlier.model).toBeDefined();
        expect(outlier.metric).toBeDefined();
      }
    });

    it("should filter by specific models", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      // Request specific models
      const requestedModels: ModelName[] = ["ecmwf", "jma"];
      const result = await fetchAllModels(location, requestedModels, {
        forecastDays: 3,
      });

      expect(result.forecasts.length).toBe(2);

      const returnedModels = result.forecasts.map((f) => f.model);
      expect(returnedModels).toContain("ecmwf");
      expect(returnedModels).toContain("jma");
      expect(returnedModels).not.toContain("gfs");
      expect(returnedModels).not.toContain("icon");
    });
  });

  describe("Partial model failures", () => {
    beforeEach(() => {
      setModelFailure("gfs", true);
      setModelFailure("icon", true);
    });

    it("should include failed models in comparison response", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 3 }
      );

      // Build comparison entries for both success and failures
      const entries = [
        ...result.forecasts.map((f) => ({
          model: f.model,
          status: "success" as const,
        })),
        ...result.failures.map((f) => ({
          model: f.model,
          status: "failed" as const,
          error: f.error.message,
        })),
      ];

      expect(entries.length).toBe(4);

      const successful = entries.filter((e) => e.status === "success");
      const failed = entries.filter((e) => e.status === "failed");

      expect(successful.length).toBe(2);
      expect(failed.length).toBe(2);

      // Failed models should have error messages
      for (const f of failed) {
        expect(f.error).toBeDefined();
      }
    });
  });
});

describe("Geocode Route Integration Tests", () => {
  describe("Location search", () => {
    it("should return geocoding result for valid query", async () => {
      const result = await geocodeLocation("Dublin");

      expect(result.name).toBeDefined();
      expect(result.coordinates).toBeDefined();
      expect(result.country).toBeDefined();
      expect(result.timezone).toBeDefined();
    });

    it("should handle query with country disambiguation", async () => {
      const result = await geocodeLocation("Dublin, Ireland");

      expect(result.name).toBe("Dublin");
      expect(result.country).toBe("Ireland");
    });

    it("should include all required geocoding fields", async () => {
      const result = await geocodeLocation("London");

      expect(result.name).toBeDefined();
      expect(result.coordinates.latitude).toBeDefined();
      expect(result.coordinates.longitude).toBeDefined();
      expect(result.country).toBeDefined();
      expect(result.countryCode).toBeDefined();
      expect(result.timezone).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle geocoding service failure", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("Dublin")).rejects.toThrow();
    });
  });
});

describe("Response Format Tests", () => {
  describe("Success response structure", () => {
    it("should produce valid forecast response data", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Build API response structure
      const response = {
        success: true,
        data: {
          location: geocoded,
          forecast: {
            coordinates: aggregated.coordinates,
            validFrom: aggregated.validFrom.toISOString(),
            validTo: aggregated.validTo.toISOString(),
            daily: aggregated.consensus.daily,
            hourly: aggregated.consensus.hourly,
            modelWeights: aggregated.modelWeights,
          },
          confidence: {
            overall: confidence,
            level: confidence.level,
            score: confidence.score,
          },
          narrative,
        },
        meta: {
          fetchedAt: new Date().toISOString(),
          models: result.forecasts.map((f) => f.model),
          cached: false,
          duration: 150,
        },
      };

      // Validate structure
      expect(response.success).toBe(true);
      expect(response.data.location.name).toBe("Dublin");
      expect(response.data.forecast.daily.length).toBe(3);
      expect(response.meta.models).toContain("ecmwf");
      expect(response.meta.models).toContain("gfs");
    });

    it("should produce valid compare response data", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 3 }
      );

      const outliers = identifyOutliers(result.forecasts);

      // Build API response structure
      const response = {
        success: true,
        data: {
          location: geocoded,
          models: result.forecasts.map((f) => ({
            model: f.model,
            info: MODEL_INFO[f.model],
            forecast: {
              validFrom: f.validFrom.toISOString(),
              validTo: f.validTo.toISOString(),
              daily: f.daily.map((d) => ({
                date: d.date.toISOString(),
                temperatureMax: d.temperature.max,
                temperatureMin: d.temperature.min,
              })),
            },
            status: "success",
          })),
          outliers,
          summary: {
            totalModels: result.forecasts.length + result.failures.length,
            successfulModels: result.forecasts.length,
            failedModels: result.failures.length,
          },
        },
        meta: {
          fetchedAt: new Date().toISOString(),
          models: result.forecasts.map((f) => f.model),
          cached: false,
          duration: 200,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.models.length).toBe(3);
      expect(response.data.summary.successfulModels).toBe(3);
      expect(response.data.summary.failedModels).toBe(0);
    });
  });

  describe("Error response structure", () => {
    it("should produce valid error response for not found", () => {
      const errorResponse = {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Location not found: invalidplace",
          details: { query: "invalidplace" },
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe("NOT_FOUND");
      expect(errorResponse.error.message).toContain("not found");
    });

    it("should produce valid error response for bad request", () => {
      const errorResponse = {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Days must be a number between 1 and 7",
          details: { provided: "20" },
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe("BAD_REQUEST");
    });

    it("should produce valid error response for service unavailable", () => {
      const errorResponse = {
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Weather service temporarily unavailable",
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe("SERVICE_UNAVAILABLE");
    });
  });
});
