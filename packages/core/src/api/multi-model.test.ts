/**
 * Tests for multi-model fetcher.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  fetchAllModels,
  fetchAllModelsWithTiming,
  getDefaultModels,
} from "./multi-model";
import { latitude, longitude, timezoneId, elevation } from "../types/location";
import type { Location } from "../types/location";
import type { ModelName } from "../types/models";

/**
 * Create a mock location for testing
 */
function createMockLocation(lat: number = 40.7128, lon: number = -74.006): Location {
  return {
    query: "New York, NY",
    resolved: {
      name: "New York",
      coordinates: {
        latitude: latitude(lat),
        longitude: longitude(lon),
      },
      country: "United States",
      countryCode: "US",
      region: "New York",
      timezone: timezoneId("America/New_York"),
      elevation: elevation(10),
      population: 8336817,
    },
  };
}

/**
 * Create a mock API response
 */
function createMockResponse(): object {
  return {
    latitude: 40.7128,
    longitude: -74.006,
    generationtime_ms: 0.5,
    utc_offset_seconds: -18000,
    timezone: "America/New_York",
    timezone_abbreviation: "EST",
    elevation: 10,
    hourly_units: {
      time: "iso8601",
      temperature_2m: "°C",
    },
    hourly: {
      time: ["2024-01-15T00:00", "2024-01-15T01:00"],
      temperature_2m: [5.2, 4.8],
      apparent_temperature: [3.2, 2.8],
      relative_humidity_2m: [75, 78],
      surface_pressure: [1015, 1015],
      wind_speed_10m: [10.8, 12.6],
      wind_direction_10m: [270, 265],
      wind_gusts_10m: [18, 21],
      precipitation: [0, 0.1],
      precipitation_probability: [10, 15],
      cloud_cover: [50, 60],
      visibility: [15000, 14000],
      uv_index: [0, 0],
      weather_code: [2, 3],
    },
    daily_units: {
      time: "iso8601",
      temperature_2m_max: "°C",
    },
    daily: {
      time: ["2024-01-15"],
      temperature_2m_max: [8.5],
      temperature_2m_min: [2.1],
      apparent_temperature_max: [6.5],
      apparent_temperature_min: [0.1],
      precipitation_sum: [0.1],
      precipitation_probability_max: [15],
      precipitation_hours: [1],
      wind_speed_10m_max: [21],
      wind_gusts_10m_max: [32],
      wind_direction_10m_dominant: [270],
      sunrise: ["2024-01-15T07:15"],
      sunset: ["2024-01-15T16:55"],
      daylight_duration: [35040],
      uv_index_max: [2],
      weather_code: [3],
    },
  };
}

/**
 * Helper to create a mock fetch function
 */
function createMockFetch(
  handler: (url: string | URL | Request) => Promise<Response>
): typeof globalThis.fetch {
  const mockFn = mock(handler) as unknown as typeof globalThis.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockFn as any).preconnect = () => {};
  return mockFn;
}

describe("getDefaultModels", () => {
  it("should return all available models", () => {
    const models = getDefaultModels();
    expect(models).toContain("ecmwf");
    expect(models).toContain("gfs");
    expect(models).toContain("icon");
    expect(models).toContain("jma");
    expect(models).toContain("gem");
    expect(models).toContain("meteofrance");
    expect(models).toContain("ukmo");
    expect(models.length).toBe(7);
  });
});

