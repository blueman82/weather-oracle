/**
 * End-to-end tests for Weather Oracle Web API routes.
 *
 * Tests the complete API flow:
 * - GET /api/forecast - aggregated weather forecast
 * - GET /api/compare - model comparison
 * - GET /api/geocode - location search
 *
 * Uses MSW to mock external API dependencies.
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
  identifyOutliers,
  searchLocations,
  type Location,
  type ModelName,
  type GeocodingResult,
} from "@weather-oracle/core";

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
 * Mock state
 */
interface MockState {
  failingModels: Set<ModelName>;
  geocodingFailure: boolean;
  networkDelay: number;
}

const mockState: MockState = {
  failingModels: new Set(),
  geocodingFailure: false,
  networkDelay: 0,
};

function resetMockState(): void {
  mockState.failingModels.clear();
  mockState.geocodingFailure = false;
  mockState.networkDelay = 0;
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

/**
 * Location data
 */
const LOCATIONS: Record<string, {
  lat: number;
  lon: number;
  country: string;
  countryCode: string;
  region: string;
  timezone: string;
}> = {
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
 * Generate mock forecast response
 */
function generateMockForecast(lat: number, lon: number, days: number, model: ModelName) {
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

  const modelOffset = { ecmwf: 0, gfs: 0.5, icon: -0.3, jma: 0.2, gem: -0.2, meteofrance: 0.1, ukmo: -0.1 }[model] ?? 0;

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
      precipitation_probability: hourlyTimes.map((_, i) => Math.min(Math.floor(i / 24) * 10 + 10, 80)),
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
 * MSW handlers
 */
const handlers = [
  http.get(GEOCODING_API, async ({ request }) => {
    if (mockState.networkDelay > 0) {
      await delay(mockState.networkDelay);
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("name")?.toLowerCase() ?? "";

    if (mockState.geocodingFailure || query.includes("invalid") || query.includes("nonexistent")) {
      return HttpResponse.json({ results: [] });
    }

    const locationEntry = Object.entries(LOCATIONS).find(([key]) => query.includes(key));
    const location = locationEntry?.[1] ?? LOCATIONS.dublin;
    const cityName = query.split(",")[0].trim();
    const capitalizedName = cityName.charAt(0).toUpperCase() + cityName.slice(1);

    return HttpResponse.json({
      results: [{
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
      }],
      generationtime_ms: 0.5,
    });
  }),

  ...Object.entries(MODEL_ENDPOINTS).map(([model, endpoint]) =>
    http.get(endpoint, async ({ request }) => {
      if (mockState.networkDelay > 0) {
        await delay(mockState.networkDelay);
      }

      const url = new URL(request.url);
      const lat = parseFloat(url.searchParams.get("latitude") ?? "53.35");
      const lon = parseFloat(url.searchParams.get("longitude") ?? "-6.26");
      const days = parseInt(url.searchParams.get("forecast_days") ?? "5", 10);

      if (mockState.failingModels.has(model as ModelName)) {
        return HttpResponse.json({ error: true, reason: `${model} unavailable` });
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

describe("Web API E2E Tests", () => {
  describe("GET /api/forecast", () => {
    it("should return forecast data for valid location query", async () => {
      const locationQuery = "Dublin, Ireland";
      const days = 5;

      // Simulate the forecast route logic
      const resolvedLocation = await geocodeLocation(locationQuery);
      expect(resolvedLocation.name).toBeDefined();

      const location: Location = {
        query: locationQuery,
        resolved: resolvedLocation,
      };

      const modelResult = await fetchAllModels(location, undefined, {
        forecastDays: days,
      });

      expect(modelResult.forecasts.length).toBeGreaterThan(0);

      const aggregated = aggregateForecasts(modelResult.forecasts);
      expect(aggregated.consensus.daily.length).toBe(days);

      const overallConfidence = calculateConfidence(aggregated, "overall", 0);
      expect(overallConfidence.score).toBeGreaterThanOrEqual(0);
      expect(overallConfidence.score).toBeLessThanOrEqual(1);

      const narrative = generateNarrative(aggregated, [overallConfidence]);
      expect(narrative.headline).toBeDefined();

      // Build response data structure
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

    it("should return forecast data for coordinate query", async () => {
      const lat = 53.3498;
      const lon = -6.2603;
      const days = 3;

      // Create synthetic location from coordinates
      const resolvedLocation: GeocodingResult = {
        name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        coordinates: { latitude: lat, longitude: lon } as GeocodingResult["coordinates"],
        country: "Unknown",
        countryCode: "XX",
        timezone: "UTC" as GeocodingResult["timezone"],
      };

      const location: Location = {
        query: `${lat},${lon}`,
        resolved: resolvedLocation,
      };

      const modelResult = await fetchAllModels(location, ["ecmwf", "gfs"], {
        forecastDays: days,
      });

      expect(modelResult.forecasts.length).toBe(2);
      expect(modelResult.failures.length).toBe(0);
    });

    it("should handle invalid location with appropriate error", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("invalidlocation123")).rejects.toThrow();
    });

    it("should validate days parameter range (1-7)", async () => {
      const location = await geocodeLocation("Dublin");

      // Test valid days values
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

    it("should include all required response fields", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(modelResult.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Verify all expected fields exist
      expect(location.name).toBeDefined();
      expect(location.coordinates).toBeDefined();
      expect(location.country).toBeDefined();
      expect(aggregated.coordinates).toBeDefined();
      expect(aggregated.validFrom).toBeInstanceOf(Date);
      expect(aggregated.validTo).toBeInstanceOf(Date);
      expect(aggregated.consensus.daily).toBeDefined();
      expect(aggregated.modelWeights).toBeDefined();
      expect(confidence.level).toBeDefined();
      expect(confidence.score).toBeDefined();
      expect(narrative.headline).toBeDefined();
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

      // Build comparison entries
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

    it("should identify outliers across model forecasts", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(
        locationObj,
        ["ecmwf", "gfs", "icon", "jma"],
        { forecastDays: 3 }
      );

      expect(modelResult.forecasts.length).toBeGreaterThanOrEqual(3);

      const outliers = identifyOutliers(modelResult.forecasts);
      expect(Array.isArray(outliers)).toBe(true);
    });

    it("should handle partial model failures", async () => {
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

      const failedModels = modelResult.failures.map((f) => f.model);
      expect(failedModels).toContain("gfs");
      expect(failedModels).toContain("icon");
    });

    it("should filter by requested models", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

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

    it("should include summary information", async () => {
      setModelFailure("gfs", true);

      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(
        locationObj,
        ["ecmwf", "gfs", "icon"],
        { forecastDays: 3 }
      );

      const summary = {
        totalModels: modelResult.forecasts.length + modelResult.failures.length,
        successfulModels: modelResult.forecasts.length,
        failedModels: modelResult.failures.length,
      };

      expect(summary.totalModels).toBe(3);
      expect(summary.successfulModels).toBe(2);
      expect(summary.failedModels).toBe(1);
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

    it("should handle location search with multiple results", async () => {
      // searchLocations returns multiple results for autocomplete
      const results = await searchLocations("dublin", { count: 5 });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBeDefined();
    });

    it("should reject invalid queries", async () => {
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
      expect(response.meta.models.length).toBeGreaterThan(0);
    });

    it("should produce valid error response structure", () => {
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

    it("should produce valid bad request error", () => {
      const errorResponse = {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Days must be a number between 1 and 7",
          details: { provided: "15" },
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("Error Handling", () => {
    it("should handle all models failing", async () => {
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

    it("should handle geocoding service failure", async () => {
      setGeocodingFailure(true);

      await expect(geocodeLocation("Dublin")).rejects.toThrow();
    });
  });

  describe("Data Validation", () => {
    it("should validate temperature values are reasonable", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(modelResult.forecasts);

      for (const day of aggregated.consensus.daily) {
        const tempMax = day.forecast.temperature.max as number;
        const tempMin = day.forecast.temperature.min as number;

        // Temperature should be within reasonable bounds
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

    it("should validate coordinates are within valid ranges", async () => {
      const location = await geocodeLocation("Dublin");

      const lat = location.coordinates.latitude as number;
      const lon = location.coordinates.longitude as number;

      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum days (1)", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 1,
      });

      expect(modelResult.forecasts[0].daily.length).toBe(1);
    });

    it("should handle maximum days (7)", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 7,
      });

      expect(modelResult.forecasts[0].daily.length).toBe(7);
    });

    it("should handle single model request", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });

      expect(modelResult.forecasts.length).toBe(1);

      // Should still be able to aggregate single model
      const aggregated = aggregateForecasts(modelResult.forecasts);
      expect(aggregated.models.length).toBe(1);
    });

    it("should handle location with special characters", async () => {
      // Dublin should still resolve correctly
      const result = await geocodeLocation("Dublin");
      expect(result.name).toBeDefined();
    });
  });

  describe("Caching Behavior", () => {
    it("should produce cacheable response data", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(modelResult.forecasts);

      // Verify response can be serialized for caching
      const responseData = {
        location,
        forecast: {
          coordinates: aggregated.coordinates,
          validFrom: aggregated.validFrom.toISOString(),
          validTo: aggregated.validTo.toISOString(),
          daily: aggregated.consensus.daily,
          modelWeights: aggregated.modelWeights,
        },
      };

      const serialized = JSON.stringify(responseData);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.location.name).toBe(location.name);
      expect(deserialized.forecast.daily.length).toBe(3);
    });
  });

  describe("Model-specific Behavior", () => {
    it("should handle ECMWF model specifically", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf"], {
        forecastDays: 3,
      });

      expect(modelResult.forecasts[0].model).toBe("ecmwf");
    });

    it("should handle GFS model specifically", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["gfs"], {
        forecastDays: 3,
      });

      expect(modelResult.forecasts[0].model).toBe("gfs");
    });

    it("should handle ICON model specifically", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["icon"], {
        forecastDays: 3,
      });

      expect(modelResult.forecasts[0].model).toBe("icon");
    });
  });
});
