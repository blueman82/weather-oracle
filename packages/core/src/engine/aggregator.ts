/**
 * Multi-model forecast aggregation engine.
 * Combines multiple weather model forecasts into a unified view
 * with consensus metrics and confidence levels.
 */

import type {
  ModelForecast,
  ModelName,
  AggregatedForecast,
  AggregatedHourlyForecast,
  AggregatedDailyForecast,
  MetricStatistics,
  ModelConsensus,
  ModelWeight,
  ConfidenceLevel,
} from "../types/models";
import type { WeatherMetrics, HourlyForecast, DailyForecast } from "../types/weather";
import {
  celsius,
  millimeters,
  metersPerSecond,
  humidity,
  pressure,
  cloudCover,
  uvIndex,
  visibility,
  weatherCode,
  windDirection,
} from "../types/weather";
import { confidenceLevel } from "../types/models";
import {
  mean,
  median,
  stdDev,
  trimmedMean,
  calculateSpread,
  findOutlierIndices,
  ensembleProbability,
  confidenceFromStdDev,
  confidenceFromRange,
  type SpreadMetrics,
} from "./statistics";

/**
 * Information about an outlier model for a specific metric
 */
export interface OutlierInfo {
  readonly model: ModelName;
  readonly metric: string;
  readonly value: number;
  readonly zScore: number;
  readonly timestamp: Date;
}

/**
 * Thresholds for confidence determination per metric type
 */
const CONFIDENCE_THRESHOLDS = {
  temperature: { highStdDev: 1.5, lowStdDev: 4.0 }, // Celsius
  precipitation: { highAgreement: 80, lowAgreement: 50 }, // Percentage
  windSpeed: { highRange: 10, lowRange: 25 }, // km/h (converted from m/s * 3.6)
  humidity: { highRange: 10, lowRange: 30 }, // Percentage
} as const;

/**
 * Z-score threshold for outlier detection
 */
const OUTLIER_Z_THRESHOLD = 2.0;

/**
 * Group hourly forecasts by timestamp across models.
 * Returns a map of timestamp ISO string to array of forecasts at that time.
 */
function groupByTimestamp(
  forecasts: readonly ModelForecast[]
): Map<string, { model: ModelName; hourly: HourlyForecast }[]> {
  const groups = new Map<string, { model: ModelName; hourly: HourlyForecast }[]>();

  for (const forecast of forecasts) {
    for (const hourly of forecast.hourly) {
      const key = hourly.timestamp.toISOString();
      const existing = groups.get(key) ?? [];
      existing.push({ model: forecast.model, hourly });
      groups.set(key, existing);
    }
  }

  return groups;
}

/**
 * Group daily forecasts by date across models.
 */
function groupByDate(
  forecasts: readonly ModelForecast[]
): Map<string, { model: ModelName; daily: DailyForecast }[]> {
  const groups = new Map<string, { model: ModelName; daily: DailyForecast }[]>();

  for (const forecast of forecasts) {
    for (const daily of forecast.daily) {
      const key = daily.date.toISOString().split("T")[0];
      const existing = groups.get(key) ?? [];
      existing.push({ model: forecast.model, daily });
      groups.set(key, existing);
    }
  }

  return groups;
}

/**
 * Extract numeric values from an array of items using a getter function.
 */
function extractValues<T>(items: readonly T[], getter: (item: T) => number): number[] {
  return items.map(getter);
}

/**
 * Calculate statistics for a metric across models.
 */
function calculateMetricStatistics(values: readonly number[]): MetricStatistics {
  const spread = calculateSpread(values);
  return {
    mean: spread.mean,
    median: spread.median,
    min: spread.min,
    max: spread.max,
    stdDev: spread.stdDev,
    range: spread.range,
  };
}

/**
 * Calculate model consensus for hourly forecasts at a specific timestamp.
 */
