/**
 * Model types for the Weather Oracle system.
 * Defines weather model names, model-specific forecasts, and aggregated forecasts.
 */

import type { Coordinates } from "./location";
import type { DailyForecast, HourlyForecast, WeatherMetrics } from "./weather";

/**
 * Supported weather forecast models
 */
export type ModelName =
  | "ecmwf"
  | "gfs"
  | "icon"
  | "meteofrance"
  | "ukmo"
  | "jma"
  | "gem";

/**
 * Model display information
 */
export interface ModelInfo {
  readonly name: ModelName;
  readonly displayName: string;
  readonly provider: string;
  readonly resolution: string;
  readonly updateFrequency: string;
}

/**
 * Standard model metadata
 */
export const MODEL_INFO: Record<ModelName, Omit<ModelInfo, "name">> = {
  ecmwf: {
    displayName: "ECMWF IFS",
    provider: "European Centre for Medium-Range Weather Forecasts",
    resolution: "9km",
    updateFrequency: "6 hours",
  },
  gfs: {
    displayName: "GFS",
    provider: "NOAA/NCEP",
    resolution: "13km",
    updateFrequency: "6 hours",
  },
  icon: {
    displayName: "ICON",
    provider: "Deutscher Wetterdienst",
    resolution: "7km",
    updateFrequency: "6 hours",
  },
  meteofrance: {
    displayName: "ARPEGE",
    provider: "Météo-France",
    resolution: "10km",
    updateFrequency: "6 hours",
  },
  ukmo: {
    displayName: "UK Met Office",
    provider: "UK Meteorological Office",
    resolution: "10km",
    updateFrequency: "6 hours",
  },
  jma: {
    displayName: "JMA GSM",
    provider: "Japan Meteorological Agency",
    resolution: "20km",
    updateFrequency: "6 hours",
  },
  gem: {
    displayName: "GEM",
    provider: "Environment Canada",
    resolution: "15km",
    updateFrequency: "12 hours",
  },
};

/**
 * Confidence level for forecasts
 */
export type ConfidenceLevelName = "high" | "medium" | "low";

/**
 * Confidence level with numeric score
 */
export interface ConfidenceLevel {
  readonly level: ConfidenceLevelName;
  readonly score: number;
}

/**
 * Create a confidence level from a score (0-1)
 */
export function confidenceLevel(score: number): ConfidenceLevel {
  if (score < 0 || score > 1) {
    throw new RangeError(`Confidence score must be between 0 and 1, got ${score}`);
  }
  let level: ConfidenceLevelName;
  if (score >= 0.7) {
    level = "high";
  } else if (score >= 0.4) {
    level = "medium";
  } else {
    level = "low";
  }
  return { level, score };
}

/**
 * Forecast from a single weather model
 * Uses discriminated union pattern with model field as discriminant
 */
export interface ModelForecast<M extends ModelName = ModelName> {
  readonly model: M;
  readonly coordinates: Coordinates;
  readonly generatedAt: Date;
  readonly validFrom: Date;
  readonly validTo: Date;
  readonly hourly: readonly HourlyForecast[];
  readonly daily: readonly DailyForecast[];
}

/**
 * Type guard to check if forecast is from a specific model
 */
export function isModelForecast<M extends ModelName>(
  forecast: ModelForecast,
  model: M
): forecast is ModelForecast<M> {
  return forecast.model === model;
}

/**
 * Statistics for a numeric metric across models
 */
export interface MetricStatistics {
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly stdDev: number;
  readonly range: number;
}

/**
 * Agreement metrics across weather models
 */
export interface ModelConsensus {
  readonly agreementScore: number;
  readonly modelsInAgreement: readonly ModelName[];
  readonly outlierModels: readonly ModelName[];
  readonly temperatureStats: MetricStatistics;
  readonly precipitationStats: MetricStatistics;
  readonly windStats: MetricStatistics;
}

/**
 * Weighted contribution from a model
 */
export interface ModelWeight {
  readonly model: ModelName;
  readonly weight: number;
  readonly reason: string;
}

/**
 * Aggregated forecast combining multiple models
 */
export interface AggregatedForecast {
  readonly coordinates: Coordinates;
  readonly generatedAt: Date;
  readonly validFrom: Date;
  readonly validTo: Date;
  readonly models: readonly ModelName[];
  readonly modelForecasts: readonly ModelForecast[];
  readonly consensus: {
    readonly hourly: readonly AggregatedHourlyForecast[];
    readonly daily: readonly AggregatedDailyForecast[];
  };
  readonly modelWeights: readonly ModelWeight[];
  readonly overallConfidence: ConfidenceLevel;
}

/**
 * Aggregated hourly forecast with consensus metrics
 */
export interface AggregatedHourlyForecast {
  readonly timestamp: Date;
  readonly metrics: WeatherMetrics;
  readonly confidence: ConfidenceLevel;
  readonly modelAgreement: ModelConsensus;
  readonly range: {
    readonly temperature: { readonly min: number; readonly max: number };
    readonly precipitation: { readonly min: number; readonly max: number };
    readonly windSpeed: { readonly min: number; readonly max: number };
  };
}

/**
 * Aggregated daily forecast with consensus metrics
 */
export interface AggregatedDailyForecast {
  readonly date: Date;
  readonly forecast: DailyForecast;
  readonly confidence: ConfidenceLevel;
  readonly modelAgreement: ModelConsensus;
  readonly range: {
    readonly temperatureMax: { readonly min: number; readonly max: number };
    readonly temperatureMin: { readonly min: number; readonly max: number };
    readonly precipitation: { readonly min: number; readonly max: number };
  };
}

/**
 * Create an empty model consensus (for initialization)
 */
export function emptyConsensus(): ModelConsensus {
  return {
    agreementScore: 0,
    modelsInAgreement: [],
    outlierModels: [],
    temperatureStats: {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      range: 0,
    },
    precipitationStats: {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      range: 0,
    },
    windStats: {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      range: 0,
    },
  };
}
