/**
 * Integration tests for Weather Oracle CLI.
 *
 * Tests the complete flow from location input to forecast output
 * using MSW to mock the Open-Meteo API.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "bun:test";
import {
  setupMswServer,
  resetMswServer,
  teardownMswServer,
  setModelFailure,
  setGeocodingFailure,
  getRequestLog,
  clearRequestLog,
} from "./mocks/server";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  calculateConfidence,
  generateNarrative,
  createCacheManager,
  type Location,
  type MultiModelResult,
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

describe("CLI Integration Tests", () => {
  describe("Happy Path: Dublin forecast flow", () => {
    it("should geocode Dublin and fetch forecast successfully", async () => {
      // Step 1: Geocode location
      const geocoded = await geocodeLocation("Dublin, Ireland");

      expect(geocoded.name).toBe("Dublin");
      expect(geocoded.country).toBe("Ireland");
      expect(geocoded.coordinates.latitude).toBeCloseTo(53.35, 1);
      expect(geocoded.coordinates.longitude).toBeCloseTo(-6.26, 1);

      // Step 2: Create location object
      const location: Location = {
        query: "Dublin, Ireland",
        resolved: geocoded,
      };

      // Step 3: Fetch forecasts from all models
      const result = await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 5,
      });

      expect(result.forecasts.length).toBe(3);
      expect(result.failures.length).toBe(0);
      expect(result.successRate).toBe(1);

      // Step 4: Aggregate forecasts
      const aggregated = aggregateForecasts(result.forecasts);

      expect(aggregated.models.length).toBe(3);
      expect(aggregated.consensus.daily.length).toBe(5);
      expect(aggregated.consensus.hourly.length).toBeGreaterThan(0);

      // Step 5: Calculate confidence
      const confidence = calculateConfidence(aggregated, "overall", 0);

      expect(confidence.level).toBeDefined();
      expect(confidence.score).toBeGreaterThanOrEqual(0);
      expect(confidence.score).toBeLessThanOrEqual(1);

      // Step 6: Generate narrative
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.headline).toBeDefined();
      expect(typeof narrative.headline).toBe("string");
      expect(narrative.headline.length).toBeGreaterThan(0);
    });

    it("should include temperature and precipitation in aggregated forecast", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);

      const firstDay = aggregated.consensus.daily[0];
      expect(firstDay).toBeDefined();
      expect(firstDay.forecast.temperature.min).toBeDefined();
      expect(firstDay.forecast.temperature.max).toBeDefined();
      expect(firstDay.forecast.precipitation.probability).toBeDefined();
      expect(firstDay.forecast.wind.maxSpeed).toBeDefined();
    });
  });

  describe("Partial Failure: Some models fail", () => {
    beforeEach(() => {
      // Configure GFS to fail
      setModelFailure("gfs", true);
    });

    it("should handle partial model failures gracefully", async () => {
      const geocoded = await geocodeLocation("London");
      const location: Location = { query: "London", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 5 }
      );

      // Should have 2 successful forecasts, 1 failure
      expect(result.forecasts.length).toBe(2);
      expect(result.failures.length).toBe(1);
      expect(result.failures[0].model).toBe("gfs");

      // Should still be able to aggregate
      const aggregated = aggregateForecasts(result.forecasts);
      expect(aggregated.models.length).toBe(2);
      expect(aggregated.consensus.daily.length).toBeGreaterThan(0);
    });

    it("should continue with remaining models when one fails", async () => {
      // Configure multiple models to fail
      setModelFailure("icon", true);

      const geocoded = await geocodeLocation("Tokyo");
      const location: Location = { query: "Tokyo", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 5 }
      );

      // Should have 2 successful forecasts (ecmwf, jma), 2 failures (gfs, icon)
      expect(result.forecasts.length).toBe(2);
      expect(result.failures.length).toBe(2);

      // Verify which models succeeded
      const successfulModels = result.forecasts.map((f) => f.model);
      expect(successfulModels).toContain("ecmwf");
      expect(successfulModels).toContain("jma");
    });
  });

  describe("Cache Hit: Second request uses cache", () => {
    it("should cache forecast data for subsequent requests", async () => {
      const cache = createCacheManager({ enabled: true });
      const cacheKey = "test_dublin_forecast";

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      // First request - should hit API
      clearRequestLog();
      const result1 = await fetchAllModels(location, ["ecmwf"], {
        forecastDays: 3,
      });

      const requestsAfterFirst = getRequestLog().length;
      expect(requestsAfterFirst).toBeGreaterThan(0);

      // Store in cache
      await cache.set(cacheKey, result1, 3600);

      // Second request - should use cache
      clearRequestLog();
      const cachedResult = await cache.get<MultiModelResult>(cacheKey);

      // Should not have made new API requests
      expect(getRequestLog().length).toBe(0);
      expect(cachedResult).toBeDefined();
      expect(cachedResult!.forecasts.length).toBe(result1.forecasts.length);
    });

    it("should return cached data when available", async () => {
      const cache = createCacheManager({ enabled: true });

      // Store mock data in cache
      const mockCacheData = {
        forecasts: [{ model: "ecmwf", cached: true }],
        failures: [],
        fetchedAt: new Date(),
      };

      await cache.set("test_cache_key", mockCacheData, 3600);

      // Retrieve from cache
      const cached = await cache.get<typeof mockCacheData>("test_cache_key");

      expect(cached).toBeDefined();
      expect(cached!.forecasts[0].cached).toBe(true);
    });
  });

  describe("Error Handling: Invalid location", () => {
    it("should throw error for invalid location", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("invalidxyzlocation123")).rejects.toThrow();
    });

    it("should return empty results for nonexistent location", async () => {
      // The mock returns empty results for queries containing "invalid" or "nonexistent"
      await expect(geocodeLocation("nonexistent place xyz")).rejects.toThrow();
    });

    it("should handle empty location query", async () => {
      await expect(geocodeLocation("")).rejects.toThrow();
    });

    it("should handle very short location query", async () => {
      await expect(geocodeLocation("a")).rejects.toThrow();
    });
  });

  describe("Format Switching: JSON output", () => {
    it("should produce valid JSON structure from aggregated data", async () => {
      const geocoded = await geocodeLocation("New York");
      const location: Location = { query: "New York", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Create JSON output structure (simulating --format json)
      const jsonOutput = {
        location: {
          name: geocoded.name,
          country: geocoded.country,
          coordinates: geocoded.coordinates,
        },
        forecast: {
          daily: aggregated.consensus.daily.map((d) => ({
            date: d.date.toISOString(),
            temperature: d.forecast.temperature,
            precipitation: d.forecast.precipitation,
            wind: d.forecast.wind,
          })),
          models: aggregated.models,
        },
        confidence: {
          level: confidence.level,
          score: confidence.score,
        },
        narrative: {
          headline: narrative.headline,
          body: narrative.body,
          alerts: narrative.alerts,
        },
      };

      // Verify it's valid JSON by serializing and parsing
      const jsonString = JSON.stringify(jsonOutput);
      const parsed = JSON.parse(jsonString);

      // Location name should contain "new" (from "New York")
      expect(parsed.location.name.toLowerCase()).toContain("new");
      expect(parsed.forecast.daily.length).toBe(3);
      expect(parsed.confidence.level).toBeDefined();
      expect(parsed.narrative.headline).toBeDefined();
    });

    it("should include all required fields in JSON output", async () => {
      const geocoded = await geocodeLocation("Tokyo");
      const location: Location = { query: "Tokyo", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf"], {
        forecastDays: 1,
      });
      const aggregated = aggregateForecasts(result.forecasts);

      // Verify daily forecast structure
      const daily = aggregated.consensus.daily[0];
      expect(daily.date).toBeInstanceOf(Date);
      expect(daily.forecast.temperature).toHaveProperty("min");
      expect(daily.forecast.temperature).toHaveProperty("max");
      expect(daily.forecast.precipitation).toHaveProperty("probability");
      expect(daily.forecast.precipitation).toHaveProperty("total");
      expect(daily.forecast.wind).toHaveProperty("maxSpeed");
    });
  });

  describe("API Request Verification", () => {
    it("should make requests to all specified models", async () => {
      clearRequestLog();

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 5,
      });

      const requests = getRequestLog();

      // Should have 1 geocoding request + 3 model requests
      expect(requests.length).toBe(4);

      // Verify model endpoints were called
      const urls = requests.map((r) => r.url);
      expect(urls.some((u) => u.includes("ecmwf"))).toBe(true);
      expect(urls.some((u) => u.includes("gfs"))).toBe(true);
      expect(urls.some((u) => u.includes("dwd-icon"))).toBe(true);
    });

    it("should include correct query parameters", async () => {
      clearRequestLog();

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      await fetchAllModels(location, ["ecmwf"], {
        forecastDays: 7,
      });

      const requests = getRequestLog();
      const ecmwfRequest = requests.find((r) => r.url.includes("ecmwf"));

      expect(ecmwfRequest).toBeDefined();
      expect(ecmwfRequest!.url).toContain("latitude=53.3498");
      expect(ecmwfRequest!.url).toContain("longitude=-6.2603");
      expect(ecmwfRequest!.url).toContain("forecast_days=7");
    });
  });

  describe("Model Weights and Aggregation", () => {
    it("should assign weights to all contributing models", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);

      expect(aggregated.modelWeights.length).toBe(3);

      // Verify each model has a weight
      for (const weight of aggregated.modelWeights) {
        expect(weight.weight).toBeGreaterThan(0);
        expect(weight.weight).toBeLessThanOrEqual(1);
      }

      // Weights should sum to approximately 1
      const totalWeight = aggregated.modelWeights.reduce((sum, w) => sum + w.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 1);
    });

    it("should produce consensus from multiple models", async () => {
      const geocoded = await geocodeLocation("London");
      const location: Location = { query: "London", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);

      // Consensus should average out model variations
      const firstDay = aggregated.consensus.daily[0];

      // Temperature should be reasonable (Dublin/London area)
      const tempMax = firstDay.forecast.temperature.max as number;
      const tempMin = firstDay.forecast.temperature.min as number;

      expect(tempMax).toBeGreaterThan(tempMin);
      expect(tempMax).toBeLessThan(40); // Reasonable upper bound
      expect(tempMin).toBeGreaterThan(-20); // Reasonable lower bound
    });
  });
});
