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

// Config operations for CLI
export {
  CONFIG_KEYS,
  getValidKeys,
  isValidKey,
  getConfigValue,
  getDefaultValue,
  setConfigValue,
  unsetConfigValue,
  parseConfigValue,
  validatePartialConfig,
  flattenConfig,
  formatConfigValue,
  type ConfigKey,
} from "./operations";