function calculateHourlyConsensus(
  items: readonly { model: ModelName; hourly: HourlyForecast }[]
): { consensus: ModelConsensus; outliers: OutlierInfo[] } {
  const outliers: OutlierInfo[] = [];

  // Extract metric values
  const tempValues = extractValues(items, (i) => i.hourly.metrics.temperature);
  const precipValues = extractValues(items, (i) => i.hourly.metrics.precipitation);
  const windValues = extractValues(items, (i) => i.hourly.metrics.windSpeed);

  // Calculate statistics
  const temperatureStats = calculateMetricStatistics(tempValues);
  const precipitationStats = calculateMetricStatistics(precipValues);
  const windStats = calculateMetricStatistics(windValues);

  // Find outliers
  const tempOutlierIndices = findOutlierIndices(tempValues, OUTLIER_Z_THRESHOLD);
  const precipOutlierIndices = findOutlierIndices(precipValues, OUTLIER_Z_THRESHOLD);
  const windOutlierIndices = findOutlierIndices(windValues, OUTLIER_Z_THRESHOLD);

  const outlierModels = new Set<ModelName>();

  for (const idx of tempOutlierIndices) {
    const item = items[idx];
    outlierModels.add(item.model);
    const avg = mean(tempValues);
    const sd = stdDev(tempValues);
    outliers.push({
      model: item.model,
      metric: "temperature",
      value: tempValues[idx],
      zScore: sd > 0 ? (tempValues[idx] - avg) / sd : 0,
      timestamp: item.hourly.timestamp,
    });
  }

  for (const idx of precipOutlierIndices) {
    const item = items[idx];
    outlierModels.add(item.model);
    const avg = mean(precipValues);
    const sd = stdDev(precipValues);
    outliers.push({
      model: item.model,
      metric: "precipitation",
      value: precipValues[idx],
      zScore: sd > 0 ? (precipValues[idx] - avg) / sd : 0,
      timestamp: item.hourly.timestamp,
    });
  }

  for (const idx of windOutlierIndices) {
    const item = items[idx];
    outlierModels.add(item.model);
    const avg = mean(windValues);
    const sd = stdDev(windValues);
    outliers.push({
      model: item.model,
      metric: "windSpeed",
      value: windValues[idx],
      zScore: sd > 0 ? (windValues[idx] - avg) / sd : 0,
      timestamp: item.hourly.timestamp,
    });
  }

  // Models in agreement are those not flagged as outliers
  const modelsInAgreement = items
    .filter((i) => !outlierModels.has(i.model))
    .map((i) => i.model);

  // Agreement score based on how many models agree
  const agreementScore =
    items.length > 0 ? modelsInAgreement.length / items.length : 0;

  return {
    consensus: {
      agreementScore,
      modelsInAgreement,
      outlierModels: Array.from(outlierModels),
      temperatureStats,
      precipitationStats,
      windStats,
    },
    outliers,
  };
}

/**
 * Aggregate weather metrics from multiple models for a single timestamp.
 * Uses trimmed mean for temperature, median for wind, mean for humidity.
 */
