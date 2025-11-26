/**
 * Configuration loader with priority-based source merging.
 *
 * Priority order (highest to lowest):
 * 1. CLI flags / programmatic overrides
 * 2. Environment variables
 * 3. Config file (~/.weather-oracle/config.json)
 * 4. Default values
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import type { AppConfig } from "./schema";
import { appConfigSchema, DEFAULT_CONFIG } from "./schema";
import { ConfigError } from "../errors/config";

/**
 * Environment variable prefix for Weather Oracle config
 */
const ENV_PREFIX = "WEATHER_ORACLE_";

/**
 * Default config directory path
 */
export function getConfigDir(): string {
  return join(homedir(), ".weather-oracle");
}

/**
 * Default config file path
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

/**
 * Deep merge two objects, with source values overriding target values
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== undefined &&
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue) &&
      targetValue !== null
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Load configuration from file
 */
async function loadConfigFile(filePath: string): Promise<Partial<AppConfig>> {
  try {
    await access(filePath, constants.R_OK);
    const content = await readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    return parsed as Partial<AppConfig>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    if (error instanceof SyntaxError) {
      throw ConfigError.parseError(filePath, error);
    }
    throw error;
  }
}

/**
 * Parse environment variables into partial config
 */
function loadEnvConfig(): Partial<AppConfig> {
  const config: Record<string, unknown> = {};

  // API endpoints
  const forecastUrl = process.env[`${ENV_PREFIX}API_FORECAST_URL`];
  const geocodingUrl = process.env[`${ENV_PREFIX}API_GEOCODING_URL`];
  if (forecastUrl !== undefined || geocodingUrl !== undefined) {
    config.api = {
      ...(forecastUrl !== undefined && { forecast: forecastUrl }),
      ...(geocodingUrl !== undefined && { geocoding: geocodingUrl }),
    };
  }

  // Cache settings
  const cacheEnabled = process.env[`${ENV_PREFIX}CACHE_ENABLED`];
  const cacheTtl = process.env[`${ENV_PREFIX}CACHE_TTL_SECONDS`];
  const cacheMaxEntries = process.env[`${ENV_PREFIX}CACHE_MAX_ENTRIES`];
  const cacheDir = process.env[`${ENV_PREFIX}CACHE_DIRECTORY`];
  if (
    cacheEnabled !== undefined ||
    cacheTtl !== undefined ||
    cacheMaxEntries !== undefined ||
    cacheDir !== undefined
  ) {
    config.cache = {
      ...(cacheEnabled !== undefined && { enabled: cacheEnabled === "true" }),
      ...(cacheTtl !== undefined && { ttlSeconds: parseInt(cacheTtl, 10) }),
      ...(cacheMaxEntries !== undefined && {
        maxEntries: parseInt(cacheMaxEntries, 10),
      }),
      ...(cacheDir !== undefined && { directory: cacheDir }),
    };
  }

  // Model settings
  const defaultModels = process.env[`${ENV_PREFIX}DEFAULT_MODELS`];
  const timeout = process.env[`${ENV_PREFIX}MODEL_TIMEOUT`];
  const retries = process.env[`${ENV_PREFIX}MODEL_RETRIES`];
  if (defaultModels !== undefined || timeout !== undefined || retries !== undefined) {
    config.models = {
      ...(defaultModels !== undefined && { defaults: defaultModels.split(",") }),
      ...(timeout !== undefined && { timeout: parseInt(timeout, 10) }),
      ...(retries !== undefined && { retries: parseInt(retries, 10) }),
    };
  }

  // Display settings
  const units = process.env[`${ENV_PREFIX}UNITS`];
  const outputFormat = process.env[`${ENV_PREFIX}OUTPUT_FORMAT`];
  const showConfidence = process.env[`${ENV_PREFIX}SHOW_CONFIDENCE`];
  const showModelDetails = process.env[`${ENV_PREFIX}SHOW_MODEL_DETAILS`];
  const colorOutput = process.env[`${ENV_PREFIX}COLOR_OUTPUT`];
  if (
    units !== undefined ||
    outputFormat !== undefined ||
    showConfidence !== undefined ||
    showModelDetails !== undefined ||
    colorOutput !== undefined
  ) {
    config.display = {
      ...(units !== undefined && { units }),
      ...(outputFormat !== undefined && { outputFormat }),
      ...(showConfidence !== undefined && { showConfidence: showConfidence === "true" }),
      ...(showModelDetails !== undefined && {
        showModelDetails: showModelDetails === "true",
      }),
      ...(colorOutput !== undefined && { colorOutput: colorOutput === "true" }),
    };
  }

  return config as Partial<AppConfig>;
}

/**
 * Options for loading configuration
 */
export interface LoadConfigOptions {
  /**
   * Path to config file (overrides default)
   */
  configPath?: string;

  /**
   * CLI flag overrides (highest priority)
   */
  overrides?: Partial<AppConfig>;

  /**
   * Skip loading from file
   */
  skipFile?: boolean;

  /**
   * Skip loading from environment
   */
  skipEnv?: boolean;
}

/**
 * Load configuration from all sources with priority merging.
 *
 * Priority (highest to lowest):
 * 1. overrides parameter
 * 2. Environment variables
 * 3. Config file
 * 4. Defaults
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<AppConfig> {
  const { configPath, overrides = {}, skipFile = false, skipEnv = false } = options;

  // Start with defaults
  let config: Partial<AppConfig> = { ...DEFAULT_CONFIG };

  // Load from file (lowest priority after defaults)
  if (!skipFile) {
    const filePath = configPath ?? getConfigPath();
    const fileConfig = await loadConfigFile(filePath);
    config = deepMerge(config, fileConfig);
  }

  // Load from environment (higher priority than file)
  if (!skipEnv) {
    const envConfig = loadEnvConfig();
    config = deepMerge(config, envConfig);
  }

  // Apply overrides (highest priority)
  config = deepMerge(config, overrides as Partial<AppConfig>);

  // Validate and return
  const result = appConfigSchema.safeParse(config);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw ConfigError.invalid(
      firstError?.path.join(".") ?? "unknown",
      firstError?.message ?? "Validation failed"
    );
  }

  return result.data;
}

/**
 * Save configuration to file
 */
export async function saveConfig(
  config: Partial<AppConfig>,
  filePath?: string
): Promise<void> {
  const targetPath = filePath ?? getConfigPath();
  const dir = join(targetPath, "..");

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(targetPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    throw ConfigError.parseError(
      targetPath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if config file exists
 */
export async function configFileExists(filePath?: string): Promise<boolean> {
  const targetPath = filePath ?? getConfigPath();
  try {
    await access(targetPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create default config file if it doesn't exist
 */
export async function ensureConfigFile(filePath?: string): Promise<boolean> {
  const targetPath = filePath ?? getConfigPath();
  const exists = await configFileExists(targetPath);

  if (!exists) {
    await saveConfig({}, targetPath);
    return true;
  }

  return false;
}