describe("fetchAllModels", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should fetch multiple models in parallel", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const location = createMockLocation();
    const result = await fetchAllModels(location, ["gfs", "ecmwf", "icon"]);

    expect(result.forecasts.length).toBe(3);
    expect(result.failures.length).toBe(0);
    expect(result.successRate).toBe(1);
    expect(result.fetchedAt).toBeInstanceOf(Date);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);

    const models = result.forecasts.map((f) => f.model);
    expect(models).toContain("gfs");
    expect(models).toContain("ecmwf");
    expect(models).toContain("icon");
  });

  it("should handle partial failures gracefully", async () => {
    const failedModels = new Set<ModelName>(["ecmwf"]);

    globalThis.fetch = createMockFetch((url: string | URL | Request) => {
      const urlStr = url.toString();

      for (const model of failedModels) {
        if (urlStr.includes(model)) {
          return Promise.resolve(
            new Response("Service Unavailable", {
              status: 503,
              statusText: "Service Unavailable",
            })
          );
        }
      }

      return Promise.resolve(
        new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const location = createMockLocation();
    const result = await fetchAllModels(
      location,
      ["gfs", "ecmwf", "icon"],
      { retries: 0 }
    );

    expect(result.forecasts.length).toBe(2);
    expect(result.failures.length).toBe(1);
    expect(result.failures[0].model).toBe("ecmwf");
    expect(result.failures[0].error).toBeInstanceOf(Error);
    expect(result.failures[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeCloseTo(2 / 3, 2);
  });

  it("should return all failures when all models fail", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response("Service Unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        })
      )
    );

    const location = createMockLocation();
    const result = await fetchAllModels(
      location,
      ["gfs", "ecmwf"],
      { retries: 0 }
    );

    expect(result.forecasts.length).toBe(0);
    expect(result.failures.length).toBe(2);
    expect(result.successRate).toBe(0);
  });

  it("should use default models when none specified", async () => {
    let callCount = 0;

    globalThis.fetch = createMockFetch(() => {
      callCount++;
      return Promise.resolve(
        new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const location = createMockLocation();
    const result = await fetchAllModels(location);

    // Should fetch all 7 default models
    expect(result.forecasts.length).toBe(7);
    expect(callCount).toBe(7);
  });

  it("should respect request delay between fetches", async () => {
    const fetchTimes: number[] = [];

    globalThis.fetch = createMockFetch(() => {
      fetchTimes.push(Date.now());
      return Promise.resolve(
        new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const location = createMockLocation();
    const delayMs = 50;
    await fetchAllModels(location, ["gfs", "ecmwf", "icon"], {
      requestDelayMs: delayMs,
    });

    // Check that requests were staggered
    // Note: Due to async execution, times may not be perfectly staggered
    // but should show increasing pattern
    expect(fetchTimes.length).toBe(3);
    // First request should start immediately
    // Subsequent requests should be delayed
    if (fetchTimes.length >= 3) {
      const delay1 = fetchTimes[1] - fetchTimes[0];
      const delay2 = fetchTimes[2] - fetchTimes[0];
      // Allow some tolerance for timing variations
      expect(delay1).toBeGreaterThanOrEqual(delayMs * 0.8);
      expect(delay2).toBeGreaterThanOrEqual(delayMs * 1.6);
    }
  });

  it("should include fetchedAt timestamp", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const beforeFetch = new Date();
    const location = createMockLocation();
    const result = await fetchAllModels(location, ["gfs"]);
    const afterFetch = new Date();

    expect(result.fetchedAt.getTime()).toBeGreaterThanOrEqual(beforeFetch.getTime());
    expect(result.fetchedAt.getTime()).toBeLessThanOrEqual(afterFetch.getTime());
  });

  it("should track total duration", async () => {
    globalThis.fetch = createMockFetch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify(createMockResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const location = createMockLocation();
    const result = await fetchAllModels(location, ["gfs"]);

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(10);
  });

  it("should preserve model identity in failures", async () => {
    const errorModels: Record<ModelName, string> = {
      gfs: "GFS service down",
      ecmwf: "ECMWF maintenance",
      icon: "", // Will succeed
      jma: "",
      gem: "",
      meteofrance: "",
      ukmo: "",
    };

    globalThis.fetch = createMockFetch((url: string | URL | Request) => {
      const urlStr = url.toString();

      for (const [model, errorMsg] of Object.entries(errorModels) as [ModelName, string][]) {
        if (urlStr.includes(model) && errorMsg) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: true, reason: errorMsg }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
      }

      return Promise.resolve(
        new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const location = createMockLocation();
    const result = await fetchAllModels(
      location,
      ["gfs", "ecmwf", "icon"],
      { retries: 0 }
    );

    expect(result.failures.length).toBe(2);

    const gfsFailure = result.failures.find((f) => f.model === "gfs");
    const ecmwfFailure = result.failures.find((f) => f.model === "ecmwf");

    expect(gfsFailure).toBeDefined();
    expect(ecmwfFailure).toBeDefined();
    expect(gfsFailure!.error.message).toContain("GFS service down");
    expect(ecmwfFailure!.error.message).toContain("ECMWF maintenance");
  });

  it("should pass forecast options to underlying fetch", async () => {
    let capturedUrl: string | undefined;

    globalThis.fetch = createMockFetch((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve(
        new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const location = createMockLocation();
    await fetchAllModels(location, ["gfs"], {
      forecastDays: 10,
      timezone: "Europe/London",
    });

    expect(capturedUrl).toBeDefined();
    expect(capturedUrl).toContain("forecast_days=10");
    expect(capturedUrl).toContain("timezone=Europe%2FLondon");
  });
});

describe("fetchAllModelsWithTiming", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should include timing data in forecasts", async () => {
    globalThis.fetch = createMockFetch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify(createMockResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const location = createMockLocation();
    const result = await fetchAllModelsWithTiming(location, ["gfs", "ecmwf"]);

    expect(result.forecasts.length).toBe(2);

    for (const forecast of result.forecasts) {
      expect(forecast.fetchDurationMs).toBeGreaterThanOrEqual(10);
    }
  });

  it("should include timing data in failures", async () => {
    globalThis.fetch = createMockFetch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      });
    });

    const location = createMockLocation();
    const result = await fetchAllModelsWithTiming(location, ["gfs"], {
      retries: 0,
    });

    expect(result.failures.length).toBe(1);
    expect(result.failures[0].durationMs).toBeGreaterThanOrEqual(10);
  });

  it("should handle mixed success and failure with timing", async () => {
    globalThis.fetch = createMockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      await new Promise((resolve) => setTimeout(resolve, 5));

      // GFS succeeds, ECMWF fails
      if (urlStr.includes("gfs")) {
        return new Response(JSON.stringify(createMockResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Error", { status: 500 });
    });

    const location = createMockLocation();
    const result = await fetchAllModelsWithTiming(location, ["gfs", "ecmwf"], {
      retries: 0,
    });

    expect(result.forecasts.length).toBe(1);
    expect(result.failures.length).toBe(1);
    expect(result.forecasts[0].fetchDurationMs).toBeGreaterThanOrEqual(5);
    expect(result.failures[0].durationMs).toBeGreaterThanOrEqual(5);
  });
});
