/**
 * Open-Meteo API endpoint URLs for each weather model.
 * Maps model names to their respective API endpoints.
 */

import type { ModelName } from "../types/models";

/**
 * Base URL for Open-Meteo API
 */
export const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1";

/**
 * Model-specific endpoint paths
 * Most models have dedicated endpoints, some use /forecast with models= param
 */
export const MODEL_ENDPOINTS: Record<ModelName, string> = {
  ecmwf: `${OPEN_METEO_BASE_URL}/ecmwf`,
  gfs: `${OPEN_METEO_BASE_URL}/gfs`,
  icon: `${OPEN_METEO_BASE_URL}/dwd-icon`,
  jma: `${OPEN_METEO_BASE_URL}/jma`,
  gem: `${OPEN_METEO_BASE_URL}/gem`,
  meteofrance: `${OPEN_METEO_BASE_URL}/meteofrance`,
  ukmo: `${OPEN_METEO_BASE_URL}/forecast`,
} as const;

/**
 * Models that require the models= query parameter on /forecast endpoint
 */
export const MODEL_QUERY_PARAMS: Partial<Record<ModelName, string>> = {
  ukmo: "ukmo_seamless",
} as const;

/**
 * Hourly weather variables to request from Open-Meteo API
 */
export const HOURLY_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "precipitation",
  "precipitation_probability",
  "cloud_cover",
  "visibility",
  "uv_index",
  "weather_code",
] as const;

/**
 * Daily weather variables to request from Open-Meteo API
 */
export const DAILY_VARIABLES = [
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "precipitation_hours",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "sunrise",
  "sunset",
  "daylight_duration",
  "uv_index_max",
  "weather_code",
] as const;

/**
 * Type for hourly variable names
 */
export type HourlyVariable = (typeof HOURLY_VARIABLES)[number];

/**
 * Type for daily variable names
 */
export type DailyVariable = (typeof DAILY_VARIABLES)[number];

/**
 * Get the API endpoint URL for a specific weather model
 */
export function getModelEndpoint(model: ModelName): string {
  return MODEL_ENDPOINTS[model];
}
