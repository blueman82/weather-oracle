/**
 * Tests for Open-Meteo API client.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { OpenMeteoClient, fetchModelForecast } from "./open-meteo";
import { ApiError } from "../errors/api";
import { latitude, longitude, timezoneId, elevation } from "../types/location";
import type { Location } from "../types/location";

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
function createMockResponse(options: {
  times?: string[];
  temperatures?: number[];
  dailyTimes?: string[];
}): object {
  const times = options.times ?? [
    "2024-01-15T00:00",
    "2024-01-15T01:00",
    "2024-01-15T02:00",
  ];
  const temperatures = options.temperatures ?? [5.2, 4.8, 4.5];
  const dailyTimes = options.dailyTimes ?? ["2024-01-15"];

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
      wind_speed_10m: "km/h",
    },
    hourly: {
      time: times,
      temperature_2m: temperatures,
      apparent_temperature: temperatures.map((t) => t - 2),
      relative_humidity_2m: [75, 78, 80],
      surface_pressure: [1015, 1015, 1014],
      wind_speed_10m: [10.8, 12.6, 11.2], // km/h
      wind_direction_10m: [270, 265, 280],
      wind_gusts_10m: [18, 21, 19], // km/h
      precipitation: [0, 0.1, 0],
      precipitation_probability: [10, 15, 5],
      cloud_cover: [50, 60, 45],
      visibility: [15000, 14000, 16000],
      uv_index: [0, 0, 0],
      weather_code: [2, 3, 2],
    },
    daily_units: {
      time: "iso8601",
      temperature_2m_max: "°C",
      temperature_2m_min: "°C",
    },
    daily: {
      time: dailyTimes,
      temperature_2m_max: [8.5],
      temperature_2m_min: [2.1],
      apparent_temperature_max: [6.5],
      apparent_temperature_min: [0.1],
      precipitation_sum: [0.1],
      precipitation_probability_max: [15],
      precipitation_hours: [1],
      wind_speed_10m_max: [21], // km/h
      wind_gusts_10m_max: [32], // km/h
      wind_direction_10m_dominant: [270],
      sunrise: ["2024-01-15T07:15"],
      sunset: ["2024-01-15T16:55"],
      daylight_duration: [35040], // seconds
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
  // Add preconnect method to satisfy fetch type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockFn as any).preconnect = () => {};
  return mockFn;
}

describe("OpenMeteoClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("fetchModelForecast", () => {
    it("should fetch and parse forecast correctly", async () => {
      const mockResponse = createMockResponse({});

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const client = new OpenMeteoClient();
      const location = createMockLocation();
      const forecast = await client.fetchModelForecast("gfs", location);

      expect(forecast.model).toBe("gfs");
      expect(forecast.hourly.length).toBe(3);
      expect(forecast.daily.length).toBe(1);

      // Verify hourly data parsing
      const firstHour = forecast.hourly[0];
      expect(firstHour.timestamp.toISOString()).toContain("2024-01-15");
      expect(firstHour.metrics.temperature as number).toBeCloseTo(5.2, 1);
      expect(firstHour.metrics.humidity as number).toBe(75);

      // Verify wind speed conversion (km/h to m/s)
      expect(firstHour.metrics.windSpeed as number).toBeCloseTo(10.8 / 3.6, 1);
    });

    it("should include coordinates in response", async () => {
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify(createMockResponse({})), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const client = new OpenMeteoClient();
      const location = createMockLocation(51.5074, -0.1278);
      const forecast = await client.fetchModelForecast("ecmwf", location);

      expect(forecast.coordinates.latitude as number).toBeCloseTo(51.5074, 4);
      expect(forecast.coordinates.longitude as number).toBeCloseTo(-0.1278, 4);
    });

    it("should build URL with correct parameters", async () => {
      let capturedUrl: string | undefined;

      globalThis.fetch = createMockFetch((url: string | URL | Request) => {
        capturedUrl = url.toString();
        return Promise.resolve(
          new Response(JSON.stringify(createMockResponse({})), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      const client = new OpenMeteoClient();
      const location = createMockLocation();
      await client.fetchModelForecast("gfs", location, { forecastDays: 5 });

      expect(capturedUrl).toBeDefined();
      expect(capturedUrl).toContain("api.open-meteo.com/v1/gfs");
      expect(capturedUrl).toContain("latitude=40.7128");
      expect(capturedUrl).toContain("longitude=-74.006");
      expect(capturedUrl).toContain("forecast_days=5");
      expect(capturedUrl).toContain("hourly=");
      expect(capturedUrl).toContain("daily=");
    });

    it("should use correct endpoint for each model", async () => {
      const models = ["ecmwf", "gfs", "icon", "jma", "gem"] as const;
      const expectedEndpoints: Record<string, string> = {
        ecmwf: "ecmwf",
        gfs: "gfs",
        icon: "dwd-icon",
        jma: "jma",
        gem: "gem",
      };

      for (const model of models) {
        let capturedUrl: string | undefined;

        globalThis.fetch = createMockFetch((url: string | URL | Request) => {
          capturedUrl = url.toString();
          return Promise.resolve(
            new Response(JSON.stringify(createMockResponse({})), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        });

        const client = new OpenMeteoClient();
        const location = createMockLocation();
        await client.fetchModelForecast(model, location);

        expect(capturedUrl).toContain(expectedEndpoints[model]);
      }
    });

    it("should handle API error response", async () => {
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: true,
              reason: "Invalid coordinates",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const client = new OpenMeteoClient({ retries: 0 });
      const location = createMockLocation();

      await expect(client.fetchModelForecast("gfs", location)).rejects.toThrow(ApiError);
    });

    it("should handle HTTP error responses", async () => {
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve(
          new Response("Not Found", {
            status: 404,
            statusText: "Not Found",
          })
        )
      );

      const client = new OpenMeteoClient({ retries: 0 });
      const location = createMockLocation();

      await expect(client.fetchModelForecast("gfs", location)).rejects.toThrow(ApiError);
    });

    it("should retry on transient failures", async () => {
      let callCount = 0;

      globalThis.fetch = createMockFetch(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(
            new Response("Service Unavailable", {
              status: 503,
              statusText: "Service Unavailable",
            })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(createMockResponse({})), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      const client = new OpenMeteoClient({ retries: 3 });
      const location = createMockLocation();
      const forecast = await client.fetchModelForecast("gfs", location);

      expect(forecast.model).toBe("gfs");
      expect(callCount).toBe(3);
    });

    it("should not retry on client errors", async () => {
      let callCount = 0;

      globalThis.fetch = createMockFetch(() => {
        callCount++;
        return Promise.resolve(
          new Response("Bad Request", {
            status: 400,
            statusText: "Bad Request",
          })
        );
      });

      const client = new OpenMeteoClient({ retries: 3 });
      const location = createMockLocation();

      await expect(client.fetchModelForecast("gfs", location)).rejects.toThrow(ApiError);
      expect(callCount).toBe(1);
    });
  });

  describe("fetchMultipleModels", () => {
    it("should fetch multiple models in parallel", async () => {
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify(createMockResponse({})), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const client = new OpenMeteoClient();
      const location = createMockLocation();
      const results = await client.fetchMultipleModels(
        ["gfs", "ecmwf", "icon"],
        location
      );

      expect(results.size).toBe(3);
      expect(results.has("gfs")).toBe(true);
      expect(results.has("ecmwf")).toBe(true);
      expect(results.has("icon")).toBe(true);

      const gfsResult = results.get("gfs");
      expect(gfsResult).toBeDefined();
      expect(gfsResult instanceof ApiError).toBe(false);
    });

    it("should capture individual model errors", async () => {
      let callCount = 0;

      globalThis.fetch = createMockFetch(() => {
        callCount++;
        // Fail for first model (gfs)
        if (callCount === 1) {
          return Promise.resolve(
            new Response("Service Unavailable", {
              status: 503,
              statusText: "Service Unavailable",
            })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(createMockResponse({})), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      const client = new OpenMeteoClient({ retries: 0 });
      const location = createMockLocation();
      const results = await client.fetchMultipleModels(
        ["gfs", "ecmwf"],
        location
      );

      expect(results.size).toBe(2);

      // One should be an error
      const gfsResult = results.get("gfs");
      expect(gfsResult instanceof ApiError).toBe(true);
    });
  });

  describe("daily forecast parsing", () => {
    it("should parse daily data with all fields", async () => {
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify(createMockResponse({})), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const client = new OpenMeteoClient();
      const location = createMockLocation();
      const forecast = await client.fetchModelForecast("gfs", location);

      expect(forecast.daily.length).toBe(1);
      const day = forecast.daily[0];

      expect(day.temperature.max as number).toBeCloseTo(8.5, 1);
      expect(day.temperature.min as number).toBeCloseTo(2.1, 1);
      expect(day.precipitation.total as number).toBeCloseTo(0.1, 1);
      expect(day.precipitation.probability).toBe(15);
      expect(day.uvIndex.max as number).toBe(2);
      expect(day.sun.daylightHours).toBeCloseTo(35040 / 3600, 1);
    });

    it("should link hourly forecasts to daily", async () => {
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify(createMockResponse({})), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const client = new OpenMeteoClient();
      const location = createMockLocation();
      const forecast = await client.fetchModelForecast("gfs", location);

      const day = forecast.daily[0];
      expect(day.hourly.length).toBe(3);
      expect(day.hourly[0].metrics.temperature as number).toBeCloseTo(5.2, 1);
    });
  });
});

describe("fetchModelForecast convenience function", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should work as standalone function", async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(createMockResponse({})), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const location = createMockLocation();
    const forecast = await fetchModelForecast("icon", location);

    expect(forecast.model).toBe("icon");
    expect(forecast.hourly.length).toBe(3);
  });
});