function aggregateHourlyMetrics(
  items: readonly { model: ModelName; hourly: HourlyForecast }[]
): WeatherMetrics {
  // Extract values for each metric
  const temps = extractValues(items, (i) => i.hourly.metrics.temperature);
  const feelsLikes = extractValues(items, (i) => i.hourly.metrics.feelsLike);
  const humidities = extractValues(items, (i) => i.hourly.metrics.humidity);
  const pressures = extractValues(items, (i) => i.hourly.metrics.pressure);
  const windSpeeds = extractValues(items, (i) => i.hourly.metrics.windSpeed);
  const windDirs = extractValues(items, (i) => i.hourly.metrics.windDirection);
  const windGusts = items
    .filter((i) => i.hourly.metrics.windGust !== undefined)
    .map((i) => i.hourly.metrics.windGust!);
  const precips = extractValues(items, (i) => i.hourly.metrics.precipitation);
  const cloudCovers = extractValues(items, (i) => i.hourly.metrics.cloudCover);
  const visibilities = extractValues(items, (i) => i.hourly.metrics.visibility);
  const uvIndices = extractValues(items, (i) => i.hourly.metrics.uvIndex);
  const weatherCodes = extractValues(items, (i) => i.hourly.metrics.weatherCode);

  // Aggregate using appropriate methods per the strategy:
  // - Temperature: trimmed mean (robust to outliers)
  // - Wind speed: median (robust to outliers)
  // - Humidity: mean
  // - Precipitation: ensemble probability approach (% models > 0.1mm)
  return {
    temperature: celsius(trimmedMean(temps)),
    feelsLike: celsius(trimmedMean(feelsLikes)),
    humidity: humidity(Math.round(mean(humidities))),
    pressure: pressure(mean(pressures)),
    windSpeed: metersPerSecond(median(windSpeeds)),
    windDirection: windDirection(Math.round(mean(windDirs))),
    windGust: windGusts.length > 0 ? metersPerSecond(median(windGusts)) : undefined,
    precipitation: millimeters(mean(precips)),
    precipitationProbability: ensembleProbability(precips, 0.1, "gt"),
    cloudCover: cloudCover(Math.round(mean(cloudCovers))),
    visibility: visibility(mean(visibilities)),
    uvIndex: uvIndex(Math.round(median(uvIndices))),
    weatherCode: weatherCode(Math.round(median(weatherCodes))),
  };
}

/**
 * Calculate confidence level for aggregated hourly forecast.
 */
function calculateHourlyConfidence(
  consensus: ModelConsensus,
  precipValues: readonly number[]
): ConfidenceLevel {
  // Temperature confidence based on stddev
  const tempConfidence = confidenceFromStdDev(
    consensus.temperatureStats.stdDev,
    CONFIDENCE_THRESHOLDS.temperature.highStdDev,
    CONFIDENCE_THRESHOLDS.temperature.lowStdDev
  );

  // Precipitation confidence based on ensemble agreement
  const precipProbability = ensembleProbability(precipValues, 0.1, "gt");
  const precipConfidence =
    precipProbability >= 80 || precipProbability <= 20 ? 1.0 : 0.5;

  // Wind confidence based on range (convert m/s to km/h)
  const windRangeKmh = consensus.windStats.range * 3.6;
  const windConfidence = confidenceFromRange(
    windRangeKmh,
    CONFIDENCE_THRESHOLDS.windSpeed.highRange,
    CONFIDENCE_THRESHOLDS.windSpeed.lowRange
  );

  // Overall confidence is weighted average
  const overallScore = tempConfidence * 0.4 + precipConfidence * 0.3 + windConfidence * 0.3;

  return confidenceLevel(overallScore);
}

/**
 * Calculate model consensus for daily forecasts.
 */
function calculateDailyConsensus(
  items: readonly { model: ModelName; daily: DailyForecast }[]
): { consensus: ModelConsensus; outliers: OutlierInfo[] } {
  const outliers: OutlierInfo[] = [];

  // Extract metric values (using max temp as representative)
  const tempMaxValues = extractValues(items, (i) => i.daily.temperature.max);
  const precipValues = extractValues(items, (i) => i.daily.precipitation.total);
  const windValues = extractValues(items, (i) => i.daily.wind.maxSpeed);

  // Calculate statistics
  const temperatureStats = calculateMetricStatistics(tempMaxValues);
  const precipitationStats = calculateMetricStatistics(precipValues);
  const windStats = calculateMetricStatistics(windValues);

  // Find outliers
  const tempOutlierIndices = findOutlierIndices(tempMaxValues, OUTLIER_Z_THRESHOLD);
  const precipOutlierIndices = findOutlierIndices(precipValues, OUTLIER_Z_THRESHOLD);
  const windOutlierIndices = findOutlierIndices(windValues, OUTLIER_Z_THRESHOLD);

  const outlierModels = new Set<ModelName>();

  for (const idx of tempOutlierIndices) {
    const item = items[idx];
    outlierModels.add(item.model);
    const avg = mean(tempMaxValues);
    const sd = stdDev(tempMaxValues);
    outliers.push({
      model: item.model,
      metric: "temperature",
      value: tempMaxValues[idx],
      zScore: sd > 0 ? (tempMaxValues[idx] - avg) / sd : 0,
      timestamp: item.daily.date,
    });
  }

  for (const idx of precipOutlierIndices) {
    const item = items[idx];
    outlierModels.add(item.model);
    const avg = mean(precipValues);
    const sd = stdDev(precipValues);
    outliers.push({
      model: item.model,
      metric: "precipitation",
      value: precipValues[idx],
      zScore: sd > 0 ? (precipValues[idx] - avg) / sd : 0,
      timestamp: item.daily.date,
    });
  }

  for (const idx of windOutlierIndices) {
    const item = items[idx];
    outlierModels.add(item.model);
    const avg = mean(windValues);
    const sd = stdDev(windValues);
    outliers.push({
      model: item.model,
      metric: "windSpeed",
      value: windValues[idx],
      zScore: sd > 0 ? (windValues[idx] - avg) / sd : 0,
      timestamp: item.daily.date,
    });
  }

  const modelsInAgreement = items
    .filter((i) => !outlierModels.has(i.model))
    .map((i) => i.model);

  const agreementScore =
    items.length > 0 ? modelsInAgreement.length / items.length : 0;

  return {
    consensus: {
      agreementScore,
      modelsInAgreement,
      outlierModels: Array.from(outlierModels),
      temperatureStats,
      precipitationStats,
      windStats,
    },
    outliers,
  };
}

