/**
 * Error handling module for Weather Oracle.
 * Exports all error classes and utilities.
 */

// Base error class and types
export {
  WeatherOracleError,
  ErrorCode,
  type ErrorDebugInfo,
} from "./base";

// Specific error classes
export { GeocodingError, type LocationSuggestion } from "./geocoding";
export { ApiError } from "./api";
export { ConfigError } from "./config";
export { CacheError } from "./cache";

/**
 * Type guard to check if an error is any Weather Oracle error
 */
export function isWeatherOracleError(error: unknown): error is WeatherOracleError {
  return error instanceof WeatherOracleError;
}

/**
 * Type guard for GeocodingError
 */
export function isGeocodingError(error: unknown): error is GeocodingError {
  return error instanceof GeocodingError;
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard for ConfigError
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

/**
 * Type guard for CacheError
 */
export function isCacheError(error: unknown): error is CacheError {
  return error instanceof CacheError;
}

// Import classes for type guards
import { WeatherOracleError } from "./base";
import { GeocodingError } from "./geocoding";
import { ApiError } from "./api";
import { ConfigError } from "./config";
import { CacheError } from "./cache";
