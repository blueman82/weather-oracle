/**
 * Base error class for all Weather Oracle errors.
 * Provides structured error information with user-friendly messages and debug info.
 */

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
  // Geocoding errors (1xxx)
  GEOCODING_NOT_FOUND = "GEOCODING_NOT_FOUND",
  GEOCODING_AMBIGUOUS = "GEOCODING_AMBIGUOUS",
  GEOCODING_INVALID_INPUT = "GEOCODING_INVALID_INPUT",
  GEOCODING_SERVICE_ERROR = "GEOCODING_SERVICE_ERROR",

  // API errors (2xxx)
  API_RATE_LIMIT = "API_RATE_LIMIT",
  API_TIMEOUT = "API_TIMEOUT",
  API_UNAVAILABLE = "API_UNAVAILABLE",
  API_INVALID_RESPONSE = "API_INVALID_RESPONSE",
  API_AUTH_FAILED = "API_AUTH_FAILED",

  // Config errors (3xxx)
  CONFIG_INVALID = "CONFIG_INVALID",
  CONFIG_MISSING = "CONFIG_MISSING",
  CONFIG_PARSE_ERROR = "CONFIG_PARSE_ERROR",

  // Cache errors (4xxx)
  CACHE_READ_ERROR = "CACHE_READ_ERROR",
  CACHE_WRITE_ERROR = "CACHE_WRITE_ERROR",
  CACHE_EXPIRED = "CACHE_EXPIRED",
  CACHE_CORRUPTED = "CACHE_CORRUPTED",

  // General errors (9xxx)
  UNKNOWN = "UNKNOWN",
  INTERNAL = "INTERNAL",
}

/**
 * Debug information that can be attached to errors
 */
export interface ErrorDebugInfo {
  readonly timestamp: Date;
  readonly [key: string]: unknown;
}

/**
 * Base error class for all Weather Oracle errors.
 * Provides a standardized structure with:
 * - Error code for programmatic handling
 * - User-friendly message for display
 * - Optional debug info for troubleshooting
 */
export class WeatherOracleError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly debugInfo?: ErrorDebugInfo;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    debugInfo?: Omit<ErrorDebugInfo, "timestamp">
  ) {
    super(message);
    this.name = "WeatherOracleError";
    this.code = code;
    this.userMessage = userMessage;
    this.debugInfo = debugInfo
      ? { ...debugInfo, timestamp: new Date() }
      : undefined;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Check if an error is a WeatherOracleError
   */
  static isWeatherOracleError(error: unknown): error is WeatherOracleError {
    return error instanceof WeatherOracleError;
  }

  /**
   * Create a WeatherOracleError from an unknown error
   */
  static fromUnknown(error: unknown): WeatherOracleError {
    if (error instanceof WeatherOracleError) {
      return error;
    }

    if (error instanceof Error) {
      return new WeatherOracleError(
        ErrorCode.UNKNOWN,
        error.message,
        "An unexpected error occurred. Please try again.",
        { originalError: error.name, originalStack: error.stack }
      );
    }

    return new WeatherOracleError(
      ErrorCode.UNKNOWN,
      String(error),
      "An unexpected error occurred. Please try again.",
      { originalValue: error }
    );
  }

  /**
   * Format the error for logging
   */
  toLogFormat(): string {
    const parts = [
      `[${this.code}] ${this.message}`,
      `User message: ${this.userMessage}`,
    ];

    if (this.debugInfo) {
      parts.push(`Debug info: ${JSON.stringify(this.debugInfo, null, 2)}`);
    }

    if (this.stack) {
      parts.push(`Stack trace:\n${this.stack}`);
    }

    return parts.join("\n");
  }
}
