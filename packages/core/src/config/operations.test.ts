/**
 * Tests for config operations (dot-notation access)
 */

import { describe, expect, it } from "bun:test";
import {
  getValidKeys,
  isValidKey,
  getConfigValue,
  getDefaultValue,
  setConfigValue,
  unsetConfigValue,
  parseConfigValue,
  formatConfigValue,
} from "./operations";
import { DEFAULT_CONFIG, type AppConfig } from "./schema";

describe("config operations", () => {
  describe("getValidKeys", () => {
    it("returns all valid configuration keys", () => {
      const keys = getValidKeys();
      expect(keys).toBeArray();
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain("display.units");
      expect(keys).toContain("cache.enabled");
      expect(keys).toContain("models.defaults");
    });
  });

  describe("isValidKey", () => {
    it("returns true for valid keys", () => {
      expect(isValidKey("display.units")).toBe(true);
      expect(isValidKey("cache.ttlSeconds")).toBe(true);
      expect(isValidKey("models.timeout")).toBe(true);
    });

    it("returns false for invalid keys", () => {
      expect(isValidKey("invalid.key")).toBe(false);
      expect(isValidKey("display.invalid")).toBe(false);
      expect(isValidKey("")).toBe(false);
    });
  });

  describe("getConfigValue", () => {
    it("gets nested config values by dot-notation", () => {
      const config: AppConfig = DEFAULT_CONFIG;
      expect(getConfigValue(config, "display.units")).toBe("metric");
      expect(getConfigValue(config, "cache.enabled")).toBe(true);
      expect(getConfigValue(config, "cache.ttlSeconds")).toBe(300);
    });

    it("returns undefined for non-existent keys", () => {
      const config: AppConfig = DEFAULT_CONFIG;
      expect(getConfigValue(config, "invalid.key")).toBeUndefined();
    });

    it("returns array values correctly", () => {
      const config: AppConfig = DEFAULT_CONFIG;
      const models = getConfigValue(config, "models.defaults");
      expect(models).toBeArray();
      expect(models).toContain("ecmwf");
    });
  });

  describe("getDefaultValue", () => {
    it("returns default values for all keys", () => {
      expect(getDefaultValue("display.units")).toBe("metric");
      expect(getDefaultValue("cache.enabled")).toBe(true);
      expect(getDefaultValue("display.colorOutput")).toBe(true);
    });
  });

  describe("setConfigValue", () => {
    it("sets values by dot-notation", () => {
      const config: Partial<AppConfig> = {};
      const updated = setConfigValue(config, "display.units", "imperial");
      expect(getConfigValue(updated as AppConfig, "display.units")).toBe("imperial");
    });

    it("creates nested objects as needed", () => {
      const config: Partial<AppConfig> = {};
      const updated = setConfigValue(config, "cache.ttlSeconds", 600);
      expect((updated as any).cache.ttlSeconds).toBe(600);
    });

    it("preserves existing values", () => {
      const config: Partial<AppConfig> = {
        display: { units: "metric", outputFormat: "table" } as any,
      };
      const updated = setConfigValue(config, "display.units", "imperial");
      expect((updated as any).display.units).toBe("imperial");
      expect((updated as any).display.outputFormat).toBe("table");
    });

    it("returns immutable result (does not modify original)", () => {
      const config: Partial<AppConfig> = { display: { units: "metric" } as any };
      const updated = setConfigValue(config, "display.units", "imperial");
      expect((config as any).display.units).toBe("metric");
      expect((updated as any).display.units).toBe("imperial");
    });
  });

  describe("unsetConfigValue", () => {
    it("removes values by dot-notation", () => {
      const config: Partial<AppConfig> = {
        display: { units: "imperial" } as any,
      };
      const updated = unsetConfigValue(config, "display.units");
      expect((updated as any).display?.units).toBeUndefined();
    });

    it("cleans up empty parent objects", () => {
      const config: Partial<AppConfig> = {
        display: { units: "imperial" } as any,
      };
      const updated = unsetConfigValue(config, "display.units");
      // Empty display object should be removed
      expect((updated as any).display).toBeUndefined();
    });

    it("returns immutable result", () => {
      const config: Partial<AppConfig> = {
        display: { units: "imperial" } as any,
      };
      // Call unset - should not modify original
      unsetConfigValue(config, "display.units");
      // Original config should be unchanged
      expect((config as any).display.units).toBe("imperial");
    });
  });

  describe("parseConfigValue", () => {
    it("parses boolean values", () => {
      expect(parseConfigValue("cache.enabled", "true")).toBe(true);
      expect(parseConfigValue("cache.enabled", "false")).toBe(false);
      expect(parseConfigValue("cache.enabled", "yes")).toBe(true);
      expect(parseConfigValue("cache.enabled", "no")).toBe(false);
      expect(parseConfigValue("cache.enabled", "1")).toBe(true);
      expect(parseConfigValue("cache.enabled", "0")).toBe(false);
    });

    it("parses number values", () => {
      expect(parseConfigValue("cache.ttlSeconds", "600")).toBe(600);
      expect(parseConfigValue("models.timeout", "5000")).toBe(5000);
    });

    it("validates number ranges", () => {
      expect(() => parseConfigValue("models.retries", "10")).toThrow("at most 5");
      expect(() => parseConfigValue("cache.ttlSeconds", "-1")).toThrow("at least 0");
    });

    it("parses enum values", () => {
      expect(parseConfigValue("display.units", "metric")).toBe("metric");
      expect(parseConfigValue("display.units", "imperial")).toBe("imperial");
    });

    it("validates enum values", () => {
      expect(() => parseConfigValue("display.units", "invalid")).toThrow("Must be one of");
    });

    it("parses array values", () => {
      const result = parseConfigValue("models.defaults", "ecmwf,gfs,icon");
      expect(result).toEqual(["ecmwf", "gfs", "icon"]);
    });

    it("parses string values", () => {
      expect(parseConfigValue("api.forecast", "https://example.com")).toBe("https://example.com");
    });

    it("throws for unknown keys", () => {
      expect(() => parseConfigValue("invalid.key", "value")).toThrow("Unknown configuration key");
    });
  });

  describe("formatConfigValue", () => {
    it("formats primitive values", () => {
      expect(formatConfigValue("metric")).toBe("metric");
      expect(formatConfigValue(true)).toBe("true");
      expect(formatConfigValue(300)).toBe("300");
    });

    it("formats array values", () => {
      expect(formatConfigValue(["ecmwf", "gfs"])).toBe("ecmwf, gfs");
    });

    it("handles undefined/null", () => {
      expect(formatConfigValue(undefined)).toBe("(not set)");
      expect(formatConfigValue(null)).toBe("(not set)");
    });
  });
});
