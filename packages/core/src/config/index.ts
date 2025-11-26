/**
 * Configuration module for Weather Oracle.
 * Exports schema, types, and loader functions.
 */

// Schema and types
export {
  unitSystemSchema,
  outputFormatSchema,
  apiEndpointsSchema,
  cacheConfigSchema,
  modelConfigSchema,
  displayConfigSchema,
  appConfigSchema,
  DEFAULT_CONFIG,
  validateConfig,
  safeValidateConfig,
} from "./schema";

export type {
  UnitSystem,
  OutputFormat,
  ApiEndpoints,
  CacheConfig,
  ModelConfig,
  DisplayConfig,
  AppConfig,
} from "./schema";

// Loader functions
export {
  loadConfig,
  saveConfig,
  configFileExists,
  ensureConfigFile,
  getConfigDir,
  getConfigPath,
  type LoadConfigOptions,
} from "./loader";
