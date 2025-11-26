/**
 * Cache layer types and interfaces.
 * Defines the contract for cache operations.
 */

/**
 * Cache entry metadata stored alongside cached values
 */
export interface CacheMetadata {
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly key: string;
}

/**
 * Cache entry with data and metadata
 */
export interface CacheEntry<T> {
  readonly data: T;
  readonly metadata: CacheMetadata;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /**
   * Time-to-live in seconds (default: from config or 3600)
   */
  readonly ttl?: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly oldestEntry: number | null;
  readonly newestEntry: number | null;
}

/**
 * Cache manager interface for interacting with the cache layer
 */
export interface CacheManager {
  /**
   * Get a cached value by key
   * Returns null if not found or expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional TTL in seconds (overrides default)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Invalidate cache entries matching a pattern
   * Supports glob patterns (e.g., "ecmwf_*")
   */
  invalidate(pattern: string): Promise<number>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): Promise<boolean>;

  /**
   * Get cache statistics
   */
  stats(): Promise<CacheStats>;

  /**
   * Remove expired entries
   * Called automatically on startup and periodically
   */
  cleanup(): Promise<number>;
}

/**
 * Generate a cache key for forecast data
 * Format: {lat}_{lon}_{model}_{date}
 */
export function createForecastCacheKey(
  lat: number,
  lon: number,
  model: string,
  date: Date
): string {
  // Round coordinates to 2 decimal places for cache key stability
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const dateStr = date.toISOString().split("T")[0];
  return `${roundedLat}_${roundedLon}_${model}_${dateStr}`;
}

/**
 * Parse a forecast cache key back to components
 */
export function parseForecastCacheKey(key: string): {
  lat: number;
  lon: number;
  model: string;
  date: string;
} | null {
  const parts = key.split("_");
  if (parts.length !== 4) {
    return null;
  }
  const lat = parseFloat(parts[0]!);
  const lon = parseFloat(parts[1]!);
  const model = parts[2]!;
  const date = parts[3]!;

  if (isNaN(lat) || isNaN(lon)) {
    return null;
  }

  return { lat, lon, model, date };
}
