/**
 * Geocoding client for converting location queries to coordinates.
 *
 * Uses Open-Meteo's free geocoding API:
 * https://geocoding-api.open-meteo.com/v1/search
 *
 * Features:
 * - No API key required
 * - Returns best match by population/relevance
 * - Includes disambiguation info (country, region)
 */

import type { GeocodingResult, Coordinates } from "../types/location";
import { latitude, longitude, elevation, timezoneId } from "../types/location";
import { GeocodingError } from "../errors/geocoding";
import { loadConfig } from "../config/index";

/**
 * Open-Meteo geocoding API response structure
 */
interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingResult[];
  generationtime_ms?: number;
}

/**
 * Single result from Open-Meteo geocoding API
 */
interface OpenMeteoGeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  country_id?: number;
  admin1?: string;
  admin1_id?: number;
  admin2?: string;
  admin2_id?: number;
  admin3?: string;
  admin3_id?: number;
  admin4?: string;
  admin4_id?: number;
  timezone?: string;
  population?: number;
  postcodes?: string[];
}

/**
 * Options for geocoding requests
 */
export interface GeocodingOptions {
  /**
   * Maximum number of results to return (1-100, default 5)
   */
  count?: number;

  /**
   * Language for result names (ISO 639-1 code, default "en")
   */
  language?: string;

  /**
   * Request timeout in milliseconds (default from config or 10000)
   */
  timeout?: number;

  /**
   * Custom geocoding API endpoint (default from config)
   */
  endpoint?: string;
}

/**
 * Default geocoding options
 */
const DEFAULT_OPTIONS: Required<Omit<GeocodingOptions, "endpoint">> = {
  count: 5,
  language: "en",
  timeout: 10000,
};

/**
 * Build the geocoding request URL
 */
function buildGeocodingUrl(
  query: string,
  endpoint: string,
  options: Required<Omit<GeocodingOptions, "endpoint">>
): URL {
  const url = new URL(endpoint);

  url.searchParams.set("name", query);
  url.searchParams.set("count", String(options.count));
  url.searchParams.set("language", options.language);
  url.searchParams.set("format", "json");

  return url;
}

/**
 * Map Open-Meteo result to GeocodingResult
 */
function mapToGeocodingResult(result: OpenMeteoGeocodingResult): GeocodingResult {
  const coordinates: Coordinates = {
    latitude: latitude(result.latitude),
    longitude: longitude(result.longitude),
  };

  // Determine region: prefer admin1 (state/province), fall back to admin2
  const region = result.admin1 ?? result.admin2;

  return {
    name: result.name,
    coordinates,
    country: result.country ?? "Unknown",
    countryCode: result.country_code ?? "XX",
    region,
    timezone: timezoneId(result.timezone ?? "UTC"),
    elevation: result.elevation !== undefined ? elevation(result.elevation) : undefined,
    population: result.population,
  };
}

/**
 * Validate the query string before making a request
 */
function validateQuery(query: string): void {
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    throw GeocodingError.invalidInput(query, "Location query cannot be empty.");
  }

  if (trimmed.length < 2) {
    throw GeocodingError.invalidInput(
      query,
      "Location query must be at least 2 characters."
    );
  }

  if (trimmed.length > 200) {
    throw GeocodingError.invalidInput(
      query,
      "Location query is too long (max 200 characters)."
    );
  }
}

/**
 * Geocode a location query to coordinates.
 *
 * @param query - Location name to search for (e.g., "London", "New York, USA")
 * @param options - Optional geocoding options
 * @returns The best matching location result
 * @throws GeocodingError if the location cannot be found or an API error occurs
 *
 * @example
 * ```typescript
 * const result = await geocodeLocation("London");
 * console.log(result.name); // "London"
 * console.log(result.country); // "United Kingdom"
 * console.log(result.coordinates); // { latitude: 51.5074, longitude: -0.1278 }
 * ```
 */
export async function geocodeLocation(
  query: string,
  options?: GeocodingOptions
): Promise<GeocodingResult> {
  validateQuery(query);

  // Load config to get endpoint if not provided
  let endpoint = options?.endpoint;
  if (!endpoint) {
    const config = await loadConfig({ skipFile: true, skipEnv: false });
    endpoint = config.api.geocoding;
  }

  const opts: Required<Omit<GeocodingOptions, "endpoint">> = {
    count: options?.count ?? DEFAULT_OPTIONS.count,
    language: options?.language ?? DEFAULT_OPTIONS.language,
    timeout: options?.timeout ?? DEFAULT_OPTIONS.timeout,
  };

  const url = buildGeocodingUrl(query.trim(), endpoint, opts);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw GeocodingError.serviceError(
        query,
        new Error(`HTTP ${response.status}: ${response.statusText}`)
      );
    }

    const data = (await response.json()) as OpenMeteoGeocodingResponse;

    // Check for empty results
    if (!data.results || data.results.length === 0) {
      throw GeocodingError.notFound(query);
    }

    // Return the best match (first result, sorted by population/relevance by API)
    return mapToGeocodingResult(data.results[0]);
  } catch (error) {
    clearTimeout(timeoutId);

    // Re-throw GeocodingError as-is
    if (error instanceof GeocodingError) {
      throw error;
    }

    // Handle abort/timeout
    if (error instanceof Error && error.name === "AbortError") {
      throw GeocodingError.serviceError(
        query,
        new Error(`Request timed out after ${opts.timeout}ms`)
      );
    }

    // Wrap other errors
    throw GeocodingError.serviceError(
      query,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Search for multiple matching locations.
 *
 * Unlike `geocodeLocation` which returns only the best match,
 * this function returns all matching results (up to the specified count).
 * Useful for implementing location autocomplete or disambiguation UI.
 *
 * @param query - Location name to search for
 * @param options - Optional geocoding options
 * @returns Array of matching locations, sorted by relevance
 * @throws GeocodingError if an API error occurs
 *
 * @example
 * ```typescript
 * const results = await searchLocations("Springfield", { count: 10 });
 * // Returns multiple Springfields from different countries/states
 * ```
 */
export async function searchLocations(
  query: string,
  options?: GeocodingOptions
): Promise<GeocodingResult[]> {
  validateQuery(query);

  // Load config to get endpoint if not provided
  let endpoint = options?.endpoint;
  if (!endpoint) {
    const config = await loadConfig({ skipFile: true, skipEnv: false });
    endpoint = config.api.geocoding;
  }

  const opts: Required<Omit<GeocodingOptions, "endpoint">> = {
    count: options?.count ?? DEFAULT_OPTIONS.count,
    language: options?.language ?? DEFAULT_OPTIONS.language,
    timeout: options?.timeout ?? DEFAULT_OPTIONS.timeout,
  };

  const url = buildGeocodingUrl(query.trim(), endpoint, opts);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw GeocodingError.serviceError(
        query,
        new Error(`HTTP ${response.status}: ${response.statusText}`)
      );
    }

    const data = (await response.json()) as OpenMeteoGeocodingResponse;

    // Return empty array if no results (not an error for search)
    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map(mapToGeocodingResult);
  } catch (error) {
    clearTimeout(timeoutId);

    // Re-throw GeocodingError as-is
    if (error instanceof GeocodingError) {
      throw error;
    }

    // Handle abort/timeout
    if (error instanceof Error && error.name === "AbortError") {
      throw GeocodingError.serviceError(
        query,
        new Error(`Request timed out after ${opts.timeout}ms`)
      );
    }

    // Wrap other errors
    throw GeocodingError.serviceError(
      query,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
