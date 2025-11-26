/**
 * Model Comparison API route for Weather Oracle.
 * GET /api/compare?location=<query>&lat=<lat>&lon=<lon>&days=<number>
 *
 * Returns individual model forecasts for comparison.
 */

import { NextRequest } from "next/server";
import {
  geocodeLocation,
  fetchAllModels,
  identifyOutliers,
  createCacheManager,
  createCoordinates,
  isGeocodingError,
  isApiError,
  MODEL_INFO,
  type GeocodingResult,
  type ModelForecast,
  type ModelName,
  type ModelInfo,
} from "@weather-oracle/core";
import { type OutlierInfo } from "@weather-oracle/core";
import {
  successResponse,
  errors,
  handleCors,
  withCors,
} from "../response";

/**
 * Model forecast summary for comparison
 */
export interface ModelComparisonEntry {
  model: ModelName;
  info: Omit<ModelInfo, "name">;
  forecast: {
    validFrom: string;
    validTo: string;
    daily: Array<{
      date: string;
      temperatureMax: number;
      temperatureMin: number;
      precipitationTotal: number;
      precipitationProbability: number;
      windMaxSpeed: number;
      weatherCode: number;
    }>;
    hourlyCount: number;
  };
  status: "success" | "failed";
  error?: string;
}

/**
 * Response data for compare endpoint
 */
export interface CompareResponseData {
  location: GeocodingResult;
  models: ModelComparisonEntry[];
  outliers: OutlierInfo[];
  summary: {
    totalModels: number;
    successfulModels: number;
    failedModels: number;
  };
}

// Create a singleton cache manager
const cacheManager = createCacheManager({ enabled: true });

/**
 * Generate a cache key for compare requests
 */
function getCompareCacheKey(
  lat: number,
  lon: number,
  days: number
): string {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `compare_${roundedLat}_${roundedLon}_${days}`;
}

/**
 * Transform a ModelForecast into a comparison entry
 */
function toComparisonEntry(forecast: ModelForecast): ModelComparisonEntry {
  return {
    model: forecast.model,
    info: MODEL_INFO[forecast.model],
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
    status: "success",
  };
}

/**
 * GET /api/compare
 *
 * Query parameters:
 * - location (optional): Location name to geocode
 * - lat (optional): Latitude (alternative to location)
 * - lon (optional): Longitude (alternative to location)
 * - days (optional): Number of forecast days (1-7, default 5)
 * - models (optional): Comma-separated list of models to include
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
  const modelsParam = searchParams.get("models");

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

  // Parse and validate models filter
  let modelsFilter: ModelName[] | undefined;
  if (modelsParam) {
    const requestedModels = modelsParam.split(",").map((m) => m.trim().toLowerCase());
    const validModels = Object.keys(MODEL_INFO) as ModelName[];
    const invalidModels = requestedModels.filter(
      (m) => !validModels.includes(m as ModelName)
    );

    if (invalidModels.length > 0) {
      return withCors(
        errors.badRequest(`Invalid model names: ${invalidModels.join(", ")}`, {
          validModels,
          invalidModels,
        })
      );
    }

    modelsFilter = requestedModels as ModelName[];
  }

  try {
    // Resolve location
    let resolvedLocation: GeocodingResult;

    if (hasCoordinates) {
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

      resolvedLocation = {
        name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        coordinates: createCoordinates(lat, lon),
        country: "Unknown",
        countryCode: "XX",
        timezone: "UTC" as GeocodingResult["timezone"],
      };
    } else {
      resolvedLocation = await geocodeLocation(locationQuery!.trim());
    }

    // Check cache
    const cacheKey = getCompareCacheKey(
      resolvedLocation.coordinates.latitude,
      resolvedLocation.coordinates.longitude,
      days
    );

    const cached = await cacheManager.get<CompareResponseData>(cacheKey);
    if (cached && !modelsFilter) {
      // Only use cache if not filtering by specific models
      const duration = Date.now() - startTime;
      return withCors(
        successResponse<CompareResponseData>(cached, {
          duration,
          cached: true,
          models: cached.models
            .filter((m) => m.status === "success")
            .map((m) => m.model),
        })
      );
    }

    // Create location object for fetching
    const location = {
      query: locationQuery ?? `${resolvedLocation.coordinates.latitude},${resolvedLocation.coordinates.longitude}`,
      resolved: resolvedLocation,
    };

    // Fetch forecasts from all (or selected) models
    const modelResult = await fetchAllModels(location, modelsFilter, {
      forecastDays: days,
    });

    // Build comparison entries
    const modelEntries: ModelComparisonEntry[] = [];

    // Add successful forecasts
    for (const forecast of modelResult.forecasts) {
      modelEntries.push(toComparisonEntry(forecast));
    }

    // Add failed models
    for (const failure of modelResult.failures) {
      modelEntries.push({
        model: failure.model,
        info: MODEL_INFO[failure.model],
        forecast: {
          validFrom: "",
          validTo: "",
          daily: [],
          hourlyCount: 0,
        },
        status: "failed",
        error: failure.error.message,
      });
    }

    // Sort by model name for consistent ordering
    modelEntries.sort((a, b) => a.model.localeCompare(b.model));

    // Identify outliers across successful forecasts
    const outliers =
      modelResult.forecasts.length >= 3
        ? identifyOutliers(modelResult.forecasts)
        : [];

    // Build response
    const responseData: CompareResponseData = {
      location: resolvedLocation,
      models: modelEntries,
      outliers,
      summary: {
        totalModels: modelEntries.length,
        successfulModels: modelResult.forecasts.length,
        failedModels: modelResult.failures.length,
      },
    };

    // Cache full result (not filtered)
    if (!modelsFilter) {
      await cacheManager.set(cacheKey, responseData, 1800);
    }

    const duration = Date.now() - startTime;

    return withCors(
      successResponse<CompareResponseData>(responseData, {
        fetchedAt: modelResult.fetchedAt,
        duration,
        models: modelResult.forecasts.map((f) => f.model),
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

    console.error("Compare API error:", error);
    return withCors(errors.internalError());
  }
}

/**
 * OPTIONS /api/compare - CORS preflight
 */
export async function OPTIONS() {
  return handleCors();
}
