/**
 * CLI error handler for Weather Oracle.
 * Formats errors nicely for terminal display.
 */

import {
  WeatherOracleError,
  GeocodingError,
  ApiError,
  ConfigError,
  CacheError,
  ErrorCode,
  isWeatherOracleError,
  isGeocodingError,
  isApiError,
  isConfigError,
  isCacheError,
} from "@weather-oracle/core";

/**
 * CLI options that affect error display
 */
export interface ErrorDisplayOptions {
  verbose: boolean;
  noColor?: boolean;
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

/**
 * Get color function based on options
 */
function getColors(noColor?: boolean): typeof colors {
  if (noColor || process.env["NO_COLOR"]) {
    return {
      red: "",
      yellow: "",
      cyan: "",
      dim: "",
      reset: "",
    };
  }
  return colors;
}

/**
 * Format an error for CLI display
 */
export function formatError(
  error: unknown,
  options: ErrorDisplayOptions = { verbose: false }
): string {
  const c = getColors(options.noColor);
  const lines: string[] = [];

  if (isWeatherOracleError(error)) {
    lines.push(formatWeatherOracleError(error, options, c));
  } else if (error instanceof Error) {
    lines.push(`${c.red}❌ Error:${c.reset} ${error.message}`);
    if (options.verbose && error.stack) {
      lines.push("");
      lines.push(`${c.dim}${error.stack}${c.reset}`);
    }
  } else {
    lines.push(`${c.red}❌ Error:${c.reset} ${String(error)}`);
  }

  // Add verbose hint if not in verbose mode
  if (!options.verbose && isWeatherOracleError(error) && error.debugInfo) {
    lines.push("");
    lines.push(`${c.dim}   Run with --verbose for more details.${c.reset}`);
  }

  return lines.join("\n");
}

/**
 * Format a WeatherOracleError for display
 */
function formatWeatherOracleError(
  error: WeatherOracleError,
  options: ErrorDisplayOptions,
  c: typeof colors
): string {
  const lines: string[] = [];

  // Main error message
  lines.push(`${c.red}❌ ${error.userMessage}${c.reset}`);

  // Additional context based on error type
  if (isGeocodingError(error)) {
    formatGeocodingContext(error, lines, c);
  } else if (isApiError(error)) {
    formatApiContext(error, lines, c);
  } else if (isConfigError(error)) {
    formatConfigContext(error, lines, c);
  } else if (isCacheError(error)) {
    formatCacheContext(error, lines, c);
  }

  // Verbose output
  if (options.verbose) {
    lines.push("");
    lines.push(`${c.dim}Error code: ${error.code}${c.reset}`);
    lines.push(`${c.dim}Technical: ${error.message}${c.reset}`);

    if (error.debugInfo) {
      lines.push("");
      lines.push(`${c.dim}Debug info:${c.reset}`);
      const debugLines = JSON.stringify(error.debugInfo, null, 2).split("\n");
      for (const line of debugLines) {
        lines.push(`${c.dim}  ${line}${c.reset}`);
      }
    }

    if (error.stack) {
      lines.push("");
      lines.push(`${c.dim}Stack trace:${c.reset}`);
      const stackLines = error.stack.split("\n").slice(1);
      for (const line of stackLines) {
        lines.push(`${c.dim}${line}${c.reset}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format geocoding-specific context
 */
function formatGeocodingContext(
  error: GeocodingError,
  lines: string[],
  c: typeof colors
): void {
  if (error.suggestions && error.suggestions.length > 0) {
    lines.push("");
    lines.push(`${c.cyan}   Did you mean:${c.reset}`);
    for (const suggestion of error.suggestions.slice(0, 3)) {
      const location = formatLocation(suggestion);
      lines.push(`${c.cyan}   • ${location}${c.reset}`);
    }
  }

  // Provide helpful hints based on error code
  if (error.code === ErrorCode.GEOCODING_NOT_FOUND) {
    lines.push("");
    lines.push(`${c.dim}   Tip: Try including the country name, e.g., "Paris, France"${c.reset}`);
  }
}

/**
 * Format API-specific context
 */
function formatApiContext(
  error: ApiError,
  lines: string[],
  c: typeof colors
): void {
  if (error.model) {
    lines.push(`${c.dim}   Model: ${error.model}${c.reset}`);
  }

  // Provide recovery hints
  switch (error.code) {
    case ErrorCode.API_RATE_LIMIT:
      lines.push("");
      lines.push(`${c.yellow}   Tip: Wait a moment before trying again.${c.reset}`);
      break;
    case ErrorCode.API_TIMEOUT:
      lines.push("");
      lines.push(`${c.yellow}   Tip: Check your internet connection and try again.${c.reset}`);
      break;
    case ErrorCode.API_AUTH_FAILED:
      lines.push("");
      lines.push(`${c.yellow}   Tip: Check your API key configuration.${c.reset}`);
      break;
  }
}

/**
 * Format config-specific context
 */
function formatConfigContext(
  error: ConfigError,
  lines: string[],
  c: typeof colors
): void {
  if (error.configKey) {
    lines.push(`${c.dim}   Configuration key: ${error.configKey}${c.reset}`);
  }
  if (error.filePath) {
    lines.push(`${c.dim}   File: ${error.filePath}${c.reset}`);
  }

  // Provide helpful hints
  if (error.code === ErrorCode.CONFIG_MISSING) {
    lines.push("");
    lines.push(`${c.yellow}   Tip: Run 'weather-oracle config' to set up your configuration.${c.reset}`);
  }
}

/**
 * Format cache-specific context
 */
function formatCacheContext(
  error: CacheError,
  lines: string[],
  c: typeof colors
): void {
  if (error.cacheKey) {
    lines.push(`${c.dim}   Cache key: ${error.cacheKey}${c.reset}`);
  }

  // Cache errors are usually recoverable, so be reassuring
  if (error.code === ErrorCode.CACHE_CORRUPTED) {
    lines.push("");
    lines.push(`${c.yellow}   The cache will be rebuilt automatically.${c.reset}`);
  }
}

/**
 * Format a location suggestion for display
 */
function formatLocation(suggestion: { name: string; region?: string; country?: string }): string {
  const parts = [suggestion.name];
  if (suggestion.region) {
    parts.push(suggestion.region);
  }
  if (suggestion.country) {
    parts.push(suggestion.country);
  }
  return parts.join(", ");
}

/**
 * Handle an error in the CLI and exit with appropriate code
 */
export function handleError(
  error: unknown,
  options: ErrorDisplayOptions = { verbose: false }
): never {
  console.error(formatError(error, options));

  // Determine exit code based on error type
  let exitCode = 1;
  if (isWeatherOracleError(error)) {
    switch (error.code) {
      case ErrorCode.GEOCODING_NOT_FOUND:
      case ErrorCode.GEOCODING_AMBIGUOUS:
      case ErrorCode.GEOCODING_INVALID_INPUT:
        exitCode = 2; // User input error
        break;
      case ErrorCode.CONFIG_INVALID:
      case ErrorCode.CONFIG_MISSING:
      case ErrorCode.CONFIG_PARSE_ERROR:
        exitCode = 3; // Configuration error
        break;
      case ErrorCode.API_RATE_LIMIT:
      case ErrorCode.API_TIMEOUT:
      case ErrorCode.API_UNAVAILABLE:
        exitCode = 4; // Transient error (retry might help)
        break;
      case ErrorCode.API_AUTH_FAILED:
        exitCode = 5; // Auth error
        break;
      default:
        exitCode = 1; // General error
    }
  }

  process.exit(exitCode);
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  options: ErrorDisplayOptions = { verbose: false }
): (...args: T) => Promise<void> {
  return async (...args: T): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error, options);
    }
  };
}
