/**
 * API module for Weather Oracle.
 * Exports Open-Meteo client, geocoding, and related utilities.
 */

// Open-Meteo client and types
export {
  OpenMeteoClient,
  fetchModelForecast,
  type ForecastOptions,
} from "./open-meteo";

// Multi-model fetcher
export {
  fetchAllModels,
  fetchAllModelsWithTiming,
  getDefaultModels,
  type MultiModelResult,
  type MultiModelOptions,
  type ModelFailure,
  type TimedModelForecast,
} from "./multi-model";

// Geocoding client
export {
  geocodeLocation,
  searchLocations,
  type GeocodingOptions,
} from "./geocoding";

// Endpoint configuration
export {
  OPEN_METEO_BASE_URL,
  MODEL_ENDPOINTS,
  HOURLY_VARIABLES,
  DAILY_VARIABLES,
  getModelEndpoint,
  type HourlyVariable,
  type DailyVariable,
} from "./endpoints";
