/**
 * Integration tests for Weather Oracle core forecast flow.
 *
 * Tests the complete flow from geocoding to forecast generation:
 * - Location geocoding
 * - Multi-model forecast fetching
 * - Forecast aggregation and consensus
 * - Confidence calculation
 * - Narrative generation
 *
 * Uses MSW to mock Open-Meteo API responses.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "bun:test";
import { setupServer } from "msw/node";
import { http, HttpResponse, delay } from "msw";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  calculateConfidence,
  generateNarrative,
  createCacheManager,
  createForecastCacheKey,
  type Location,
  type ModelName,
  type ModelForecast,
  type MultiModelResult,
} from "../../index";

/**
 * Open-Meteo API base URLs
 */
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1";

/**
 * Model endpoint mappings
 */
const MODEL_ENDPOINTS: Record<ModelName, string> = {
  ecmwf: `${WEATHER_API}/ecmwf`,
  gfs: `${WEATHER_API}/gfs`,
  icon: `${WEATHER_API}/dwd-icon`,
  jma: `${WEATHER_API}/jma`,
  gem: `${WEATHER_API}/gem`,
  meteofrance: `${WEATHER_API}/meteofrance`,
  ukmo: `${WEATHER_API}/ukmo`,
};

/**
 * Location data for common test locations
 */
const LOCATIONS: Record<
  string,
  {
    lat: number;
    lon: number;
    country: string;
    countryCode: string;
    region: string;
    timezone: string;
  }
> = {
  dublin: {
    lat: 53.3498,
    lon: -6.2603,
    country: "Ireland",
    countryCode: "IE",
    region: "Leinster",
    timezone: "Europe/Dublin",
  },
  london: {
    lat: 51.5074,
    lon: -0.1278,
    country: "United Kingdom",
    countryCode: "GB",
    region: "Greater London",
    timezone: "Europe/London",
  },
  newyork: {
    lat: 40.7128,
    lon: -74.006,
    country: "United States",
    countryCode: "US",
    region: "New York",
    timezone: "America/New_York",
  },
  tokyo: {
    lat: 35.6762,
    lon: 139.6503,
    country: "Japan",
    countryCode: "JP",
    region: "Tokyo",
    timezone: "Asia/Tokyo",
  },
};

/**
 * Mock state for controlling test behavior
 */
interface MockState {
  failingModels: Set<ModelName>;
  geocodingFailure: boolean;
  networkDelay: number;
  requestLog: Array<{ url: string; timestamp: Date }>;
}

const mockState: MockState = {
  failingModels: new Set(),
  geocodingFailure: false,
  networkDelay: 0,
  requestLog: [],
};

function resetMockState(): void {
  mockState.failingModels.clear();
  mockState.geocodingFailure = false;
  mockState.networkDelay = 0;
  mockState.requestLog = [];
}

function setModelFailure(model: ModelName, shouldFail: boolean): void {
  if (shouldFail) {
    mockState.failingModels.add(model);
  } else {
    mockState.failingModels.delete(model);
  }
}

function setGeocodingFailure(shouldFail: boolean): void {
  mockState.geocodingFailure = shouldFail;
}

function getRequestLog(): ReadonlyArray<{ url: string; timestamp: Date }> {
  return mockState.requestLog;
}

function clearRequestLog(): void {
  mockState.requestLog = [];
}

/**
 * Generate mock forecast response
 */
