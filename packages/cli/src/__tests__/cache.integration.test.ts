/**
 * Cache integration tests for Weather Oracle CLI.
 *
 * Tests caching behavior and cache invalidation.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import {
  setupMswServer,
  resetMswServer,
  teardownMswServer,
  clearRequestLog,
  getRequestLog,
} from "./mocks/server";
import {
  geocodeLocation,
  fetchAllModels,
  createCacheManager,
  createForecastCacheKey,
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

describe("Cache Integration Tests", () => {
  describe("Cache key generation", () => {
    it("should generate consistent cache keys for same coordinates", () => {
      const now = new Date();
      const key1 = createForecastCacheKey(53.3498, -6.2603, "ecmwf,gfs", now);
      const key2 = createForecastCacheKey(53.3498, -6.2603, "ecmwf,gfs", now);

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different coordinates", () => {
      const now = new Date();
      const dublinKey = createForecastCacheKey(53.3498, -6.2603, "ecmwf", now);
      const londonKey = createForecastCacheKey(51.5074, -0.1278, "ecmwf", now);

      expect(dublinKey).not.toBe(londonKey);
    });

    it("should generate different keys for different models", () => {
      const now = new Date();
      const key1 = createForecastCacheKey(53.3498, -6.2603, "ecmwf", now);
      const key2 = createForecastCacheKey(53.3498, -6.2603, "ecmwf,gfs", now);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different dates", () => {
      const date1 = new Date("2024-06-15");
      const date2 = new Date("2024-06-16");

      const key1 = createForecastCacheKey(53.3498, -6.2603, "ecmwf", date1);
      const key2 = createForecastCacheKey(53.3498, -6.2603, "ecmwf", date2);

      expect(key1).not.toBe(key2);
    });
  });

  describe("Cache hit/miss behavior", () => {
    it("should cache and retrieve forecast data", async () => {
      const cache = createCacheManager({ enabled: true });
      const cacheKey = "test_cache_forecast";

      // Store data
      const testData = {
        forecasts: [{ model: "ecmwf", test: true }],
        fetchedAt: new Date(),
      };
      await cache.set(cacheKey, testData, 3600);

      // Retrieve data
      const cached = await cache.get(cacheKey);

      expect(cached).toBeDefined();
      expect(cached.forecasts[0].model).toBe("ecmwf");
      expect(cached.forecasts[0].test).toBe(true);
    });

    it("should return undefined for expired cache", async () => {
      const cache = createCacheManager({ enabled: true });
      const cacheKey = "test_expired_cache";

      // Store with 0 TTL (immediate expiration)
      await cache.set(cacheKey, { test: true }, 0);

      // Small delay to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cached = await cache.get(cacheKey);

      // Should be undefined or null since it expired
      expect(cached === undefined || cached === null).toBe(true);
    });

    it("should not make API requests when cache is hit", async () => {
      const cache = createCacheManager({ enabled: true });

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
      const cacheKey = `test_dublin_${Date.now()}`;
      await cache.set(cacheKey, result1, 3600);

      // Verify cache hit returns data without API calls
      clearRequestLog();
      const cachedData = await cache.get(cacheKey);

      expect(getRequestLog().length).toBe(0); // No new requests
      expect(cachedData).toBeDefined();
      expect(cachedData.forecasts.length).toBe(result1.forecasts.length);
    });
  });

  describe("Cache disabled behavior", () => {
    it("should not cache when disabled", async () => {
      const cache = createCacheManager({ enabled: false });
      const cacheKey = "test_disabled_cache";

      await cache.set(cacheKey, { test: true }, 3600);
      const cached = await cache.get(cacheKey);

      // Returns null when cache is disabled or key not found
      expect(cached).toBeNull();
    });

    it("should always fetch fresh data when cache disabled", async () => {
      const geocoded = await geocodeLocation("London");
      const location: Location = { query: "London", resolved: geocoded };

      // First request
      clearRequestLog();
      await fetchAllModels(location, ["ecmwf"], { forecastDays: 3 });
      const firstRequestCount = getRequestLog().length;

      // Second request (without caching, should hit API again)
      clearRequestLog();
      await fetchAllModels(location, ["ecmwf"], { forecastDays: 3 });
      const secondRequestCount = getRequestLog().length;

      // Both should make API requests
      expect(firstRequestCount).toBeGreaterThan(0);
      expect(secondRequestCount).toBeGreaterThan(0);
    });
  });

  describe("Cache statistics", () => {
    it("should track cache operations", async () => {
      const cache = createCacheManager({ enabled: true });

      // Store and retrieve
      await cache.set("stats_test_1", { value: 1 }, 3600);
      await cache.set("stats_test_2", { value: 2 }, 3600);

      await cache.get("stats_test_1"); // hit
      await cache.get("stats_test_3"); // miss

      // stats() is an async method returning CacheStats
      const stats = await cache.stats();

      expect(stats).toBeDefined();
      expect(typeof stats.hits).toBe("number");
      expect(typeof stats.misses).toBe("number");
    });

    it("should clear cache", async () => {
      const cache = createCacheManager({ enabled: true });

      await cache.set("clear_test_1", { value: 1 }, 3600);
      await cache.set("clear_test_2", { value: 2 }, 3600);

      // Verify data is cached (returns non-null value)
      expect(await cache.get("clear_test_1")).not.toBeNull();
      expect(await cache.get("clear_test_2")).not.toBeNull();

      // Clear cache
      await cache.clear();

      // Data should be gone (returns null)
      expect(await cache.get("clear_test_1")).toBeNull();
      expect(await cache.get("clear_test_2")).toBeNull();
    });
  });

  describe("Cache with real workflow", () => {
    it("should cache forecast result and return same data", async () => {
      const cache = createCacheManager({ enabled: true });

      const geocoded = await geocodeLocation("Dublin, Ireland");
      const location: Location = {
        query: "Dublin, Ireland",
        resolved: geocoded,
      };

      // Fetch fresh data
      const freshResult = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: 5,
      });

      // Create cache key
      const cacheKey = createForecastCacheKey(
        geocoded.coordinates.latitude,
        geocoded.coordinates.longitude,
        "ecmwf,gfs",
        new Date()
      );

      // Store in cache
      await cache.set(cacheKey, freshResult, 3600);

      // Retrieve from cache
      const cachedResult = await cache.get(cacheKey);

      // Verify cached data matches
      expect(cachedResult).toBeDefined();
      expect(cachedResult.forecasts.length).toBe(freshResult.forecasts.length);
      expect(cachedResult.forecasts[0].model).toBe(freshResult.forecasts[0].model);
    });
  });
});
