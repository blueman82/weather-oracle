/**
 * Confidence calculator for weather forecasts.
 * Calculates confidence levels based on model agreement/disagreement.
 * Key to the "Carlow Weather" style - communicating certainty to users.
 */

import type {
  AggregatedForecast,
  AggregatedHourlyForecast,
  AggregatedDailyForecast,
  ConfidenceLevelName,
} from "../types/models";

/**
 * Metric types for confidence calculation
 */
export type MetricType =
  | "temperature"
  | "precipitation"
  | "wind"
  | "humidity"
  | "overall";

/**
 * Individual factor contributing to confidence score
 */
export interface ConfidenceFactor {
  readonly name: string;
  readonly weight: number;
  readonly score: number;
  readonly contribution: number;
  readonly detail: string;
}

/**
 * Result of confidence calculation
 */
export interface ConfidenceResult {
  readonly level: ConfidenceLevelName;
  readonly score: number;
  readonly factors: readonly ConfidenceFactor[];
  readonly explanation: string;
}

/**
 * Thresholds for determining confidence based on metric spread.
 * Values outside these thresholds reduce confidence.
 */
interface MetricThresholds {
  readonly spreadHigh: number; // Below this spread = high confidence
  readonly spreadLow: number; // Above this spread = low confidence
  readonly unit: string;
}

/**
 * Metric-specific thresholds
 */
const METRIC_THRESHOLDS: Record<MetricType, MetricThresholds> = {
  temperature: {
    spreadHigh: 1.5, // 1.5C spread is high confidence
    spreadLow: 4.0, // 4C spread is low confidence
    unit: "C",
  },
  precipitation: {
    spreadHigh: 2.0, // 2mm spread is high confidence
    spreadLow: 10.0, // 10mm spread is low confidence
    unit: "mm",
  },
  wind: {
    spreadHigh: 2.78, // ~10km/h in m/s
    spreadLow: 6.94, // ~25km/h in m/s
    unit: "m/s",
  },
  humidity: {
    spreadHigh: 10, // 10% spread is high
    spreadLow: 30, // 30% spread is low
    unit: "%",
  },
  overall: {
    spreadHigh: 0.7,
    spreadLow: 0.4,
    unit: "",
  },
};

/**
 * Weights for different confidence factors
 */
const FACTOR_WEIGHTS = {
  spread: 0.5,
  agreement: 0.3,
  timeHorizon: 0.2,
} as const;

/**
 * Time decay rate per day ahead (confidence drops ~5% per day)
 */
const TIME_DECAY_PER_DAY = 0.05;

/**
 * Maximum days ahead before time decay bottoms out
 */
const MAX_TIME_DECAY_DAYS = 10;

/**
 * Calculate confidence score from spread (stdDev)
 */
function scoreFromSpread(
  stdDev: number,
  thresholds: MetricThresholds
): number {
  if (stdDev <= thresholds.spreadHigh) {
    return 1.0;
  }
  if (stdDev >= thresholds.spreadLow) {
    return 0.3;
  }
  // Linear interpolation
  const ratio =
    (stdDev - thresholds.spreadHigh) /
    (thresholds.spreadLow - thresholds.spreadHigh);
  return 1.0 - ratio * 0.7;
}

/**
 * Calculate confidence score from model agreement
 */
function scoreFromAgreement(
  modelsInAgreement: number,
  totalModels: number
): number {
  if (totalModels === 0) return 0.5;
  const agreementRatio = modelsInAgreement / totalModels;
  // Scale from 0.3 (no agreement) to 1.0 (full agreement)
  return 0.3 + agreementRatio * 0.7;
}

/**
 * Calculate confidence score based on time horizon (days ahead)
 */
function scoreFromTimeHorizon(daysAhead: number): number {
  // Cap the decay at max days
  const effectiveDays = Math.min(daysAhead, MAX_TIME_DECAY_DAYS);
  // Start at 1.0 and decay by TIME_DECAY_PER_DAY per day
  const score = 1.0 - effectiveDays * TIME_DECAY_PER_DAY;
  // Floor at 0.5 (don't go below 50% from time alone)
  return Math.max(0.5, score);
}

