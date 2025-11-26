/**
 * Multi-model aggregation engine for Weather Oracle.
 * Combines forecasts from multiple weather models into a unified view.
 */

export {
  aggregateForecasts,
  identifyOutliers,
  calculateSpread,
  type SpreadMetrics,
  type OutlierInfo,
} from "./aggregator";

export {
  mean,
  median,
  stdDev,
  trimmedMean,
  findOutlierIndices,
  ensembleProbability,
  confidenceFromStdDev,
  confidenceFromRange,
} from "./statistics";

export {
  calculateConfidence,
  calculateHourlyConfidence,
  calculateDailyConfidence,
  formatConfidenceSummary,
  getConfidenceEmoji,
  type MetricType,
  type ConfidenceFactor,
  type ConfidenceResult,
} from "./confidence";

export {
  generateNarrative,
  classifyNarrativeType,
  getDominantCondition,
  findTransitionDay,
  identifyOutlierModels,
  getAverageConfidenceLevel,
  type NarrativeSummary,
  type NarrativeType,
} from "./narrative";

export {
  weatherCodeToCondition,
  conditionToDescription,
  isPrecipitation,
  isDryCondition,
  formatConfidenceLevel,
  formatModelName,
  formatModelList,
  formatTemperature,
  formatPrecipitation,
  formatRelativeDay,
  formatTimePeriod,
  fillTemplate,
  selectTemplate,
  type WeatherCondition,
} from "./templates";