function generateMockForecast(
  lat: number,
  lon: number,
  days: number,
  model: ModelName
) {
  const now = new Date();
  const hourlyTimes: string[] = [];
  const dailyTimes: string[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(0, 0, 0, 0);
    dailyTimes.push(date.toISOString().split("T")[0]);

    for (let h = 0; h < 24; h++) {
      const hourDate = new Date(date);
      hourDate.setHours(h);
      hourlyTimes.push(hourDate.toISOString().slice(0, 16));
    }
  }

  const modelOffset =
    { ecmwf: 0, gfs: 0.5, icon: -0.3, jma: 0.2, gem: -0.2, meteofrance: 0.1, ukmo: -0.1 }[model] ?? 0;

  return {
    latitude: lat,
    longitude: lon,
    generationtime_ms: 0.5,
    utc_offset_seconds: 0,
    timezone: "UTC",
    timezone_abbreviation: "UTC",
    elevation: 10,
    hourly_units: { time: "iso8601", temperature_2m: "\u00b0C" },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTimes.map((_, i) => 12 + Math.sin(i / 12) * 5 + modelOffset),
      apparent_temperature: hourlyTimes.map((_, i) => 10 + Math.sin(i / 12) * 5 + modelOffset),
      relative_humidity_2m: hourlyTimes.map(() => 65 + Math.random() * 20),
      surface_pressure: hourlyTimes.map(() => 1015),
      wind_speed_10m: hourlyTimes.map(() => 12 + Math.random() * 5),
      wind_direction_10m: hourlyTimes.map(() => Math.round(Math.random() * 360)),
      wind_gusts_10m: hourlyTimes.map(() => 20 + Math.random() * 10),
      precipitation: hourlyTimes.map(() => Math.random() * 0.5),
      precipitation_probability: hourlyTimes.map((_, i) =>
        Math.min(Math.floor(i / 24) * 10 + 10, 80)
      ),
      cloud_cover: hourlyTimes.map(() => Math.round(30 + Math.random() * 40)),
      visibility: hourlyTimes.map(() => 15000),
      uv_index: hourlyTimes.map((_, i) => ((i % 24) >= 10 && (i % 24) <= 16 ? 3 : 0)),
      weather_code: hourlyTimes.map(() => Math.round(Math.random() * 3)),
    },
    daily_units: { time: "iso8601", temperature_2m_max: "\u00b0C" },
    daily: {
      time: dailyTimes,
      temperature_2m_max: dailyTimes.map((_, i) => 17 + i * 0.5 + modelOffset),
      temperature_2m_min: dailyTimes.map((_, i) => 8 + i * 0.3 + modelOffset),
      apparent_temperature_max: dailyTimes.map((_, i) => 15 + i * 0.5 + modelOffset),
      apparent_temperature_min: dailyTimes.map((_, i) => 6 + i * 0.3 + modelOffset),
      precipitation_sum: dailyTimes.map((_, i) => (i > 2 ? 2 + Math.random() * 3 : 0)),
      precipitation_probability_max: dailyTimes.map((_, i) => Math.min(15 + i * 12, 90)),
      precipitation_hours: dailyTimes.map((_, i) => (i > 2 ? 1 + Math.round(Math.random() * 3) : 0)),
      wind_speed_10m_max: dailyTimes.map(() => 15 + Math.random() * 10),
      wind_gusts_10m_max: dailyTimes.map(() => 25 + Math.random() * 15),
      wind_direction_10m_dominant: dailyTimes.map(() => Math.round(Math.random() * 360)),
      sunrise: dailyTimes.map((d) => `${d}T07:15`),
      sunset: dailyTimes.map((d) => `${d}T17:30`),
      daylight_duration: dailyTimes.map(() => 37800),
      uv_index_max: dailyTimes.map(() => 3 + Math.round(Math.random() * 2)),
      weather_code: dailyTimes.map(() => Math.round(Math.random() * 3)),
    },
  };
}

/**
 * MSW handlers for integration tests
 */
const handlers = [
  // Geocoding API handler
  http.get(GEOCODING_API, async ({ request }) => {
    const url = new URL(request.url);
    mockState.requestLog.push({ url: request.url, timestamp: new Date() });

    if (mockState.networkDelay > 0) {
      await delay(mockState.networkDelay);
    }

    const query = url.searchParams.get("name")?.toLowerCase() ?? "";

    // Simulate geocoding failure
    if (mockState.geocodingFailure || query.includes("invalid") || query.includes("nonexistent")) {
      return HttpResponse.json({ results: [] }, { status: 200 });
    }

    // Find location data
    const locationEntry = Object.entries(LOCATIONS).find(([key]) => query.includes(key));
    const location = locationEntry?.[1] ?? LOCATIONS.dublin;
    const cityName = query.split(",")[0].trim();
    const capitalizedName = cityName.charAt(0).toUpperCase() + cityName.slice(1);

    return HttpResponse.json({
      results: [
        {
          id: 1,
          name: capitalizedName,
          latitude: location.lat,
          longitude: location.lon,
          elevation: 10,
          country_code: location.countryCode,
          country: location.country,
          admin1: location.region,
          timezone: location.timezone,
          population: 500000,
        },
      ],
      generationtime_ms: 0.5,
    });
  }),

  // Weather model API handlers
  ...Object.entries(MODEL_ENDPOINTS).map(([model, endpoint]) =>
    http.get(endpoint, async ({ request }) => {
      const url = new URL(request.url);
      mockState.requestLog.push({ url: request.url, timestamp: new Date() });

      if (mockState.networkDelay > 0) {
        await delay(mockState.networkDelay);
      }

      const lat = parseFloat(url.searchParams.get("latitude") ?? "0");
      const lon = parseFloat(url.searchParams.get("longitude") ?? "0");
      const days = parseInt(url.searchParams.get("forecast_days") ?? "7", 10);

      // Simulate model failure
      if (mockState.failingModels.has(model as ModelName)) {
        return HttpResponse.json(
          { error: true, reason: `${model} service temporarily unavailable` },
          { status: 200 }
        );
      }

      return HttpResponse.json(generateMockForecast(lat, lon, days, model as ModelName));
    })
  ),
];

