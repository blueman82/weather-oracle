/**
 * Forecast API route for Weather Oracle.
 * GET /api/forecast?location=<query>&lat=<lat>&lon=<lon>&days=<number>
 *
 * Returns aggregated weather forecast from multiple models.
 */

import { NextRequest } from "next/server";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  generateNarrative,
  calculateConfidence,
  createCacheManager,
  createCoordinates,
  isGeocodingError,
  isApiError,
  type GeocodingResult,
  type AggregatedForecast,
  type ConfidenceResult,
  type NarrativeSummary,
} from "@weather-oracle/core";
import {
  successResponse,
  errors,
  handleCors,
  withCors,
} from "../response";

/**
 * Response data for forecast endpoint
 */
export interface ForecastResponseData {
  location: GeocodingResult;
  forecast: {
    coordinates: AggregatedForecast["coordinates"];
    validFrom: string;
    validTo: string;
    daily: AggregatedForecast["consensus"]["daily"];
    hourly: AggregatedForecast["consensus"]["hourly"];
    modelWeights: AggregatedForecast["modelWeights"];
  };
  confidence: {
    overall: ConfidenceResult;
    level: string;
    score: number;
  };
  narrative: NarrativeSummary;
}

// Create a singleton cache manager
const cacheManager = createCacheManager({ enabled: true });

/**
 * Generate a cache key for forecast requests
 */
function getForecastCacheKey(
  lat: number,
  lon: number,
  days: number
): string {
  // Round coordinates to ~1km precision for cache efficiency
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `forecast_${roundedLat}_${roundedLon}_${days}`;
}

/**
 * GET /api/forecast
 *
 * Query parameters:
 * - location (optional): Location name to geocode
 * - lat (optional): Latitude (alternative to location)
 * - lon (optional): Longitude (alternative to location)
 * - days (optional): Number of forecast days (1-7, default 5)
 *
 * Must provide either "location" OR both "lat" and "lon"
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const locationQuery = searchParams.get("location");
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const daysParam = searchParams.get("days");

  // Validate location parameters
  const hasLocation = locationQuery && locationQuery.trim().length > 0;
  const hasCoordinates = latParam && lonParam;

  if (!hasLocation && !hasCoordinates) {
    return withCors(
      errors.badRequest(
        "Must provide either 'location' parameter or both 'lat' and 'lon' parameters"
      )
    );
  }

  // Parse and validate days
  let days = 5;
  if (daysParam) {
    const parsed = parseInt(daysParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 7) {
      return withCors(
        errors.badRequest("Days must be a number between 1 and 7", {
          provided: daysParam,
        })
      );
    }
    days = parsed;
  }

  try {
    // Resolve location
    let resolvedLocation: GeocodingResult;

    if (hasCoordinates) {
      // Parse coordinates
      const lat = parseFloat(latParam!);
      const lon = parseFloat(lonParam!);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        return withCors(
          errors.badRequest("Latitude must be a number between -90 and 90", {
            provided: latParam,
          })
        );
      }

      if (isNaN(lon) || lon < -180 || lon > 180) {
        return withCors(
          errors.badRequest("Longitude must be a number between -180 and 180", {
            provided: lonParam,
          })
        );
      }

      // Create a synthetic location from coordinates
      resolvedLocation = {
        name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        coordinates: createCoordinates(lat, lon),
        country: "Unknown",
        countryCode: "XX",
        timezone: "UTC" as GeocodingResult["timezone"],
      };
    } else {
      // Geocode the location query
      resolvedLocation = await geocodeLocation(locationQuery!.trim());
    }

    // Check cache
    const cacheKey = getForecastCacheKey(
      resolvedLocation.coordinates.latitude,
      resolvedLocation.coordinates.longitude,
      days
    );

    const cached = await cacheManager.get<ForecastResponseData>(cacheKey);
    if (cached) {
      const duration = Date.now() - startTime;
      return withCors(
        successResponse<ForecastResponseData>(cached, {
          duration,
          cached: true,
          models: cached.forecast.modelWeights.map((w) => w.model),
        })
      );
    }

    // Create location object for fetching
    const location = {
      query: locationQuery ?? `${resolvedLocation.coordinates.latitude},${resolvedLocation.coordinates.longitude}`,
      resolved: resolvedLocation,
    };

    // Fetch forecasts from all models
    const modelResult = await fetchAllModels(location, undefined, {
      forecastDays: days,
    });

    // Check if we got enough data
    if (modelResult.forecasts.length === 0) {
      return withCors(
        errors.serviceUnavailable(
          "Unable to fetch forecast data from any weather model"
        )
      );
    }

    // Aggregate forecasts
    const aggregated = aggregateForecasts(modelResult.forecasts);

    // Calculate confidence
    const overallConfidence = calculateConfidence(aggregated, "overall", 0);

    // Generate narrative
    const narrative = generateNarrative(aggregated, [overallConfidence]);

    // Build response data
    const responseData: ForecastResponseData = {
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

    // Cache the response (TTL: 30 minutes)
    await cacheManager.set(cacheKey, responseData, 1800);

    const duration = Date.now() - startTime;
    const models = [...aggregated.models];

    return withCors(
      successResponse<ForecastResponseData>(responseData, {
        fetchedAt: modelResult.fetchedAt,
        duration,
        models,
        cached: false,
      })
    );
  } catch (error) {
    if (isGeocodingError(error)) {
      switch (error.code) {
        case "GEOCODING_NOT_FOUND":
          return withCors(
            errors.notFound(`Location not found: ${locationQuery}`)
          );
        case "GEOCODING_INVALID_INPUT":
          return withCors(errors.badRequest(error.userMessage));
        default:
          return withCors(
            errors.serviceUnavailable("Location service temporarily unavailable")
          );
      }
    }

    if (isApiError(error)) {
      switch (error.code) {
        case "API_RATE_LIMIT":
          return withCors(errors.rateLimited());
        case "API_TIMEOUT":
        case "API_UNAVAILABLE":
          return withCors(
            errors.serviceUnavailable("Weather service temporarily unavailable")
          );
        default:
          return withCors(errors.internalError(error.userMessage));
      }
    }

    console.error("Forecast API error:", error);
    return withCors(errors.internalError());
  }
}

/**
 * OPTIONS /api/forecast - CORS preflight
 */
export async function OPTIONS() {
  return handleCors();
}