/**
 * Aggregate daily forecasts from multiple models.
 */
function aggregateDailyForecast(
  items: readonly { model: ModelName; daily: DailyForecast }[]
): DailyForecast {
  // Use first item as template for structure
  const template = items[0].daily;

  // Extract and aggregate values
  const tempMaxes = extractValues(items, (i) => i.daily.temperature.max);
  const tempMins = extractValues(items, (i) => i.daily.temperature.min);
  const humidityMaxes = extractValues(items, (i) => i.daily.humidity.max);
  const humidityMins = extractValues(items, (i) => i.daily.humidity.min);
  const pressureMaxes = extractValues(items, (i) => i.daily.pressure.max);
  const pressureMins = extractValues(items, (i) => i.daily.pressure.min);
  const precipTotals = extractValues(items, (i) => i.daily.precipitation.total);
  const precipHours = extractValues(items, (i) => i.daily.precipitation.hours);
  const windAvgSpeeds = extractValues(items, (i) => i.daily.wind.avgSpeed);
  const windMaxSpeeds = extractValues(items, (i) => i.daily.wind.maxSpeed);
  const windDirs = extractValues(items, (i) => i.daily.wind.dominantDirection);
  const cloudAvgs = extractValues(items, (i) => i.daily.cloudCover.avg);
  const cloudMaxes = extractValues(items, (i) => i.daily.cloudCover.max);
  const uvMaxes = extractValues(items, (i) => i.daily.uvIndex.max);
  const weatherCodes = extractValues(items, (i) => i.daily.weatherCode);

  return {
    date: template.date,
    temperature: {
      min: celsius(trimmedMean(tempMins)),
      max: celsius(trimmedMean(tempMaxes)),
    },
    humidity: {
      min: humidity(Math.round(mean(humidityMins))),
      max: humidity(Math.round(mean(humidityMaxes))),
    },
    pressure: {
      min: pressure(mean(pressureMins)),
      max: pressure(mean(pressureMaxes)),
    },
    precipitation: {
      total: millimeters(mean(precipTotals)),
      probability: ensembleProbability(precipTotals, 0.1, "gt"),
      hours: Math.round(mean(precipHours)),
    },
    wind: {
      avgSpeed: metersPerSecond(mean(windAvgSpeeds)),
      maxSpeed: metersPerSecond(median(windMaxSpeeds)),
      dominantDirection: windDirection(Math.round(mean(windDirs))),
    },
    cloudCover: {
      avg: cloudCover(Math.round(mean(cloudAvgs))),
      max: cloudCover(Math.round(mean(cloudMaxes))),
    },
    uvIndex: {
      max: uvIndex(Math.round(median(uvMaxes))),
    },
    sun: template.sun, // Use template sun times (they should be similar across models)
    weatherCode: weatherCode(Math.round(median(weatherCodes))),
    hourly: [], // Aggregated hourly is handled separately
  };
}

