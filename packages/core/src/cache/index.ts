/**
 * Cache layer module for Weather Oracle.
 * Provides file-based caching to reduce redundant API calls.
 */

// Types and interfaces
export type {
  CacheManager,
  CacheEntry,
  CacheMetadata,
  CacheOptions,
  CacheStats,
} from "./types";

export { createForecastCacheKey, parseForecastCacheKey } from "./types";

// File-based cache implementation
export {
  FileCacheManager,
  createCacheManager,
  type FileCacheManagerOptions,
} from "./file-cache";
