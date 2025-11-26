/**
 * Integration tests for the compare command.
 *
 * Tests the full compare flow with MSW-mocked API.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "bun:test";
import {
  setupMswServer,
  resetMswServer,
  teardownMswServer,
  setModelFailure,
  clearRequestLog,
  getRequestLog,
} from "./mocks/server";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  calculateSpread,
  identifyOutliers,
  type Location,
  type ModelForecast,
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

describe("Compare Command Integration Tests", () => {
  describe("Model comparison data building", () => {
    it("should fetch and compare multiple models for Dublin", async () => {
      const geocoded = await geocodeLocation("Dublin, Ireland");
      const location: Location = {
        query: "Dublin, Ireland",
        resolved: geocoded,
      };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 5 }
      );

      expect(result.forecasts.length).toBe(3);

      // Build comparison data
      const comparisons = buildDayComparisons(result.forecasts, 5);

      expect(comparisons.length).toBe(5);

      // Each day should have data from all 3 models
      for (const day of comparisons) {
        expect(day.tempMax.size).toBe(3);
        expect(day.tempMin.size).toBe(3);
        expect(day.precipProb.size).toBe(3);
      }
    });

    it("should calculate spread between model predictions", async () => {
      const geocoded = await geocodeLocation("London");
      const location: Location = { query: "London", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 3 }
      );

      expect(result.forecasts.length).toBe(4);

      // Get temperature predictions for first day
      const day0Temps = result.forecasts.map(
        (f) => f.daily[0].temperature.max as number
      );

      const spread = calculateSpread(day0Temps);

      expect(spread.min).toBeLessThanOrEqual(spread.max);
      expect(spread.range).toBe(spread.max - spread.min);
      expect(spread.mean).toBeDefined();
      expect(spread.stdDev).toBeGreaterThanOrEqual(0);
    });

    it("should identify outlier models", async () => {
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
    });
  });

  describe("Partial model failures", () => {
    beforeEach(() => {
      setModelFailure("gfs", true);
    });

    it("should show comparison with remaining models when one fails", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 5 }
      );

      // Should have 2 successful, 1 failed
      expect(result.forecasts.length).toBe(2);
      expect(result.failures.length).toBe(1);
      expect(result.failures[0].model).toBe("gfs");

      // Comparison should still work with 2 models
      const comparisons = buildDayComparisons(result.forecasts, 5);

      expect(comparisons.length).toBe(5);
      for (const day of comparisons) {
        expect(day.tempMax.size).toBe(2);
      }
    });

    it("should report all failed models in comparison", async () => {
      setModelFailure("icon", true);
      setModelFailure("jma", true);

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 3 }
      );

      expect(result.forecasts.length).toBe(1); // Only ECMWF succeeded
      expect(result.failures.length).toBe(3);

      const failedModels = result.failures.map((f) => f.model);
      expect(failedModels).toContain("gfs");
      expect(failedModels).toContain("icon");
      expect(failedModels).toContain("jma");
    });
  });

  describe("Model agreement analysis", () => {
    it("should show high agreement when models are close", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 3 }
      );

      const aggregated = aggregateForecasts(result.forecasts);

      // Overall confidence should be defined
      expect(aggregated.overallConfidence).toBeDefined();
    });

    it("should calculate temperature spread for each day", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 5 }
      );

      const comparisons = buildDayComparisons(result.forecasts, 5);

      for (const day of comparisons) {
        const tempMaxValues = Array.from(day.tempMax.values());
        const spread = calculateSpread(tempMaxValues);

        // Spread should be reasonable (models shouldn't differ by > 10 degrees)
        expect(spread.range).toBeLessThan(10);
      }
    });

    it("should calculate precipitation spread for each day", async () => {
      const geocoded = await geocodeLocation("London");
      const location: Location = { query: "London", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 5 }
      );

      const comparisons = buildDayComparisons(result.forecasts, 5);

      for (const day of comparisons) {
        const precipProbValues = Array.from(day.precipProb.values());
        const spread = calculateSpread(precipProbValues);

        // Precipitation probability should be 0-100
        expect(spread.min).toBeGreaterThanOrEqual(0);
        expect(spread.max).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("API request optimization", () => {
    it("should make parallel requests to all models", async () => {
      clearRequestLog();

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 3 }
      );

      const requests = getRequestLog();

      // Should have made requests to all 3 models (plus geocoding)
      expect(requests.length).toBe(4);

      // All model requests should have been made
      const modelUrls = requests.map((r) => r.url);
      expect(modelUrls.some((u) => u.includes("ecmwf"))).toBe(true);
      expect(modelUrls.some((u) => u.includes("gfs"))).toBe(true);
      expect(modelUrls.some((u) => u.includes("dwd-icon"))).toBe(true);
    });

    it("should only request specified models", async () => {
      clearRequestLog();

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      await fetchAllModels(
        location,
        ["ecmwf", "jma"],
        { forecastDays: 3 }
      );

      const requests = getRequestLog();
      const modelUrls = requests.map((r) => r.url);

      // Should have requested only ECMWF and JMA
      expect(modelUrls.some((u) => u.includes("ecmwf"))).toBe(true);
      expect(modelUrls.some((u) => u.includes("jma"))).toBe(true);

      // Should NOT have requested other models
      expect(modelUrls.some((u) => u.includes("gfs"))).toBe(false);
      expect(modelUrls.some((u) => u.includes("dwd-icon"))).toBe(false);
    });
  });
});

/**
 * Helper function to build day comparisons from forecasts
 */
interface DayComparison {
  date: Date;
  tempMax: Map<string, number>;
  tempMin: Map<string, number>;
  precipProb: Map<string, number>;
}

function buildDayComparisons(
  forecasts: readonly ModelForecast[],
  days: number
): DayComparison[] {
  const comparisons: Map<string, DayComparison> = new Map();

  for (const forecast of forecasts) {
    for (const daily of forecast.daily.slice(0, days)) {
      const dateKey = daily.date.toISOString().split("T")[0];

      if (!comparisons.has(dateKey)) {
        comparisons.set(dateKey, {
          date: daily.date,
          tempMax: new Map(),
          tempMin: new Map(),
          precipProb: new Map(),
        });
      }

      const comp = comparisons.get(dateKey)!;
      comp.tempMax.set(forecast.model, daily.temperature.max as number);
      comp.tempMin.set(forecast.model, daily.temperature.min as number);
      comp.precipProb.set(forecast.model, daily.precipitation.probability);
    }
  }

  return Array.from(comparisons.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}
