/**
 * MSW request handlers for Web API integration tests.
 * Mocks Open-Meteo API responses for weather models and geocoding.
 */

import { http, HttpResponse, delay } from "msw";
import type { ModelName } from "@weather-oracle/core";

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
 * Mock state for controlling behavior
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

/**
 * Reset mock state
 */
export function resetMockState(): void {
  mockState.failingModels.clear();
  mockState.geocodingFailure = false;
  mockState.networkDelay = 0;
}

/**
 * Configure model failure
 */
export function setModelFailure(model: ModelName, shouldFail: boolean): void {
  if (shouldFail) {
    mockState.failingModels.add(model);
  } else {
    mockState.failingModels.delete(model);
  }
}

/**
 * Configure geocoding failure
 */
export function setGeocodingFailure(shouldFail: boolean): void {
  mockState.geocodingFailure = shouldFail;
}

/**
 * Location data for common test locations
 */
const LOCATIONS: Record<string, { lat: number; lon: number; country: string; countryCode: string; region: string; timezone: string }> = {
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
};

/**
 * Generate mock forecast data
 */
function generateMockForecast(lat: number, lon: number, days: number, model: ModelName) {
  const now = new Date();
  const hourlyTimes: string[] = [];
  const dailyTimes: string[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
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
 * MSW handlers for Web API tests
 */
export const handlers = [
  // Geocoding API
  http.get(GEOCODING_API, async ({ request }) => {
    if (mockState.networkDelay > 0) {
      await delay(mockState.networkDelay);
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("name")?.toLowerCase() ?? "";

    if (mockState.geocodingFailure || query.includes("invalid") || query.includes("nonexistent")) {
      return HttpResponse.json({ results: [] });
    }

    const location = Object.entries(LOCATIONS).find(([key]) => query.includes(key))?.[1] ?? LOCATIONS.dublin;
    const cityName = query.split(",")[0].trim();

    return HttpResponse.json({
      results: [{
        id: 1,
        name: cityName.charAt(0).toUpperCase() + cityName.slice(1),
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

  // Weather model APIs
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
