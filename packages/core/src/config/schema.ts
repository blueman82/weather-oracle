/**
 * Configuration schema definitions using Zod.
 * Defines all configuration options with validation and type inference.
 */

import { z } from "zod";
import type { ModelName } from "../types/models";

/**
 * Valid model names that can be configured
 */
const MODEL_NAMES: readonly ModelName[] = [
  "ecmwf",
  "gfs",
  "icon",
  "meteofrance",
  "ukmo",
  "jma",
  "gem",
] as const;

/**
 * Unit system for temperature, wind speed, etc.
 */
export const unitSystemSchema = z.enum(["metric", "imperial"]).default("metric");

/**
 * Output format for CLI and API responses
 */
export const outputFormatSchema = z.enum(["json", "table", "minimal"]).default("table");

/**
 * API endpoints configuration
 */
export const apiEndpointsSchema = z.object({
  forecast: z.string().url().default("https://api.open-meteo.com/v1/forecast"),
  geocoding: z.string().url().default("https://geocoding-api.open-meteo.com/v1/search"),
});

/**
 * Cache configuration
 */
export const cacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttlSeconds: z.number().int().positive().default(300),
  maxEntries: z.number().int().positive().default(100),
  directory: z.string().optional(),
});

/**
 * Model configuration
 */
export const modelConfigSchema = z.object({
  defaults: z
    .array(z.enum(MODEL_NAMES as unknown as [string, ...string[]]))
    .min(1)
    .default(["ecmwf", "gfs", "icon"]),
  timeout: z.number().int().positive().default(30000),
  retries: z.number().int().min(0).max(5).default(2),
});

/**
 * Display preferences
 */
export const displayConfigSchema = z.object({
  units: unitSystemSchema,
  outputFormat: outputFormatSchema,
  showConfidence: z.boolean().default(true),
  showModelDetails: z.boolean().default(false),
  colorOutput: z.boolean().default(true),
});

/**
 * Complete application configuration schema
 */
export const appConfigSchema = z.object({
  api: apiEndpointsSchema.default({}),
  cache: cacheConfigSchema.default({}),
  models: modelConfigSchema.default({}),
  display: displayConfigSchema.default({}),
});

/**
 * Type inference from Zod schemas
 */
export type UnitSystem = z.infer<typeof unitSystemSchema>;
export type OutputFormat = z.infer<typeof outputFormatSchema>;
export type ApiEndpoints = z.infer<typeof apiEndpointsSchema>;
export type CacheConfig = z.infer<typeof cacheConfigSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type DisplayConfig = z.infer<typeof displayConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = appConfigSchema.parse({});

/**
 * Validate a partial configuration object
 */
export function validateConfig(config: unknown): AppConfig {
  return appConfigSchema.parse(config);
}

/**
 * Safely validate configuration, returning default on failure
 */
export function safeValidateConfig(
  config: unknown
): { success: true; data: AppConfig } | { success: false; error: z.ZodError } {
  const result = appConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
