/**
 * Core type definitions for the Weather Oracle system.
 * Re-exports all types from the types module.
 */

// Location types
export type {
  Latitude,
  Longitude,
  Coordinates,
  Elevation,
  TimezoneId,
  GeocodingResult,
  LocationQuery,
  Location,
} from "./location";

export {
  latitude,
  longitude,
  elevation,
  timezoneId,
  createCoordinates,
  coordinatesEqual,
} from "./location";

// Weather types
export type {
  Celsius,
  Millimeters,
  MetersPerSecond,
  WindDirection,
  Humidity,
  Pressure,
  CloudCover,
  UVIndex,
  Visibility,
  WeatherCode,
  WeatherMetrics,
  HourlyForecast,
  TemperatureRange,
  PrecipitationSummary,
  WindSummary,
  SunTimes,
  DailyForecast,
} from "./weather";

export {
  celsius,
  toFahrenheit,
  millimeters,
  metersPerSecond,
  toKmPerHour,
  toMph,
  windDirection,
  toCardinalDirection,
  humidity,
  pressure,
  cloudCover,
  uvIndex,
  visibility,
  weatherCode,
} from "./weather";

// Model types
export type {
  ModelName,
  ModelInfo,
  ConfidenceLevelName,
  ConfidenceLevel,
  ModelForecast,
  MetricStatistics,
  ModelConsensus,
  ModelWeight,
  AggregatedForecast,
  AggregatedHourlyForecast,
  AggregatedDailyForecast,
} from "./models";

export {
  MODEL_INFO,
  confidenceLevel,
  isModelForecast,
  emptyConsensus,
} from "./models";