// Setup MSW server
const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
  resetMockState();
});

describe("Forecast Flow Integration Tests", () => {
  describe("Happy Path: Dublin -> Forecast -> Display", () => {
    it("should complete full forecast flow for Dublin", async () => {
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

      // Step 3: Fetch forecasts from multiple models
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
      expect(confidence.factors).toBeDefined();

      // Step 6: Generate narrative
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.headline).toBeDefined();
      expect(typeof narrative.headline).toBe("string");
      expect(narrative.headline.length).toBeGreaterThan(0);
      expect(narrative.alerts).toBeDefined();
      expect(Array.isArray(narrative.alerts)).toBe(true);
    });

    it("should produce consistent aggregated temperature values", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);

      const firstDay = aggregated.consensus.daily[0];
      expect(firstDay).toBeDefined();
      expect(firstDay.forecast.temperature.min).toBeDefined();
      expect(firstDay.forecast.temperature.max).toBeDefined();
      expect(firstDay.forecast.temperature.max).toBeGreaterThanOrEqual(
        firstDay.forecast.temperature.min as number
      );
    });
  });

  describe("Partial Failure: One Model Fails, Others Succeed", () => {
    beforeEach(() => {
      setModelFailure("gfs", true);
    });

    it("should handle single model failure gracefully", async () => {
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

      // Should still be able to aggregate remaining models
      const aggregated = aggregateForecasts(result.forecasts);
      expect(aggregated.models.length).toBe(2);
      expect(aggregated.consensus.daily.length).toBeGreaterThan(0);

      // Confidence should reflect fewer models
      const confidence = calculateConfidence(aggregated, "overall", 0);
      expect(confidence.score).toBeGreaterThanOrEqual(0);
      expect(confidence.factors).toBeDefined();
      expect(Array.isArray(confidence.factors)).toBe(true);
    });

    it("should continue with remaining models when multiple fail", async () => {
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

      const successfulModels = result.forecasts.map((f) => f.model);
      expect(successfulModels).toContain("ecmwf");
      expect(successfulModels).toContain("jma");
    });
  });

  describe("Cache Hit: Second Request Uses Cache", () => {
    it("should cache forecast data for subsequent requests", async () => {
      const cache = createCacheManager({ enabled: true });

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      // First request - should hit API
      clearRequestLog();
      const result1 = await fetchAllModels(location, ["ecmwf"], {
        forecastDays: 3,
      });

      const requestsAfterFirst = getRequestLog().filter((r) =>
        r.url.includes("ecmwf")
      ).length;
      expect(requestsAfterFirst).toBeGreaterThan(0);

      // Store result in cache
      const cacheKey = createForecastCacheKey(
        geocoded.coordinates.latitude,
        geocoded.coordinates.longitude,
        "ecmwf",
        new Date()
      );
      await cache.set(cacheKey, result1, 3600);

      // Second request - should use cache
      clearRequestLog();
      const cachedResult = await cache.get<MultiModelResult>(cacheKey);

      // Should not have made new API requests
      const newApiRequests = getRequestLog().filter((r) =>
        r.url.includes("ecmwf")
      ).length;
      expect(newApiRequests).toBe(0);

      // Cached data should match original
      expect(cachedResult).toBeDefined();
      expect(cachedResult!.forecasts.length).toBe(result1.forecasts.length);
    });

    it("should return identical data from cache", async () => {
      const cache = createCacheManager({ enabled: true });

      const mockData: MultiModelResult = {
        forecasts: [],
        failures: [],
        fetchedAt: new Date(),
        successRate: 1,
      };

      const cacheKey = "test_cache_identity_check";
      await cache.set(cacheKey, mockData, 3600);

      const cachedResult = await cache.get<MultiModelResult>(cacheKey);

      expect(cachedResult).toBeDefined();
      expect(cachedResult!.successRate).toBe(mockData.successRate);
      expect(cachedResult!.forecasts.length).toBe(mockData.forecasts.length);
    });
  });

  describe("Error Handling: Invalid Location -> Helpful Error", () => {
    it("should throw error for invalid location", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("invalidxyzlocation123")).rejects.toThrow();
    });

    it("should throw error for nonexistent location", async () => {
      await expect(geocodeLocation("nonexistent place xyz")).rejects.toThrow();
    });

    it("should throw error for empty location query", async () => {
      await expect(geocodeLocation("")).rejects.toThrow();
    });

    it("should throw error for very short location query", async () => {
      await expect(geocodeLocation("a")).rejects.toThrow();
    });

    it("should return descriptive error for all models failing", async () => {
      // Make all requested models fail
      setModelFailure("ecmwf", true);
      setModelFailure("gfs", true);
      setModelFailure("icon", true);

      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 3 }
      );

      expect(result.forecasts.length).toBe(0);
      expect(result.failures.length).toBe(3);
      expect(result.successRate).toBe(0);

      // Each failure should have error details
      for (const failure of result.failures) {
        expect(failure.model).toBeDefined();
        expect(failure.error).toBeDefined();
        expect(failure.error.message).toBeDefined();
      }
    });
  });

  describe("Format Switching: JSON Output", () => {
    it("should produce valid JSON structure from forecast data", async () => {
      const geocoded = await geocodeLocation("New York");
      const location: Location = { query: "New York", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Create JSON output structure
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

      // Verify JSON serialization
      const jsonString = JSON.stringify(jsonOutput);
      const parsed = JSON.parse(jsonString);

      expect(parsed.location.name.toLowerCase()).toContain("new");
      expect(parsed.forecast.daily.length).toBe(3);
      expect(parsed.confidence.level).toBeDefined();
      expect(parsed.narrative.headline).toBeDefined();
    });

    it("should include all required fields in forecast data", async () => {
      const geocoded = await geocodeLocation("Tokyo");
      const location: Location = { query: "Tokyo", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf"], {
        forecastDays: 1,
      });
      const aggregated = aggregateForecasts(result.forecasts);

      const daily = aggregated.consensus.daily[0];
      expect(daily.date).toBeInstanceOf(Date);
      expect(daily.forecast.temperature).toHaveProperty("min");
      expect(daily.forecast.temperature).toHaveProperty("max");
      expect(daily.forecast.precipitation).toHaveProperty("probability");
      expect(daily.forecast.precipitation).toHaveProperty("total");
      expect(daily.forecast.wind).toHaveProperty("maxSpeed");
      expect(daily.forecast.wind).toHaveProperty("dominantDirection");
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

      // Should have geocoding request + 3 model requests
      expect(requests.length).toBe(4);

      const urls = requests.map((r) => r.url);
      expect(urls.some((u) => u.includes("ecmwf"))).toBe(true);
      expect(urls.some((u) => u.includes("gfs"))).toBe(true);
      expect(urls.some((u) => u.includes("dwd-icon"))).toBe(true);
    });

    it("should include correct coordinates in API requests", async () => {
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

      for (const weight of aggregated.modelWeights) {
        expect(weight.weight).toBeGreaterThan(0);
        expect(weight.weight).toBeLessThanOrEqual(1);
      }

      // Weights should sum to approximately 1
      const totalWeight = aggregated.modelWeights.reduce(
        (sum, w) => sum + w.weight,
        0
      );
      expect(totalWeight).toBeCloseTo(1, 1);
    });

    it("should produce reasonable consensus values", async () => {
      const geocoded = await geocodeLocation("London");
      const location: Location = { query: "London", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);

      const firstDay = aggregated.consensus.daily[0];
      const tempMax = firstDay.forecast.temperature.max as number;
      const tempMin = firstDay.forecast.temperature.min as number;

      // Temperature should be reasonable
      expect(tempMax).toBeGreaterThan(tempMin);
      expect(tempMax).toBeLessThan(50); // Upper bound
      expect(tempMin).toBeGreaterThan(-30); // Lower bound
    });
  });

  describe("Confidence Levels", () => {
    it("should produce high confidence when models agree", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      // Use multiple models for better confidence assessment
      const result = await fetchAllModels(
        location,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 3 }
      );
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);

      // With mock data that has small variations, confidence should be reasonable
      expect(confidence.score).toBeGreaterThan(0.3);
      expect(["high", "medium", "low"]).toContain(confidence.level);
    });

    it("should include confidence factors in calculation", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);

      expect(confidence.factors).toBeDefined();
      expect(Array.isArray(confidence.factors)).toBe(true);
      // Each factor should have name, weight, score, contribution
      if (confidence.factors.length > 0) {
        expect(confidence.factors[0]).toHaveProperty("name");
        expect(confidence.factors[0]).toHaveProperty("score");
      }
    });
  });

  describe("Narrative Generation", () => {
    it("should generate meaningful headline", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs", "icon"], {
        forecastDays: 5,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.headline).toBeDefined();
      expect(narrative.headline.length).toBeGreaterThan(10);
    });

    it("should include alerts array", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.alerts).toBeDefined();
      expect(Array.isArray(narrative.alerts)).toBe(true);
    });

    it("should include model notes", async () => {
      const geocoded = await geocodeLocation("Dublin");
      const location: Location = { query: "Dublin", resolved: geocoded };

      const result = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(result.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.modelNotes).toBeDefined();
      expect(Array.isArray(narrative.modelNotes)).toBe(true);
    });
  });
});
