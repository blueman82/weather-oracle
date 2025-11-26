/**
 * Multi-model fetcher for Weather Oracle.
 * Fetches forecasts from multiple weather models in parallel
 * and handles partial failures gracefully.
 */

import type { Location } from "../types/location";
import type { ModelName, ModelForecast } from "../types/models";
import { fetchModelForecast, type ForecastOptions } from "./open-meteo";
import { MODEL_INFO } from "../types/models";

/**
 * Failure information for a model fetch
 */
export interface ModelFailure {
  readonly model: ModelName;
  readonly error: Error;
  readonly durationMs: number;
}

/**
 * Result from fetching multiple models
 */
export interface MultiModelResult {
  readonly forecasts: ModelForecast[];
  readonly failures: ModelFailure[];
  readonly fetchedAt: Date;
  readonly totalDurationMs: number;
  readonly successRate: number;
}

/**
 * Extended forecast with timing metadata
 */
export interface TimedModelForecast extends ModelForecast {
  readonly fetchDurationMs: number;
}

/**
 * Options for multi-model fetch
 */
export interface MultiModelOptions extends ForecastOptions {
  /**
   * Delay between requests in milliseconds to respect rate limits.
   * Set to 0 for fully parallel requests.
   * Default: 0 (no delay)
   */
  requestDelayMs?: number;
}

/**
 * Get all available model names
 */
export function getDefaultModels(): ModelName[] {
  return Object.keys(MODEL_INFO) as ModelName[];
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single model forecast with timing information
 */
async function fetchWithTiming(
  model: ModelName,
  location: Location,
  options?: ForecastOptions
): Promise<{ model: ModelName; forecast?: ModelForecast; error?: Error; durationMs: number }> {
  const startTime = Date.now();

  try {
    const forecast = await fetchModelForecast(model, location, options);
    const durationMs = Date.now() - startTime;
    return { model, forecast, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      model,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs,
    };
  }
}

/**
 * Fetch forecasts from multiple weather models in parallel.
 *
 * Uses Promise.allSettled to ensure all requests complete even if some fail.
 * Returns both successful forecasts and information about any failures.
 *
 * @param location - The location to fetch forecasts for
 * @param models - Array of model names to fetch (defaults to all available models)
 * @param options - Forecast options including optional request delay
 * @returns Result containing successful forecasts, failures, and metadata
 *
 * @example
 * ```typescript
 * const result = await fetchAllModels(location, ["gfs", "ecmwf", "icon"]);
 * console.log(`Success: ${result.forecasts.length}, Failed: ${result.failures.length}`);
 *
 * // Handle partial failures
 * for (const failure of result.failures) {
 *   console.error(`${failure.model} failed: ${failure.error.message}`);
 * }
 * ```
 */
export async function fetchAllModels(
  location: Location,
  models?: ModelName[],
  options?: MultiModelOptions
): Promise<MultiModelResult> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const modelsToFetch = models ?? getDefaultModels();
  const { requestDelayMs = 0, ...forecastOptions } = options ?? {};

  // Build array of fetch promises
  let fetchPromises: Promise<{
    model: ModelName;
    forecast?: ModelForecast;
    error?: Error;
    durationMs: number;
  }>[];

  if (requestDelayMs > 0) {
    // Staggered requests with delay
    fetchPromises = modelsToFetch.map(async (model, index) => {
      if (index > 0) {
        await sleep(requestDelayMs * index);
      }
      return fetchWithTiming(model, location, forecastOptions);
    });
  } else {
    // Fully parallel requests
    fetchPromises = modelsToFetch.map((model) =>
      fetchWithTiming(model, location, forecastOptions)
    );
  }

  // Wait for all requests to complete (even if some fail)
  const results = await Promise.allSettled(fetchPromises);

  const forecasts: ModelForecast[] = [];
  const failures: ModelFailure[] = [];

  // Process results
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { model, forecast, error, durationMs } = result.value;

      if (forecast) {
        forecasts.push(forecast);
      } else if (error) {
        failures.push({ model, error, durationMs });
      }
    } else {
      // Promise.allSettled shouldn't reject, but handle it just in case
      const error = result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));

      // We don't know which model this is from, so we can't add it to failures
      // This should never happen with our implementation
      console.error("Unexpected rejection in Promise.allSettled:", error);
    }
  }

  const totalDurationMs = Date.now() - startTime;
  const totalAttempted = modelsToFetch.length;
  const successRate = totalAttempted > 0
    ? forecasts.length / totalAttempted
    : 0;

  return {
    forecasts,
    failures,
    fetchedAt,
    totalDurationMs,
    successRate,
  };
}

/**
 * Fetch forecasts from multiple models and get timing data for each.
 *
 * Similar to fetchAllModels but includes timing metadata in the forecast results.
 *
 * @param location - The location to fetch forecasts for
 * @param models - Array of model names to fetch
 * @param options - Forecast options
 * @returns Array of forecasts with timing data and array of failures
 */
export async function fetchAllModelsWithTiming(
  location: Location,
  models?: ModelName[],
  options?: MultiModelOptions
): Promise<{
  forecasts: TimedModelForecast[];
  failures: ModelFailure[];
  fetchedAt: Date;
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const modelsToFetch = models ?? getDefaultModels();
  const { requestDelayMs = 0, ...forecastOptions } = options ?? {};

  let fetchPromises: Promise<{
    model: ModelName;
    forecast?: ModelForecast;
    error?: Error;
    durationMs: number;
  }>[];

  if (requestDelayMs > 0) {
    fetchPromises = modelsToFetch.map(async (model, index) => {
      if (index > 0) {
        await sleep(requestDelayMs * index);
      }
      return fetchWithTiming(model, location, forecastOptions);
    });
  } else {
    fetchPromises = modelsToFetch.map((model) =>
      fetchWithTiming(model, location, forecastOptions)
    );
  }

  const results = await Promise.allSettled(fetchPromises);

  const forecasts: TimedModelForecast[] = [];
  const failures: ModelFailure[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { model, forecast, error, durationMs } = result.value;

      if (forecast) {
        forecasts.push({
          ...forecast,
          fetchDurationMs: durationMs,
        });
      } else if (error) {
        failures.push({ model, error, durationMs });
      }
    }
  }

  const totalDurationMs = Date.now() - startTime;

  return {
    forecasts,
    failures,
    fetchedAt,
    totalDurationMs,
  };
}
