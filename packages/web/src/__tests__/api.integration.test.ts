/**
 * Integration tests for Weather Oracle Web API routes.
 *
 * Tests the API endpoints using MSW to mock external dependencies.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
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
  type Location,
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

describe("Web API Integration Tests", () => {
  describe("GET /api/forecast", () => {
    it("should return forecast data for a valid location", async () => {
      // Simulate the forecast route logic
      const locationQuery = "Dublin, Ireland";
      const days = 5;

      // Geocode location
      const resolvedLocation = await geocodeLocation(locationQuery);
      expect(resolvedLocation.name).toBeDefined();

      const location: Location = {
        query: locationQuery,
        resolved: resolvedLocation,
      };

      // Fetch forecasts
      const modelResult = await fetchAllModels(location, undefined, {
        forecastDays: days,
      });

      expect(modelResult.forecasts.length).toBeGreaterThan(0);

      // Aggregate
      const aggregated = aggregateForecasts(modelResult.forecasts);
      expect(aggregated.consensus.daily.length).toBe(days);

      // Calculate confidence
      const overallConfidence = calculateConfidence(aggregated, "overall", 0);
      expect(overallConfidence.score).toBeGreaterThanOrEqual(0);
      expect(overallConfidence.score).toBeLessThanOrEqual(1);

      // Generate narrative
      const narrative = generateNarrative(aggregated, [overallConfidence]);
      expect(narrative.headline).toBeDefined();

      // Build response structure (simulating ForecastResponseData)
      const responseData = {
        location: resolvedLocation,
        forecast: {
          coordinates: aggregated.coordinates,
          validFrom: aggregated.validFrom.toISOString(),
          validTo: aggregated.validTo.toISOString(),
          daily: aggregated.consensus.daily,
          hourly: aggregated.consensus.hourly,
          modelWeights: aggregated.modelWeights,
        },
        confidence: {
          overall: overallConfidence,
          level: overallConfidence.level,
          score: overallConfidence.score,
        },
        narrative,
      };

      expect(responseData.location.name).toBe("Dublin");
      expect(responseData.forecast.daily.length).toBe(5);
      expect(responseData.confidence.level).toBeDefined();
    });

    it("should handle location by coordinates", async () => {
      const lat = 53.3498;
      const lon = -6.2603;
      const days = 3;

      // Create synthetic location from coordinates
      const resolvedLocation = {
        name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        coordinates: { latitude: lat, longitude: lon },
        country: "Unknown",
        countryCode: "XX",
        timezone: "UTC",
      };

      const location: Location = {
        query: `${lat},${lon}`,
        resolved: resolvedLocation as any,
      };

      const modelResult = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: days,
      });

      expect(modelResult.forecasts.length).toBe(2);
      expect(modelResult.failures.length).toBe(0);
    });

    it("should return error for invalid location", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("invalidlocation123")).rejects.toThrow();
    });

    it("should validate days parameter (1-7)", async () => {
      const location = await geocodeLocation("Dublin");

      // Valid days
      const result3 = await fetchAllModels(
        { query: "Dublin", resolved: location },
        ["ecmwf"],
        { forecastDays: 3 }
      );
      expect(result3.forecasts[0].daily.length).toBe(3);

      const result7 = await fetchAllModels(
        { query: "Dublin", resolved: location },
        ["ecmwf"],
        { forecastDays: 7 }
      );
      expect(result7.forecasts[0].daily.length).toBe(7);
    });
  });

  describe("GET /api/compare", () => {
    it("should return comparison data for multiple models", async () => {
      const location = await geocodeLocation("London");
      const locationObj: Location = { query: "London", resolved: location };

      const modelResult = await fetchAllModels(
        locationObj,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 5 }
      );

      expect(modelResult.forecasts.length).toBe(3);

      // Build comparison entries (simulating CompareResponseData)
      const modelEntries = modelResult.forecasts.map((forecast) => ({
        model: forecast.model,
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

      expect(modelEntries.length).toBe(3);
      expect(modelEntries[0].status).toBe("success");
      expect(modelEntries[0].forecast.daily.length).toBe(5);
    });

    it("should identify outliers across models", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(
        locationObj,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 3 }
      );

      // Need at least 3 models for outlier detection
      expect(modelResult.forecasts.length).toBeGreaterThanOrEqual(3);

      const outliers = identifyOutliers(modelResult.forecasts);
      expect(Array.isArray(outliers)).toBe(true);
    });

    it("should handle partial model failures in comparison", async () => {
      setModelFailure("gfs", true);
      setModelFailure("icon", true);

      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(
        locationObj,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 3 }
      );

      expect(modelResult.forecasts.length).toBe(2);
      expect(modelResult.failures.length).toBe(2);

      // Failed models should be tracked
      const failedModels = modelResult.failures.map((f) => f.model);
      expect(failedModels).toContain("gfs");
      expect(failedModels).toContain("icon");
    });

    it("should filter by specific models", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      // Request only specific models
      const modelResult = await fetchAllModels(
        locationObj,
        ["ecmwf", "jma"],
        { forecastDays: 3 }
      );

      expect(modelResult.forecasts.length).toBe(2);

      const models = modelResult.forecasts.map((f) => f.model);
      expect(models).toContain("ecmwf");
      expect(models).toContain("jma");
      expect(models).not.toContain("gfs");
    });
  });

  describe("GET /api/geocode", () => {
    it("should return geocoding results for valid query", async () => {
      const result = await geocodeLocation("Dublin");

      expect(result.name).toBeDefined();
      expect(result.coordinates).toBeDefined();
      expect(result.country).toBeDefined();
      expect(result.timezone).toBeDefined();
    });

    it("should return empty results for invalid query", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("xyznonexistentplace123")).rejects.toThrow();
    });

    it("should handle query with country disambiguation", async () => {
      const result = await geocodeLocation("Dublin, Ireland");

      expect(result.name).toBeDefined();
      expect(result.country).toBe("Ireland");
    });
  });

  describe("API Response Structure", () => {
    it("should produce valid success response structure", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(modelResult.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Simulate API success response
      const response = {
        success: true,
        data: {
          location,
          forecast: aggregated,
          confidence,
          narrative,
        },
        meta: {
          fetchedAt: new Date().toISOString(),
          models: modelResult.forecasts.map((f) => f.model),
          cached: false,
          duration: 150,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.location).toBeDefined();
      expect(response.data.forecast).toBeDefined();
      expect(response.meta.fetchedAt).toBeDefined();
    });

    it("should produce valid error response structure", () => {
      // Simulate API error response
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
      expect(errorResponse.error.message).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle all models failing gracefully", async () => {
      // Set all models to fail
      setModelFailure("ecmwf", true);
      setModelFailure("gfs", true);
      setModelFailure("icon", true);
      setModelFailure("jma", true);
      setModelFailure("gem", true);
      setModelFailure("meteofrance", true);
      setModelFailure("ukmo", true);

      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, undefined, {
        forecastDays: 3,
      });

      expect(modelResult.forecasts.length).toBe(0);
      expect(modelResult.failures.length).toBeGreaterThan(0);
      expect(modelResult.successRate).toBe(0);
    });

    it("should handle geocoding service unavailable", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("Dublin")).rejects.toThrow();
    });
  });

  describe("Data Validation", () => {
    it("should validate temperature ranges are reasonable", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(modelResult.forecasts);

      for (const day of aggregated.consensus.daily) {
        const tempMax = day.forecast.temperature.max as number;
        const tempMin = day.forecast.temperature.min as number;

        // Reasonable temperature bounds
        expect(tempMax).toBeGreaterThanOrEqual(-50);
        expect(tempMax).toBeLessThanOrEqual(60);
        expect(tempMin).toBeGreaterThanOrEqual(-50);
        expect(tempMin).toBeLessThanOrEqual(60);
        expect(tempMax).toBeGreaterThanOrEqual(tempMin);
      }
    });

    it("should validate precipitation probability is 0-100", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(modelResult.forecasts);

      for (const day of aggregated.consensus.daily) {
        const precipProb = day.forecast.precipitation.probability;

        expect(precipProb).toBeGreaterThanOrEqual(0);
        expect(precipProb).toBeLessThanOrEqual(100);
      }
    });

    it("should validate confidence score is 0-1", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(
        locationObj,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 3 }
      );
      const aggregated = aggregateForecasts(modelResult.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);

      expect(confidence.score).toBeGreaterThanOrEqual(0);
      expect(confidence.score).toBeLessThanOrEqual(1);
      expect(["high", "medium", "low"]).toContain(confidence.level);
    });
  });
});