/**
 * Calculate confidence level for aggregated daily forecast.
 */
function calculateDailyConfidence(
  consensus: ModelConsensus,
  precipValues: readonly number[]
): ConfidenceLevel {
  // Similar logic to hourly confidence
  const tempConfidence = confidenceFromStdDev(
    consensus.temperatureStats.stdDev,
    CONFIDENCE_THRESHOLDS.temperature.highStdDev,
    CONFIDENCE_THRESHOLDS.temperature.lowStdDev
  );

  const precipProbability = ensembleProbability(precipValues, 0.1, "gt");
  const precipConfidence =
    precipProbability >= 80 || precipProbability <= 20 ? 1.0 : 0.5;

  const windRangeKmh = consensus.windStats.range * 3.6;
  const windConfidence = confidenceFromRange(
    windRangeKmh,
    CONFIDENCE_THRESHOLDS.windSpeed.highRange,
    CONFIDENCE_THRESHOLDS.windSpeed.lowRange
  );

  const overallScore = tempConfidence * 0.4 + precipConfidence * 0.3 + windConfidence * 0.3;

  return confidenceLevel(overallScore);
}

/**
 * Calculate default model weights (equal weighting).
 */
function calculateModelWeights(models: readonly ModelName[]): ModelWeight[] {
  const weight = models.length > 0 ? 1 / models.length : 0;
  return models.map((model) => ({
    model,
    weight,
    reason: "Equal weighting",
  }));
}

/**
 * Calculate overall confidence from aggregated forecasts.
 */
function calculateOverallConfidence(
  hourlyForecasts: readonly AggregatedHourlyForecast[],
  dailyForecasts: readonly AggregatedDailyForecast[]
): ConfidenceLevel {
  const hourlyScores = hourlyForecasts.map((h) => h.confidence.score);
  const dailyScores = dailyForecasts.map((d) => d.confidence.score);

  const allScores = [...hourlyScores, ...dailyScores];
  const avgScore = allScores.length > 0 ? mean(allScores) : 0.5;

  return confidenceLevel(avgScore);
}

/**
 * Aggregate multiple model forecasts into a unified forecast.
 *
 * Uses the following aggregation strategy:
 * - Temperature: Trimmed mean (excludes outliers)
 * - Precipitation: Ensemble probability (% models predicting > 0.1mm)
 * - Wind speed: Median (robust to outliers)
 * - Humidity: Mean
 *
 * @param forecasts - Array of forecasts from different models
 * @returns Aggregated forecast with consensus metrics and individual model data
 *
 * @example
 * ```typescript
 * const result = await fetchAllModels(location);
 * const aggregated = aggregateForecasts(result.forecasts);
 * console.log(`Confidence: ${aggregated.overallConfidence.level}`);
 * ```
 */
