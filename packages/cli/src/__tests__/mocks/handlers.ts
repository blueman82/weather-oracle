/**
 * MSW request handlers for integration tests.
 * Mocks Open-Meteo API responses for weather models and geocoding.
 */

import { http, HttpResponse, delay } from "msw";
import type { ModelName } from "@weather-oracle/core";
import { createMockGeocodingResponse, createMockForecastResponse } from "./data";

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
 * State for controlling mock behavior
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

/**
 * Reset mock state to defaults
 */
export function resetMockState(): void {
  mockState.failingModels.clear();
  mockState.geocodingFailure = false;
  mockState.networkDelay = 0;
  mockState.requestLog = [];
}

/**
 * Configure a model to fail
 */
export function setModelFailure(model: ModelName, shouldFail: boolean): void {
  if (shouldFail) {
    mockState.failingModels.add(model);
  } else {
    mockState.failingModels.delete(model);
  }
}

/**
 * Configure geocoding to fail
 */
export function setGeocodingFailure(shouldFail: boolean): void {
  mockState.geocodingFailure = shouldFail;
}

/**
 * Set network delay for all requests
 */
export function setNetworkDelay(ms: number): void {
  mockState.networkDelay = ms;
}

/**
 * Get request log for verification
 */
export function getRequestLog(): ReadonlyArray<{ url: string; timestamp: Date }> {
  return mockState.requestLog;
}

/**
 * Clear request log
 */
export function clearRequestLog(): void {
  mockState.requestLog = [];
}

/**
 * Default MSW handlers for integration tests
 */
export const handlers = [
  // Geocoding API handler
  http.get(GEOCODING_API, async ({ request }) => {
    const url = new URL(request.url);
    mockState.requestLog.push({ url: request.url, timestamp: new Date() });

    if (mockState.networkDelay > 0) {
      await delay(mockState.networkDelay);
    }

    const query = url.searchParams.get("name");

    // Simulate geocoding failure
    if (mockState.geocodingFailure) {
      return HttpResponse.json({ results: [] }, { status: 200 });
    }

    // Handle invalid location
    if (!query || query.toLowerCase().includes("invalid") || query.toLowerCase().includes("nonexistent")) {
      return HttpResponse.json({ results: [] }, { status: 200 });
    }

    // Return mock geocoding response
    const response = createMockGeocodingResponse(query);
    return HttpResponse.json(response);
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

      // Return mock forecast response
      const response = createMockForecastResponse(lat, lon, days, model as ModelName);
      return HttpResponse.json(response);
    })
  ),
];
