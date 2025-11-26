/**
 * Cache-specific error classes.
 */

import { WeatherOracleError, ErrorCode, type ErrorDebugInfo } from "./base";

/**
 * Error thrown when cache operations fail.
 */
export class CacheError extends WeatherOracleError {
  readonly cacheKey?: string;
  readonly cachePath?: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    options?: {
      cacheKey?: string;
      cachePath?: string;
      debugInfo?: Omit<ErrorDebugInfo, "timestamp">;
    }
  ) {
    super(code, message, userMessage, options?.debugInfo);
    this.name = "CacheError";
    this.cacheKey = options?.cacheKey;
    this.cachePath = options?.cachePath;
  }

  /**
   * Create a read error
   */
  static readError(
    cacheKey: string,
    cause?: Error
  ): CacheError {
    return new CacheError(
      ErrorCode.CACHE_READ_ERROR,
      `Failed to read cache for key "${cacheKey}": ${cause?.message ?? "Unknown error"}`,
      "Failed to read cached data. Fetching fresh data.",
      {
        cacheKey,
        debugInfo: {
          cacheKey,
          originalError: cause?.message,
          originalStack: cause?.stack,
        },
      }
    );
  }

  /**
   * Create a write error
   */
  static writeError(
    cacheKey: string,
    cause?: Error
  ): CacheError {
    return new CacheError(
      ErrorCode.CACHE_WRITE_ERROR,
      `Failed to write cache for key "${cacheKey}": ${cause?.message ?? "Unknown error"}`,
      "Failed to save data to cache. Data will need to be fetched again next time.",
      {
        cacheKey,
        debugInfo: {
          cacheKey,
          originalError: cause?.message,
          originalStack: cause?.stack,
        },
      }
    );
  }

  /**
   * Create an expired cache error
   */
  static expired(
    cacheKey: string,
    expiredAt: Date
  ): CacheError {
    return new CacheError(
      ErrorCode.CACHE_EXPIRED,
      `Cache expired for key "${cacheKey}" at ${expiredAt.toISOString()}`,
      "Cached data has expired. Fetching fresh data.",
      {
        cacheKey,
        debugInfo: {
          cacheKey,
          expiredAt: expiredAt.toISOString(),
        },
      }
    );
  }

  /**
   * Create a corrupted cache error
   */
  static corrupted(
    cacheKey: string,
    reason: string,
    cachePath?: string
  ): CacheError {
    return new CacheError(
      ErrorCode.CACHE_CORRUPTED,
      `Corrupted cache for key "${cacheKey}": ${reason}`,
      "Cache data is corrupted. Clearing cache and fetching fresh data.",
      {
        cacheKey,
        cachePath,
        debugInfo: {
          cacheKey,
          reason,
          cachePath,
        },
      }
    );
  }

  /**
   * Create a cache initialization error
   */
  static initError(
    cachePath: string,
    cause?: Error
  ): CacheError {
    return new CacheError(
      ErrorCode.CACHE_WRITE_ERROR,
      `Failed to initialize cache at "${cachePath}": ${cause?.message ?? "Unknown error"}`,
      "Failed to initialize cache. Running without caching.",
      {
        cachePath,
        debugInfo: {
          cachePath,
          originalError: cause?.message,
          originalStack: cause?.stack,
        },
      }
    );
  }
}