export function aggregateForecasts(
  forecasts: readonly ModelForecast[]
): AggregatedForecast {
  if (forecasts.length === 0) {
    throw new Error("Cannot aggregate empty forecast array");
  }

  // Use first forecast as reference for coordinates and time range
  const reference = forecasts[0];
  const models = forecasts.map((f) => f.model);

  // Group hourly and daily forecasts by timestamp/date
  const hourlyGroups = groupByTimestamp(forecasts);
  const dailyGroups = groupByDate(forecasts);

  // Aggregate hourly forecasts
  const aggregatedHourly: AggregatedHourlyForecast[] = [];
  for (const [, items] of hourlyGroups) {
    if (items.length === 0) continue;

    const { consensus } = calculateHourlyConsensus(items);
    const metrics = aggregateHourlyMetrics(items);
    const precipValues = extractValues(items, (i) => i.hourly.metrics.precipitation);
    const confidence = calculateHourlyConfidence(consensus, precipValues);

    // Calculate ranges
    const tempValues = extractValues(items, (i) => i.hourly.metrics.temperature);
    const windValues = extractValues(items, (i) => i.hourly.metrics.windSpeed);

    aggregatedHourly.push({
      timestamp: items[0].hourly.timestamp,
      metrics,
      confidence,
      modelAgreement: consensus,
      range: {
        temperature: {
          min: Math.min(...tempValues),
          max: Math.max(...tempValues),
        },
        precipitation: {
          min: Math.min(...precipValues),
          max: Math.max(...precipValues),
        },
        windSpeed: {
          min: Math.min(...windValues),
          max: Math.max(...windValues),
        },
      },
    });
  }

  // Sort by timestamp
  aggregatedHourly.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Aggregate daily forecasts
  const aggregatedDaily: AggregatedDailyForecast[] = [];
  for (const [, items] of dailyGroups) {
    if (items.length === 0) continue;

    const { consensus } = calculateDailyConsensus(items);
    const forecast = aggregateDailyForecast(items);
    const precipValues = extractValues(items, (i) => i.daily.precipitation.total);
    const confidence = calculateDailyConfidence(consensus, precipValues);

    // Calculate ranges
    const tempMaxValues = extractValues(items, (i) => i.daily.temperature.max);
    const tempMinValues = extractValues(items, (i) => i.daily.temperature.min);

    aggregatedDaily.push({
      date: items[0].daily.date,
      forecast,
      confidence,
      modelAgreement: consensus,
      range: {
        temperatureMax: {
          min: Math.min(...tempMaxValues),
          max: Math.max(...tempMaxValues),
        },
        temperatureMin: {
          min: Math.min(...tempMinValues),
          max: Math.max(...tempMinValues),
        },
        precipitation: {
          min: Math.min(...precipValues),
          max: Math.max(...precipValues),
        },
      },
    });
  }

  // Sort by date
  aggregatedDaily.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate model weights and overall confidence
  const modelWeights = calculateModelWeights(models);
  const overallConfidence = calculateOverallConfidence(aggregatedHourly, aggregatedDaily);

  // Determine valid time range
  const validFrom =
    aggregatedHourly.length > 0
      ? aggregatedHourly[0].timestamp
      : aggregatedDaily.length > 0
        ? aggregatedDaily[0].date
        : reference.validFrom;

  const validTo =
    aggregatedHourly.length > 0
      ? aggregatedHourly[aggregatedHourly.length - 1].timestamp
      : aggregatedDaily.length > 0
        ? aggregatedDaily[aggregatedDaily.length - 1].date
        : reference.validTo;

  return {
    coordinates: reference.coordinates,
    generatedAt: new Date(),
    validFrom,
    validTo,
    models,
    modelForecasts: forecasts as ModelForecast[],
    consensus: {
      hourly: aggregatedHourly,
      daily: aggregatedDaily,
    },
    modelWeights,
    overallConfidence,
  };
}

/**
 * Identify outliers across all model forecasts.
 *
 * @param forecasts - Array of forecasts from different models
 * @returns Array of outlier information for each detected outlier
 */
export function identifyOutliers(
  forecasts: readonly ModelForecast[]
): OutlierInfo[] {
  if (forecasts.length <= 2) {
    return []; // Need at least 3 models for meaningful outlier detection
  }

  const allOutliers: OutlierInfo[] = [];

  // Check hourly forecasts
  const hourlyGroups = groupByTimestamp(forecasts);
  for (const [, items] of hourlyGroups) {
    if (items.length <= 2) continue;
    const { outliers } = calculateHourlyConsensus(items);
    allOutliers.push(...outliers);
  }

  // Check daily forecasts
  const dailyGroups = groupByDate(forecasts);
  for (const [, items] of dailyGroups) {
    if (items.length <= 2) continue;
    const { outliers } = calculateDailyConsensus(items);
    allOutliers.push(...outliers);
  }

  return allOutliers;
}

// Re-export SpreadMetrics and calculateSpread for external use
export { calculateSpread, type SpreadMetrics };