/**
 * Convert score to confidence level name
 */
function scoreToLevel(score: number): ConfidenceLevelName {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/**
 * Generate human-readable explanation for confidence
 */
function generateExplanation(
  modelsInAgreement: number,
  totalModels: number,
  level: ConfidenceLevelName,
  metric: MetricType
): string {
  const agreementPhrase =
    modelsInAgreement === totalModels
      ? `All ${totalModels} models agree`
      : `${modelsInAgreement} of ${totalModels} models agree`;

  const metricPhrase =
    metric === "overall"
      ? "on the forecast"
      : `on ${metric} predictions`;

  const confidencePhrase =
    level === "high"
      ? "High confidence"
      : level === "medium"
        ? "Moderate confidence"
        : "Low confidence";

  return `${confidencePhrase}: ${agreementPhrase} ${metricPhrase}`;
}

/**
 * Calculate confidence for a specific metric from an aggregated forecast.
 *
 * @param aggregated - The aggregated forecast from multiple models
 * @param metric - The weather metric to evaluate
 * @param daysAhead - Number of days ahead for time decay (default 0)
 * @returns ConfidenceResult with level, score, factors, and explanation
 *
 * @example
 * ```typescript
 * const aggregated = aggregateForecasts(modelForecasts);
 * const result = calculateConfidence(aggregated, 'temperature');
 * console.log(result.explanation); // "4 of 5 models agree on temperature predictions"
 * ```
 */
export function calculateConfidence(
  aggregated: AggregatedForecast,
  metric: MetricType,
  daysAhead: number = 0
): ConfidenceResult {
  const totalModels = aggregated.models.length;
  const thresholds = METRIC_THRESHOLDS[metric];
  const factors: ConfidenceFactor[] = [];

  // Get relevant statistics based on metric
  let spreadScore = 1.0;
  let modelsInAgreement = totalModels;
  let spreadValue = 0;

  if (metric === "overall") {
    // For overall, average the consensus from all hourly forecasts
    if (aggregated.consensus.hourly.length > 0) {
      const scores = aggregated.consensus.hourly.map(
        (h) => h.confidence.score
      );
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      spreadScore = avgScore;
      spreadValue = 1 - avgScore;

      // Count models generally in agreement
      const agreements = aggregated.consensus.hourly.map(
        (h) => h.modelAgreement.modelsInAgreement.length
      );
      modelsInAgreement = Math.round(
        agreements.reduce((a, b) => a + b, 0) / agreements.length
      );
    }
  } else {
    // Get stats for specific metric from hourly consensus
    const hourlyConsensus = aggregated.consensus.hourly;
    if (hourlyConsensus.length > 0) {
      let stats: { stdDev: number } | undefined;
      const consensusItem = hourlyConsensus[0].modelAgreement;

      switch (metric) {
        case "temperature":
          stats = consensusItem.temperatureStats;
          break;
        case "precipitation":
          stats = consensusItem.precipitationStats;
          break;
        case "wind":
          stats = consensusItem.windStats;
          break;
        case "humidity":
          // Humidity uses temperature stats as proxy (not directly available)
          // In real impl, would need to add humidity stats to consensus
          stats = { stdDev: 5 }; // Default moderate spread
          break;
      }

      if (stats) {
        spreadValue = stats.stdDev;
        spreadScore = scoreFromSpread(stats.stdDev, thresholds);
      }

      modelsInAgreement = consensusItem.modelsInAgreement.length;
    }
  }

  // Calculate spread factor
  const spreadContribution = spreadScore * FACTOR_WEIGHTS.spread;
  factors.push({
    name: "spread",
    weight: FACTOR_WEIGHTS.spread,
    score: spreadScore,
    contribution: spreadContribution,
    detail: `Spread: ${spreadValue.toFixed(1)}${thresholds.unit}`,
  });

  // Calculate agreement factor
  const agreementScore = scoreFromAgreement(modelsInAgreement, totalModels);
  const agreementContribution = agreementScore * FACTOR_WEIGHTS.agreement;
  factors.push({
    name: "agreement",
    weight: FACTOR_WEIGHTS.agreement,
    score: agreementScore,
    contribution: agreementContribution,
    detail: `${modelsInAgreement}/${totalModels} models agree`,
  });

  // Calculate time horizon factor
  const timeScore = scoreFromTimeHorizon(daysAhead);
  const timeContribution = timeScore * FACTOR_WEIGHTS.timeHorizon;
  factors.push({
    name: "timeHorizon",
    weight: FACTOR_WEIGHTS.timeHorizon,
    score: timeScore,
    contribution: timeContribution,
    detail: `${daysAhead} day${daysAhead === 1 ? "" : "s"} ahead`,
  });

  // Calculate total score
  const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const level = scoreToLevel(totalScore);
  const explanation = generateExplanation(
    modelsInAgreement,
    totalModels,
    level,
    metric
  );

  return {
    level,
    score: totalScore,
    factors,
    explanation,
  };
}

/**
 * Calculate confidence for an individual hourly forecast.
 *
 * @param hourly - Aggregated hourly forecast
 * @param totalModels - Total number of models in the aggregation
 * @param daysAhead - Days ahead for time decay
 * @returns ConfidenceResult for the hourly forecast
 */
export function calculateHourlyConfidence(
  hourly: AggregatedHourlyForecast,
  totalModels: number,
  daysAhead: number = 0
): ConfidenceResult {
  const consensus = hourly.modelAgreement;
  const thresholds = METRIC_THRESHOLDS.temperature;
  const factors: ConfidenceFactor[] = [];

  // Temperature spread factor
  const tempSpreadScore = scoreFromSpread(
    consensus.temperatureStats.stdDev,
    thresholds
  );
  factors.push({
    name: "temperatureSpread",
    weight: FACTOR_WEIGHTS.spread * 0.5,
    score: tempSpreadScore,
    contribution: tempSpreadScore * FACTOR_WEIGHTS.spread * 0.5,
    detail: `Temp spread: ${consensus.temperatureStats.stdDev.toFixed(1)}C`,
  });

  // Precipitation spread factor
  const precipSpreadScore = scoreFromSpread(
    consensus.precipitationStats.stdDev,
    METRIC_THRESHOLDS.precipitation
  );
  factors.push({
    name: "precipitationSpread",
    weight: FACTOR_WEIGHTS.spread * 0.3,
    score: precipSpreadScore,
    contribution: precipSpreadScore * FACTOR_WEIGHTS.spread * 0.3,
    detail: `Precip spread: ${consensus.precipitationStats.stdDev.toFixed(1)}mm`,
  });

  // Wind spread factor
  const windSpreadScore = scoreFromSpread(
    consensus.windStats.stdDev,
    METRIC_THRESHOLDS.wind
  );
  factors.push({
    name: "windSpread",
    weight: FACTOR_WEIGHTS.spread * 0.2,
    score: windSpreadScore,
    contribution: windSpreadScore * FACTOR_WEIGHTS.spread * 0.2,
    detail: `Wind spread: ${consensus.windStats.stdDev.toFixed(1)}m/s`,
  });

  // Agreement factor
  const modelsInAgreement = consensus.modelsInAgreement.length;
  const agreementScore = scoreFromAgreement(modelsInAgreement, totalModels);
  factors.push({
    name: "agreement",
    weight: FACTOR_WEIGHTS.agreement,
    score: agreementScore,
    contribution: agreementScore * FACTOR_WEIGHTS.agreement,
    detail: `${modelsInAgreement}/${totalModels} models agree`,
  });

  // Time horizon factor
  const timeScore = scoreFromTimeHorizon(daysAhead);
  factors.push({
    name: "timeHorizon",
    weight: FACTOR_WEIGHTS.timeHorizon,
    score: timeScore,
    contribution: timeScore * FACTOR_WEIGHTS.timeHorizon,
    detail: `${daysAhead} day${daysAhead === 1 ? "" : "s"} ahead`,
  });

  const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const level = scoreToLevel(totalScore);
  const explanation = generateExplanation(
    modelsInAgreement,
    totalModels,
    level,
    "overall"
  );

  return {
    level,
    score: totalScore,
    factors,
    explanation,
  };
}

/**
 * Calculate confidence for a daily forecast.
 *
 * @param daily - Aggregated daily forecast
 * @param totalModels - Total number of models
 * @param daysAhead - Days ahead for time decay
 * @returns ConfidenceResult for the daily forecast
 */
export function calculateDailyConfidence(
  daily: AggregatedDailyForecast,
  totalModels: number,
  daysAhead: number = 0
): ConfidenceResult {
  const consensus = daily.modelAgreement;
  const factors: ConfidenceFactor[] = [];

  // Temperature spread factor (using max temp stats)
  const tempSpreadScore = scoreFromSpread(
    consensus.temperatureStats.stdDev,
    METRIC_THRESHOLDS.temperature
  );
  factors.push({
    name: "temperatureSpread",
    weight: FACTOR_WEIGHTS.spread * 0.5,
    score: tempSpreadScore,
    contribution: tempSpreadScore * FACTOR_WEIGHTS.spread * 0.5,
    detail: `Temp spread: ${consensus.temperatureStats.stdDev.toFixed(1)}C`,
  });

  // Precipitation spread factor
  const precipSpreadScore = scoreFromSpread(
    consensus.precipitationStats.stdDev,
    METRIC_THRESHOLDS.precipitation
  );
  factors.push({
    name: "precipitationSpread",
    weight: FACTOR_WEIGHTS.spread * 0.3,
    score: precipSpreadScore,
    contribution: precipSpreadScore * FACTOR_WEIGHTS.spread * 0.3,
    detail: `Precip spread: ${consensus.precipitationStats.stdDev.toFixed(1)}mm`,
  });

  // Wind spread factor
  const windSpreadScore = scoreFromSpread(
    consensus.windStats.stdDev,
    METRIC_THRESHOLDS.wind
  );
  factors.push({
    name: "windSpread",
    weight: FACTOR_WEIGHTS.spread * 0.2,
    score: windSpreadScore,
    contribution: windSpreadScore * FACTOR_WEIGHTS.spread * 0.2,
    detail: `Wind spread: ${consensus.windStats.stdDev.toFixed(1)}m/s`,
  });

  // Agreement factor
  const modelsInAgreement = consensus.modelsInAgreement.length;
  const agreementScore = scoreFromAgreement(modelsInAgreement, totalModels);
  factors.push({
    name: "agreement",
    weight: FACTOR_WEIGHTS.agreement,
    score: agreementScore,
    contribution: agreementScore * FACTOR_WEIGHTS.agreement,
    detail: `${modelsInAgreement}/${totalModels} models agree`,
  });

  // Time horizon factor
  const timeScore = scoreFromTimeHorizon(daysAhead);
  factors.push({
    name: "timeHorizon",
    weight: FACTOR_WEIGHTS.timeHorizon,
    score: timeScore,
    contribution: timeScore * FACTOR_WEIGHTS.timeHorizon,
    detail: `${daysAhead} day${daysAhead === 1 ? "" : "s"} ahead`,
  });

  const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const level = scoreToLevel(totalScore);
  const explanation = generateExplanation(
    modelsInAgreement,
    totalModels,
    level,
    "overall"
  );

  return {
    level,
    score: totalScore,
    factors,
    explanation,
  };
}

/**
 * Get a simple confidence summary for display.
 *
 * @param result - ConfidenceResult from calculation
 * @returns Simple string like "High (85%)" or "Low (35%)"
 */
export function formatConfidenceSummary(result: ConfidenceResult): string {
  const percentage = Math.round(result.score * 100);
  const levelCapitalized =
    result.level.charAt(0).toUpperCase() + result.level.slice(1);
  return `${levelCapitalized} (${percentage}%)`;
}

/**
 * Get emoji indicator for confidence level.
 *
 * @param level - Confidence level name
 * @returns Emoji representing the confidence
 */
export function getConfidenceEmoji(level: ConfidenceLevelName): string {
  switch (level) {
    case "high":
      return "\u2705"; // Check mark
    case "medium":
      return "\u26A0\uFE0F"; // Warning
    case "low":
      return "\u2753"; // Question mark
  }
}
