/**
 * File-based cache manager implementation.
 * Stores cached data as JSON files in ~/.weather-oracle/cache/
 */

import { homedir } from "node:os";
import { join, basename } from "node:path";
import {
  readFile,
  writeFile,
  access,
  mkdir,
  readdir,
  unlink,
  rename,
  stat,
} from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { CacheError } from "../errors/cache";
import type {
  CacheManager,
  CacheEntry,
  CacheMetadata,
  CacheStats,
} from "./types";

/**
 * Default TTL in seconds (1 hour - models update every ~6 hours)
 */
const DEFAULT_TTL_SECONDS = 3600;

/**
 * Maximum number of cache entries (to prevent unbounded growth)
 */
const DEFAULT_MAX_ENTRIES = 100;

/**
 * File extension for cache files
 */
const CACHE_FILE_EXTENSION = ".cache.json";

/**
 * Configuration options for FileCacheManager
 */
export interface FileCacheManagerOptions {
  /**
   * Directory for cache files (default: ~/.weather-oracle/cache)
   */
  cacheDir?: string;

  /**
   * Default TTL in seconds (default: 3600)
   */
  defaultTtl?: number;

  /**
   * Maximum number of entries (default: 100)
   */
  maxEntries?: number;

  /**
   * Whether cache is enabled (default: true)
   */
  enabled?: boolean;
}

/**
 * File-based cache manager implementation
 */
