/**
 * Geocoding-specific error classes.
 */

import { WeatherOracleError, ErrorCode, type ErrorDebugInfo } from "./base";

/**
 * A suggested location when the original query couldn't be resolved
 */
export interface LocationSuggestion {
  readonly name: string;
  readonly country?: string;
  readonly region?: string;
}

/**
 * Error thrown when geocoding operations fail.
 */
export class GeocodingError extends WeatherOracleError {
  readonly query: string;
  readonly suggestions?: readonly LocationSuggestion[];

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    query: string,
    options?: {
      suggestions?: readonly LocationSuggestion[];
      debugInfo?: Omit<ErrorDebugInfo, "timestamp">;
    }
  ) {
    super(code, message, userMessage, options?.debugInfo);
    this.name = "GeocodingError";
    this.query = query;
    this.suggestions = options?.suggestions;
  }

  /**
   * Create a "location not found" error with optional suggestions
   */
  static notFound(
    query: string,
    suggestions?: readonly LocationSuggestion[]
  ): GeocodingError {
    const suggestionsText = suggestions?.length
      ? ` Did you mean: ${suggestions.map((s) => formatSuggestion(s)).join(" or ")}?`
      : "";

    return new GeocodingError(
      ErrorCode.GEOCODING_NOT_FOUND,
      `Location not found: "${query}"`,
      `Location not found: "${query}"${suggestionsText}`,
      query,
      { suggestions, debugInfo: { searchedQuery: query } }
    );
  }

  /**
   * Create an "ambiguous location" error when multiple matches exist
   */
  static ambiguous(
    query: string,
    matches: readonly LocationSuggestion[]
  ): GeocodingError {
    const matchList = matches
      .map((m) => formatSuggestion(m))
      .join(", ");

    return new GeocodingError(
      ErrorCode.GEOCODING_AMBIGUOUS,
      `Ambiguous location: "${query}" matches multiple places`,
      `Multiple locations found for "${query}". Please be more specific: ${matchList}`,
      query,
      { suggestions: matches, debugInfo: { matchCount: matches.length } }
    );
  }

  /**
   * Create an "invalid input" error for malformed location queries
   */
  static invalidInput(
    query: string,
    reason: string
  ): GeocodingError {
    return new GeocodingError(
      ErrorCode.GEOCODING_INVALID_INPUT,
      `Invalid location query: ${reason}`,
      `Invalid location: "${query}". ${reason}`,
      query,
      { debugInfo: { reason } }
    );
  }

  /**
   * Create a "service error" for geocoding API failures
   */
  static serviceError(
    query: string,
    cause?: Error
  ): GeocodingError {
    return new GeocodingError(
      ErrorCode.GEOCODING_SERVICE_ERROR,
      `Geocoding service error: ${cause?.message ?? "Unknown error"}`,
      "Unable to look up location. Please try again later.",
      query,
      {
        debugInfo: {
          originalError: cause?.message,
          originalStack: cause?.stack,
        },
      }
    );
  }
}

/**
 * Format a location suggestion for display
 */
function formatSuggestion(suggestion: LocationSuggestion): string {
  const parts = [suggestion.name];
  if (suggestion.region) {
    parts.push(suggestion.region);
  }
  if (suggestion.country) {
    parts.push(suggestion.country);
  }
  return `"${parts.join(", ")}"`;
}
