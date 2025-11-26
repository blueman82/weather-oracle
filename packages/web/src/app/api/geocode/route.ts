/**
 * Geocoding API route for Weather Oracle.
 * GET /api/geocode?q=<query>&count=<number>
 *
 * Searches for locations matching the query string.
 */

import { NextRequest } from "next/server";
import {
  searchLocations,
  geocodeLocation,
  isGeocodingError,
  type GeocodingResult,
} from "@weather-oracle/core";
import {
  successResponse,
  errors,
  handleCors,
  withCors,
} from "../response";

/**
 * Response data for geocode endpoint
 */
export interface GeocodeResponseData {
  results: GeocodingResult[];
  query: string;
}

/**
 * GET /api/geocode
 *
 * Query parameters:
 * - q (required): Location search query
 * - count (optional): Number of results (1-10, default 5)
 * - single (optional): If "true", return only best match
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const countParam = searchParams.get("count");
  const singleParam = searchParams.get("single");

  // Validate required parameter
  if (!query || query.trim().length === 0) {
    return withCors(errors.missingParameter("q"));
  }

  // Parse and validate count
  let count = 5;
  if (countParam) {
    const parsed = parseInt(countParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 10) {
      return withCors(
        errors.badRequest("Count must be a number between 1 and 10", {
          provided: countParam,
        })
      );
    }
    count = parsed;
  }

  const returnSingle = singleParam === "true";

  try {
    let results: GeocodingResult[];

    if (returnSingle) {
      // Return only the best match
      const result = await geocodeLocation(query.trim(), { count: 1 });
      results = [result];
    } else {
      // Return multiple results for autocomplete/selection
      results = await searchLocations(query.trim(), { count });
    }

    const duration = Date.now() - startTime;

    return withCors(
      successResponse<GeocodeResponseData>(
        {
          results,
          query: query.trim(),
        },
        { duration }
      )
    );
  } catch (error) {
    if (isGeocodingError(error)) {
      // Handle specific geocoding errors
      switch (error.code) {
        case "GEOCODING_NOT_FOUND":
          return withCors(
            errors.notFound(`No locations found for query: ${query}`)
          );
        case "GEOCODING_INVALID_INPUT":
          return withCors(
            errors.badRequest(error.userMessage, { query })
          );
        case "GEOCODING_SERVICE_ERROR":
          return withCors(
            errors.serviceUnavailable("Geocoding service is temporarily unavailable")
          );
        default:
          return withCors(errors.internalError(error.userMessage));
      }
    }

    // Unknown error
    console.error("Geocode API error:", error);
    return withCors(errors.internalError());
  }
}

/**
 * OPTIONS /api/geocode - CORS preflight
 */
export async function OPTIONS() {
  return handleCors();
}