export class FileCacheManager implements CacheManager {
  private readonly cacheDir: string;
  private readonly defaultTtl: number;
  private readonly maxEntries: number;
  private readonly enabled: boolean;
  private initialized: boolean = false;
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: FileCacheManagerOptions = {}) {
    this.cacheDir =
      options.cacheDir ?? join(homedir(), ".weather-oracle", "cache");
    this.defaultTtl = options.defaultTtl ?? DEFAULT_TTL_SECONDS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.enabled = options.enabled ?? true;
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized || !this.enabled) {
      return;
    }

    try {
      await mkdir(this.cacheDir, { recursive: true });
      this.initialized = true;
      // Run cleanup on initialization
      await this.cleanup();
    } catch (error) {
      throw CacheError.initError(
        this.cacheDir,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get path for a cache key
   */
  private getFilePath(key: string): string {
    // Sanitize key for use as filename
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    return join(this.cacheDir, `${safeKey}${CACHE_FILE_EXTENSION}`);
  }

  /**
   * Extract key from cache file path
   */
  private getKeyFromPath(filePath: string): string {
    const name = basename(filePath);
    return name.replace(CACHE_FILE_EXTENSION, "");
  }

  /**
   * Read a cache entry from disk
   */
  private async readEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    const filePath = this.getFilePath(key);

    try {
      await access(filePath, constants.R_OK);
      const content = await readFile(filePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry<T>;
      return entry;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      if (error instanceof SyntaxError) {
        // Corrupted cache file - delete it
        try {
          await unlink(filePath);
        } catch {
          // Ignore cleanup errors
        }
        return null;
      }
      throw CacheError.readError(
        key,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Write a cache entry to disk atomically
   */
  private async writeEntry<T>(
    key: string,
    entry: CacheEntry<T>
  ): Promise<void> {
    const filePath = this.getFilePath(key);
    const tempPath = join(tmpdir(), `weather-oracle-${randomUUID()}.tmp`);

    try {
      // Write to temp file first
      const content = JSON.stringify(entry, null, 2);
      await writeFile(tempPath, content, "utf-8");

      // Atomic rename
      await rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw CacheError.writeError(
        key,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      this.misses++;
      return null;
    }

    await this.ensureInitialized();

    const entry = await this.readEntry<T>(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    const now = Date.now();
    if (entry.metadata.expiresAt < now) {
      // Entry expired - delete it
      this.misses++;
      try {
        await unlink(this.getFilePath(key));
      } catch {
        // Ignore cleanup errors
      }
      return null;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Set a value in the cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.ensureInitialized();

    const now = Date.now();
    const ttlSeconds = ttl ?? this.defaultTtl;

    const metadata: CacheMetadata = {
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      key,
    };

    const entry: CacheEntry<T> = {
      data: value,
      metadata,
    };

    await this.writeEntry(key, entry);

    // Enforce max entries limit
    await this.enforceLimit();
  }

  /**
   * Enforce maximum entries limit by removing oldest entries
   */
  private async enforceLimit(): Promise<void> {
    try {
      const files = await readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith(CACHE_FILE_EXTENSION));

      if (cacheFiles.length <= this.maxEntries) {
        return;
      }

      // Get file stats to sort by creation time
      const fileStats = await Promise.all(
        cacheFiles.map(async (file) => {
          const filePath = join(this.cacheDir, file);
          try {
            const stats = await stat(filePath);
            return { file, mtime: stats.mtime.getTime() };
          } catch {
            return { file, mtime: 0 };
          }
        })
      );

      // Sort by modification time (oldest first)
      fileStats.sort((a, b) => a.mtime - b.mtime);

      // Remove oldest entries to get under limit
      const toRemove = fileStats.slice(
        0,
        fileStats.length - this.maxEntries
      );

      await Promise.all(
        toRemove.map(async ({ file }) => {
          try {
            await unlink(join(this.cacheDir, file));
          } catch {
            // Ignore errors
          }
        })
      );
    } catch {
      // Ignore errors during limit enforcement
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidate(pattern: string): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    await this.ensureInitialized();

    try {
      const files = await readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith(CACHE_FILE_EXTENSION));

      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      const regex = new RegExp(`^${regexPattern}$`);

      let count = 0;
      await Promise.all(
        cacheFiles.map(async (file) => {
          const key = this.getKeyFromPath(file);
          if (regex.test(key)) {
            try {
              await unlink(join(this.cacheDir, file));
              count++;
            } catch {
              // Ignore errors
            }
          }
        })
      );

      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.ensureInitialized();

    try {
      const files = await readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith(CACHE_FILE_EXTENSION));

      await Promise.all(
        cacheFiles.map(async (file) => {
          try {
            await unlink(join(this.cacheDir, file));
          } catch {
            // Ignore errors
          }
        })
      );

      this.hits = 0;
      this.misses = 0;
    } catch {
      // Ignore errors
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    await this.ensureInitialized();

    const entry = await this.readEntry(key);

    if (!entry) {
      return false;
    }

    return entry.metadata.expiresAt >= Date.now();
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    if (!this.enabled) {
      return {
        hits: 0,
        misses: 0,
        size: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    await this.ensureInitialized();

    try {
      const files = await readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith(CACHE_FILE_EXTENSION));

      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      for (const file of cacheFiles) {
        try {
          const content = await readFile(
            join(this.cacheDir, file),
            "utf-8"
          );
          const entry = JSON.parse(content) as CacheEntry<unknown>;
          const createdAt = entry.metadata.createdAt;

          if (oldestEntry === null || createdAt < oldestEntry) {
            oldestEntry = createdAt;
          }
          if (newestEntry === null || createdAt > newestEntry) {
            newestEntry = createdAt;
          }
        } catch {
          // Ignore parse errors
        }
      }

      return {
        hits: this.hits,
        misses: this.misses,
        size: cacheFiles.length,
        oldestEntry,
        newestEntry,
      };
    } catch {
      return {
        hits: this.hits,
        misses: this.misses,
        size: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Remove expired entries
   */
  async cleanup(): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    try {
      await access(this.cacheDir, constants.R_OK);
    } catch {
      // Cache directory doesn't exist yet
      return 0;
    }

    try {
      const files = await readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith(CACHE_FILE_EXTENSION));
      const now = Date.now();

      let count = 0;
      await Promise.all(
        cacheFiles.map(async (file) => {
          const filePath = join(this.cacheDir, file);
          try {
            const content = await readFile(filePath, "utf-8");
            const entry = JSON.parse(content) as CacheEntry<unknown>;

            if (entry.metadata.expiresAt < now) {
              await unlink(filePath);
              count++;
            }
          } catch {
            // Corrupted file - remove it
            try {
              await unlink(filePath);
              count++;
            } catch {
              // Ignore
            }
          }
        })
      );

      return count;
    } catch {
      return 0;
    }
  }
}

/**
 * Create a cache manager with configuration
 */
export function createCacheManager(
  options?: FileCacheManagerOptions
): CacheManager {
  return new FileCacheManager(options);
}
