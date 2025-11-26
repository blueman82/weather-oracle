/**
 * Tests for the file-based cache layer.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdir, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { FileCacheManager, createCacheManager } from "./file-cache";
import { createForecastCacheKey, parseForecastCacheKey } from "./types";

/**
 * Create a temporary cache directory for testing
 */
function createTempCacheDir(): string {
  return join(tmpdir(), `weather-oracle-cache-test-${randomUUID()}`);
}

describe("FileCacheManager", () => {
  let cacheDir: string;
  let cache: FileCacheManager;

  beforeEach(async () => {
    cacheDir = createTempCacheDir();
    await mkdir(cacheDir, { recursive: true });
    cache = new FileCacheManager({ cacheDir, enabled: true });
  });

  afterEach(async () => {
    try {
      await rm(cacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("constructor", () => {
    it("should accept enabled option for cache bypass", () => {
      const disabledCache = new FileCacheManager({ enabled: false });
      expect(disabledCache).toBeInstanceOf(FileCacheManager);
    });

    it("should default to enabled when not specified", () => {
      const defaultCache = new FileCacheManager({ cacheDir });
      expect(defaultCache).toBeInstanceOf(FileCacheManager);
    });
  });

  describe("get/set operations", () => {
    it("should return null for non-existent key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should store and retrieve a value", async () => {
      const testData = { temperature: 25, humidity: 60 };
      await cache.set("test-key", testData);
      const result = await cache.get<typeof testData>("test-key");
      expect(result).toEqual(testData);
    });

    it("should store and retrieve complex objects", async () => {
      const testData = {
        forecast: {
          hourly: [{ temp: 20 }, { temp: 22 }],
          daily: [{ high: 25, low: 15 }],
        },
        metadata: {
          model: "ecmwf",
          timestamp: new Date().toISOString(),
        },
      };
      await cache.set("complex-key", testData);
      const result = await cache.get<typeof testData>("complex-key");
      expect(result).toEqual(testData);
    });

    it("should return null for expired entries", async () => {
      await cache.set("expiring-key", { data: "test" }, 0); // 0 second TTL
      // Wait a tiny bit to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await cache.get("expiring-key");
      expect(result).toBeNull();
    });

    it("should respect custom TTL", async () => {
      await cache.set("ttl-key", { data: "test" }, 3600); // 1 hour TTL
      const result = await cache.get("ttl-key");
      expect(result).toEqual({ data: "test" });
    });
  });

  describe("cache bypass when disabled", () => {
    it("should return null on get when disabled", async () => {
      const disabledCache = new FileCacheManager({
        cacheDir,
        enabled: false,
      });
      await disabledCache.set("test", { data: "value" });
      const result = await disabledCache.get("test");
      expect(result).toBeNull();
    });

    it("should not write files when disabled", async () => {
      const disabledCacheDir = createTempCacheDir();
      await mkdir(disabledCacheDir, { recursive: true });

      const disabledCache = new FileCacheManager({
        cacheDir: disabledCacheDir,
        enabled: false,
      });

      await disabledCache.set("test", { data: "value" });
      const files = await readdir(disabledCacheDir);
      expect(files.filter((f) => f.endsWith(".cache.json"))).toHaveLength(0);

      await rm(disabledCacheDir, { recursive: true, force: true });
    });

    it("should return false for has() when disabled", async () => {
      const disabledCache = new FileCacheManager({
        cacheDir,
        enabled: false,
      });
      const result = await disabledCache.has("any-key");
      expect(result).toBe(false);
    });

    it("should return empty stats when disabled", async () => {
      const disabledCache = new FileCacheManager({
        cacheDir,
        enabled: false,
      });
      const stats = await disabledCache.stats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("has()", () => {
    it("should return false for non-existent key", async () => {
      const result = await cache.has("nonexistent");
      expect(result).toBe(false);
    });

    it("should return true for existing key", async () => {
      await cache.set("existing-key", { data: "test" });
      const result = await cache.has("existing-key");
      expect(result).toBe(true);
    });

    it("should return false for expired key", async () => {
      await cache.set("expired-key", { data: "test" }, 0);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await cache.has("expired-key");
      expect(result).toBe(false);
    });
  });

  describe("invalidate()", () => {
    it("should remove entries matching exact pattern", async () => {
      await cache.set("prefix_123", { data: "a" });
      await cache.set("prefix_456", { data: "b" });
      await cache.set("other_789", { data: "c" });

      const removed = await cache.invalidate("prefix_123");
      expect(removed).toBe(1);
      expect(await cache.has("prefix_123")).toBe(false);
      expect(await cache.has("prefix_456")).toBe(true);
      expect(await cache.has("other_789")).toBe(true);
    });

    it("should remove entries matching wildcard pattern", async () => {
      await cache.set("prefix_123", { data: "a" });
      await cache.set("prefix_456", { data: "b" });
      await cache.set("other_789", { data: "c" });

      const removed = await cache.invalidate("prefix_*");
      expect(removed).toBe(2);
      expect(await cache.has("prefix_123")).toBe(false);
      expect(await cache.has("prefix_456")).toBe(false);
      expect(await cache.has("other_789")).toBe(true);
    });

    it("should return 0 when no entries match", async () => {
      await cache.set("test_key", { data: "a" });
      const removed = await cache.invalidate("nonexistent_*");
      expect(removed).toBe(0);
    });
  });

  describe("clear()", () => {
    it("should remove all cache entries", async () => {
      await cache.set("key1", { data: "a" });
      await cache.set("key2", { data: "b" });
      await cache.set("key3", { data: "c" });

      await cache.clear();

      expect(await cache.has("key1")).toBe(false);
      expect(await cache.has("key2")).toBe(false);
      expect(await cache.has("key3")).toBe(false);
    });

    it("should reset hit/miss counters", async () => {
      await cache.set("key", { data: "test" });
      await cache.get("key"); // hit
      await cache.get("nonexistent"); // miss

      await cache.clear();
      const stats = await cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("cleanup()", () => {
    it("should remove expired entries", async () => {
      await cache.set("expired1", { data: "a" }, 0);
      await cache.set("expired2", { data: "b" }, 0);
      await cache.set("valid", { data: "c" }, 3600);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const removed = await cache.cleanup();

      expect(removed).toBe(2);
      expect(await cache.has("valid")).toBe(true);
    });

    it("should return 0 when no entries are expired", async () => {
      await cache.set("valid1", { data: "a" }, 3600);
      await cache.set("valid2", { data: "b" }, 3600);

      const removed = await cache.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe("stats()", () => {
    it("should track hits and misses", async () => {
      await cache.set("key", { data: "test" });
      await cache.get("key"); // hit
      await cache.get("key"); // hit
      await cache.get("nonexistent"); // miss

      const stats = await cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it("should report correct size", async () => {
      await cache.set("key1", { data: "a" });
      await cache.set("key2", { data: "b" });
      await cache.set("key3", { data: "c" });

      const stats = await cache.stats();
      expect(stats.size).toBe(3);
    });

    it("should track oldest and newest entries", async () => {
      const beforeFirst = Date.now();
      await cache.set("first", { data: "a" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await cache.set("second", { data: "b" });
      const afterSecond = Date.now();

      const stats = await cache.stats();
      expect(stats.oldestEntry).not.toBeNull();
      expect(stats.newestEntry).not.toBeNull();
      expect(stats.oldestEntry!).toBeGreaterThanOrEqual(beforeFirst);
      expect(stats.newestEntry!).toBeLessThanOrEqual(afterSecond);
      expect(stats.oldestEntry!).toBeLessThanOrEqual(stats.newestEntry!);
    });
  });

  describe("max entries limit", () => {
    it("should enforce maximum entries limit", async () => {
      const limitedCache = new FileCacheManager({
        cacheDir,
        maxEntries: 3,
        enabled: true,
      });

      await limitedCache.set("key1", { data: "a" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await limitedCache.set("key2", { data: "b" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await limitedCache.set("key3", { data: "c" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await limitedCache.set("key4", { data: "d" });

      const stats = await limitedCache.stats();
      expect(stats.size).toBeLessThanOrEqual(3);
    });
  });
});

describe("createCacheManager", () => {
  it("should create a FileCacheManager instance", () => {
    const manager = createCacheManager({ enabled: false });
    expect(manager).toBeDefined();
  });

  it("should accept FileCacheManagerOptions", () => {
    const manager = createCacheManager({
      enabled: true,
      defaultTtl: 7200,
      maxEntries: 50,
    });
    expect(manager).toBeDefined();
  });
});

describe("Cache key utilities", () => {
  describe("createForecastCacheKey", () => {
    it("should create a properly formatted cache key", () => {
      const key = createForecastCacheKey(
        51.5074,
        -0.1278,
        "ecmwf",
        new Date("2024-01-15")
      );
      expect(key).toBe("51.51_-0.13_ecmwf_2024-01-15");
    });

    it("should round coordinates to 2 decimal places", () => {
      const key = createForecastCacheKey(
        51.50739,
        -0.12775,
        "gfs",
        new Date("2024-06-20")
      );
      expect(key).toBe("51.51_-0.13_gfs_2024-06-20");
    });

    it("should handle negative coordinates", () => {
      const key = createForecastCacheKey(
        -33.8688,
        151.2093,
        "icon",
        new Date("2024-12-25")
      );
      expect(key).toBe("-33.87_151.21_icon_2024-12-25");
    });
  });

  describe("parseForecastCacheKey", () => {
    it("should parse a valid cache key", () => {
      const result = parseForecastCacheKey("51.51_-0.13_ecmwf_2024-01-15");
      expect(result).toEqual({
        lat: 51.51,
        lon: -0.13,
        model: "ecmwf",
        date: "2024-01-15",
      });
    });

    it("should return null for invalid key format", () => {
      expect(parseForecastCacheKey("invalid")).toBeNull();
      expect(parseForecastCacheKey("a_b_c")).toBeNull();
      expect(parseForecastCacheKey("")).toBeNull();
    });

    it("should return null for non-numeric coordinates", () => {
      expect(parseForecastCacheKey("abc_def_ecmwf_2024-01-15")).toBeNull();
    });

    it("should handle negative coordinates", () => {
      const result = parseForecastCacheKey("-33.87_151.21_icon_2024-12-25");
      expect(result).toEqual({
        lat: -33.87,
        lon: 151.21,
        model: "icon",
        date: "2024-12-25",
      });
    });
  });
});
