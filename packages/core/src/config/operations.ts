/**
 * Configuration operations for dot-notation access.
 * Provides get, set, unset, and list operations for config values.
 */

import type { AppConfig } from "./schema";
import { appConfigSchema, DEFAULT_CONFIG } from "./schema";

/**
 * Valid configuration keys with their types and constraints
 */
export const CONFIG_KEYS = {
  "api.forecast": { type: "string", description: "Forecast API endpoint URL" },
  "api.geocoding": { type: "string", description: "Geocoding API endpoint URL" },
  "cache.enabled": { type: "boolean", description: "Enable/disable caching" },
  "cache.ttlSeconds": { type: "number", description: "Cache TTL in seconds (0-86400)", min: 0, max: 86400 },
  "cache.maxEntries": { type: "number", description: "Maximum cache entries", min: 1 },
  "cache.directory": { type: "string", description: "Cache directory path" },
  "models.defaults": { type: "array", description: "Default models (comma-separated)" },
  "models.timeout": { type: "number", description: "API timeout in ms (1000-60000)", min: 1000, max: 60000 },
  "models.retries": { type: "number", description: "Number of retries (0-5)", min: 0, max: 5 },
  "display.units": { type: "enum", values: ["metric", "imperial"], description: "Temperature units" },
  "display.outputFormat": { type: "enum", values: ["json", "table", "minimal", "rich"], description: "Output format" },
  "display.showConfidence": { type: "boolean", description: "Show confidence indicators" },
  "display.showModelDetails": { type: "boolean", description: "Show model details in output" },
  "display.colorOutput": { type: "boolean", description: "Enable colored output" },
} as const;

export type ConfigKey = keyof typeof CONFIG_KEYS;

/**
 * Get all valid configuration keys
 */
export function getValidKeys(): ConfigKey[] {
  return Object.keys(CONFIG_KEYS) as ConfigKey[];
}

/**
 * Check if a key is valid
 */
export function isValidKey(key: string): key is ConfigKey {
  return key in CONFIG_KEYS;
}

/**
 * Get configuration value by dot-notation key
 */
export function getConfigValue(config: AppConfig, key: string): unknown {
  const parts = key.split(".");
  let value: unknown = config;

  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== "object") {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

/**
 * Get default value for a configuration key
 */
export function getDefaultValue(key: string): unknown {
  return getConfigValue(DEFAULT_CONFIG, key);
}

/**
 * Set configuration value by dot-notation key
 * Returns a new config object (immutable)
 */
export function setConfigValue(
  config: Partial<AppConfig>,
  key: string,
  value: unknown
): Partial<AppConfig> {
  const parts = key.split(".");
  const result = structuredClone(config);

  let current: Record<string, unknown> = result as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;

  return result;
}

/**
 * Unset (remove) a configuration value by dot-notation key
 * Returns a new config object (immutable)
 */
export function unsetConfigValue(
  config: Partial<AppConfig>,
  key: string
): Partial<AppConfig> {
  const parts = key.split(".");
  const result = structuredClone(config);

  let current: Record<string, unknown> = result as Record<string, unknown>;
  const parents: Array<{ obj: Record<string, unknown>; key: string }> = [];

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      return result; // Key doesn't exist
    }
    parents.push({ obj: current, key: part });
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  delete current[lastPart];

  // Clean up empty parent objects
  for (let i = parents.length - 1; i >= 0; i--) {
    const { obj, key: parentKey } = parents[i];
    const child = obj[parentKey] as Record<string, unknown>;
    if (Object.keys(child).length === 0) {
      delete obj[parentKey];
    } else {
      break;
    }
  }

  return result;
}

/**
 * Parse a string value into the appropriate type for a config key
 */
export function parseConfigValue(key: string, value: string): unknown {
  if (!isValidKey(key)) {
    throw new Error(`Unknown configuration key: ${key}`);
  }

  const keyInfo = CONFIG_KEYS[key];

  switch (keyInfo.type) {
    case "boolean":
      if (value === "true" || value === "1" || value === "yes") return true;
      if (value === "false" || value === "0" || value === "no") return false;
      throw new Error(`Invalid boolean value: "${value}". Use true/false, yes/no, or 1/0`);

    case "number": {
      const num = parseInt(value, 10);
      if (isNaN(num)) {
        throw new Error(`Invalid number value: "${value}"`);
      }
      if ("min" in keyInfo && num < keyInfo.min) {
        throw new Error(`Value must be at least ${keyInfo.min}`);
      }
      if ("max" in keyInfo && num > keyInfo.max) {
        throw new Error(`Value must be at most ${keyInfo.max}`);
      }
      return num;
    }

    case "enum":
      if (!keyInfo.values.includes(value as never)) {
        throw new Error(`Invalid value: "${value}". Must be one of: ${keyInfo.values.join(", ")}`);
      }
      return value;

    case "array":
      return value.split(",").map((v) => v.trim());

    case "string":
    default:
      return value;
  }
}

/**
 * Validate a partial config object against the schema
 */
export function validatePartialConfig(config: Partial<AppConfig>): {
  valid: boolean;
  errors: string[];
} {
  // Merge with defaults to get a complete config for validation
  const merged = {
    ...DEFAULT_CONFIG,
    ...config,
    api: { ...DEFAULT_CONFIG.api, ...config.api },
    cache: { ...DEFAULT_CONFIG.cache, ...config.cache },
    models: { ...DEFAULT_CONFIG.models, ...config.models },
    display: { ...DEFAULT_CONFIG.display, ...config.display },
  };

  const result = appConfigSchema.safeParse(merged);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Flatten config into key-value pairs for display
 */
export function flattenConfig(
  config: AppConfig,
  fileConfig: Partial<AppConfig> = {}
): Array<{ key: ConfigKey; value: unknown; source: "default" | "file" | "env" }> {
  const entries: Array<{ key: ConfigKey; value: unknown; source: "default" | "file" | "env" }> = [];

  for (const key of getValidKeys()) {
    const value = getConfigValue(config, key);
    const fileValue = getConfigValue(fileConfig as AppConfig, key);
    const defaultValue = getDefaultValue(key);

    // Determine source
    let source: "default" | "file" | "env" = "default";
    if (fileValue !== undefined && JSON.stringify(fileValue) !== JSON.stringify(defaultValue)) {
      source = "file";
    }
    // Note: Environment overrides would require tracking in loader

    entries.push({ key, value, source });
  }

  return entries;
}

/**
 * Format a config value for display
 */
export function formatConfigValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "(not set)";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
