/**
 * Narrative generator for Carlow Weather-style plain language summaries.
 * Explains forecasts in accessible terms, highlighting model agreement and key changes.
 */

import type {
  AggregatedForecast,
  AggregatedDailyForecast,
  ModelName,
  ConfidenceLevelName,
} from "../types/models";
import type { ConfidenceResult } from "./confidence";
import {
  weatherCodeToCondition,
  conditionToDescription,
  isPrecipitation,
  isDryCondition,
  formatModelName,
  formatModelList,
  formatTemperature,
  formatPrecipitation,
  formatRelativeDay,
  fillTemplate,
  selectTemplate,
  AGREEMENT_TEMPLATES,
  TRANSITION_TEMPLATES,
  UNCERTAINTY_TEMPLATES,
  CONFIDENCE_TEMPLATES,
  type WeatherCondition,
} from "./templates";

/**
 * Safely convert a Date or string to ISO string.
 * Handles cached data where Dates become strings after JSON serialization.
 */
function toISOString(value: Date | string): string {
  if (typeof value === "string") {
    return value;
  }
  return value.toISOString();
}

/**
 * Safely convert a Date or string to a Date object.
 * Handles cached data where Dates become strings after JSON serialization.
 */
function toDate(value: Date | string): Date {
  if (typeof value === "string") {
    return new Date(value);
  }
  return value;
}

/**
 * Narrative summary for a forecast
 */
export interface NarrativeSummary {
  readonly headline: string;
  readonly body: string;
  readonly alerts: readonly string[];
  readonly modelNotes: readonly string[];
}

/**
 * Narrative type classification
 */
export type NarrativeType = "agreement" | "disagreement" | "transition";

/**
 * Z-score threshold for significant outlier callout
 */
const OUTLIER_CALLOUT_THRESHOLD = 2.0;

/**
 * Days ahead threshold for uncertainty warning
 */
const UNCERTAINTY_DAYS_THRESHOLD = 5;

/**
 * Classify the narrative type based on aggregated data
 */
function classifyNarrativeType(
  aggregated: AggregatedForecast,
  confidence: readonly ConfidenceResult[]
): NarrativeType {
  // Check for high disagreement (low confidence)
  const avgConfidence =
    confidence.length > 0
      ? confidence.reduce((sum, c) => sum + c.score, 0) / confidence.length
      : 0.5;

  if (avgConfidence < 0.5) {
    return "disagreement";
  }

  // Check for weather transition
  if (aggregated.consensus.daily.length >= 2) {
    const firstCondition = weatherCodeToCondition(
      aggregated.consensus.daily[0].forecast.weatherCode
    );
    const lastCondition = weatherCodeToCondition(
      aggregated.consensus.daily[aggregated.consensus.daily.length - 1].forecast.weatherCode
    );

    const firstIsDry = isDryCondition(firstCondition);
    const lastIsDry = isDryCondition(lastCondition);

    if (firstIsDry !== lastIsDry) {
      return "transition";
    }
  }

  return "agreement";
}

/**
 * Get the dominant weather condition from aggregated forecast
 */
function getDominantCondition(aggregated: AggregatedForecast): WeatherCondition {
  if (aggregated.consensus.daily.length === 0) {
    return "unknown";
  }

  // Find most common condition across forecast period
  const conditionCounts = new Map<WeatherCondition, number>();

  for (const daily of aggregated.consensus.daily) {
    const condition = weatherCodeToCondition(daily.forecast.weatherCode);
    conditionCounts.set(condition, (conditionCounts.get(condition) ?? 0) + 1);
  }

  let dominant: WeatherCondition = "unknown";
  let maxCount = 0;

  for (const [condition, count] of conditionCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = condition;
    }
  }

  return dominant;
}

/**
 * Find the day when weather changes (transition point)
 */
function findTransitionDay(
  aggregated: AggregatedForecast
): { day: AggregatedDailyForecast; condition: WeatherCondition; period: string } | null {
  if (aggregated.consensus.daily.length < 2) {
    return null;
  }

  const firstCondition = weatherCodeToCondition(
    aggregated.consensus.daily[0].forecast.weatherCode
  );
  const firstIsDry = isDryCondition(firstCondition);

  for (let i = 1; i < aggregated.consensus.daily.length; i++) {
    const dayCondition = weatherCodeToCondition(
      aggregated.consensus.daily[i].forecast.weatherCode
    );
    const dayIsDry = isDryCondition(dayCondition);

    if (firstIsDry !== dayIsDry) {
      return {
        day: aggregated.consensus.daily[i],
        condition: dayCondition,
        period: "afternoon", // Default; could be improved with hourly analysis
      };
    }
  }

  return null;
}

/**
 * Identify models that are outliers for specific metrics
 */
function identifyOutlierModels(
  aggregated: AggregatedForecast
): Array<{ model: ModelName; metric: string; value: number; zScore: number }> {
  const outliers: Array<{ model: ModelName; metric: string; value: number; zScore: number }> = [];

  // Check daily forecast outliers
  for (const daily of aggregated.consensus.daily) {
    const consensus = daily.modelAgreement;

    for (const outlierModel of consensus.outlierModels) {
      // Find the specific value for this model
      const modelForecast = aggregated.modelForecasts.find(
        (f) => f.model === outlierModel
      );

      if (modelForecast) {
        const modelDaily = modelForecast.daily.find(
          (d) => toISOString(d.date).split("T")[0] === toISOString(daily.date).split("T")[0]
        );

        if (modelDaily) {
          // Check temperature
          const tempDiff = Math.abs(
            modelDaily.temperature.max - consensus.temperatureStats.mean
          );
          const tempZScore =
            consensus.temperatureStats.stdDev > 0
              ? tempDiff / consensus.temperatureStats.stdDev
              : 0;

          if (tempZScore > OUTLIER_CALLOUT_THRESHOLD) {
            outliers.push({
              model: outlierModel,
              metric: "temperature",
              value: modelDaily.temperature.max,
              zScore: tempZScore,
            });
          }

          // Check precipitation
          const precipDiff = Math.abs(
            modelDaily.precipitation.total - consensus.precipitationStats.mean
          );
          const precipZScore =
            consensus.precipitationStats.stdDev > 0
              ? precipDiff / consensus.precipitationStats.stdDev
              : 0;

          if (precipZScore > OUTLIER_CALLOUT_THRESHOLD) {
            outliers.push({
              model: outlierModel,
              metric: "precipitation",
              value: modelDaily.precipitation.total,
              zScore: precipZScore,
            });
          }
        }
      }
    }
  }

  return outliers;
}

/**
 * Generate headline for agreement narrative
 */
function generateAgreementHeadline(
  aggregated: AggregatedForecast,
  dominantCondition: WeatherCondition
): string {
  const description = conditionToDescription(dominantCondition);
  const endDay =
    aggregated.consensus.daily.length > 0
      ? formatRelativeDay(
          aggregated.consensus.daily[aggregated.consensus.daily.length - 1].date
        )
      : "the forecast period";

  return fillTemplate(selectTemplate(AGREEMENT_TEMPLATES.strong), {
    condition: description,
    endDay,
  });
}

/**
 * Generate headline for disagreement narrative
 */
function generateDisagreementHeadline(
  aggregated: AggregatedForecast,
  _confidence: readonly ConfidenceResult[]
): string {
  // Find which metric has highest disagreement
  const firstDaily = aggregated.consensus.daily[0];
  if (!firstDaily) {
    return "Models show significant uncertainty in the forecast.";
  }

  const tempRange =
    firstDaily.range.temperatureMax.max - firstDaily.range.temperatureMax.min;

  if (tempRange > 5) {
    return "Models disagree significantly on temperatures this period.";
  }

  const precipRange =
    firstDaily.range.precipitation.max - firstDaily.range.precipitation.min;

  if (precipRange > 10) {
    return "Precipitation amounts uncertain - models show different scenarios.";
  }

  return "Model disagreement creates forecast uncertainty.";
}

/**
 * Generate headline for transition narrative
 */
function generateTransitionHeadline(
  aggregated: AggregatedForecast,
  transition: { day: AggregatedDailyForecast; condition: WeatherCondition; period: string }
): string {
  const firstCondition = weatherCodeToCondition(
    aggregated.consensus.daily[0].forecast.weatherCode
  );
  const firstIsDry = isDryCondition(firstCondition);

  const description = conditionToDescription(transition.condition);
  const dayName = formatRelativeDay(transition.day.date);

  if (firstIsDry && isPrecipitation(transition.condition)) {
    return fillTemplate(selectTemplate(TRANSITION_TEMPLATES.dryToWet), {
      condition: description.charAt(0).toUpperCase() + description.slice(1),
      day: dayName,
      period: transition.period,
    });
  }

  return fillTemplate(selectTemplate(TRANSITION_TEMPLATES.wetToDry), {
    condition: description,
    day: dayName,
  });
}

/**
 * Generate body text with model details
 */
function generateBody(
  aggregated: AggregatedForecast,
  confidence: readonly ConfidenceResult[],
  narrativeType: NarrativeType
): string {
  const sentences: string[] = [];

  // Add context based on narrative type
  if (narrativeType === "disagreement") {
    // Highlight the disagreement
    const firstDaily = aggregated.consensus.daily[0];
    if (firstDaily) {
      const tempStats = firstDaily.modelAgreement.temperatureStats;
      if (tempStats.range > 5) {
        const highModels = firstDaily.modelAgreement.outlierModels.filter(
          (m) => {
            const forecast = aggregated.modelForecasts.find((f) => f.model === m);
            const daily = forecast?.daily.find(
              (d) =>
                toISOString(d.date).split("T")[0] ===
                toISOString(firstDaily.date).split("T")[0]
            );
            return daily && daily.temperature.max > tempStats.mean;
          }
        );

        const lowModels = firstDaily.modelAgreement.outlierModels.filter(
          (m) => !highModels.includes(m)
        );

        if (highModels.length > 0 && lowModels.length > 0) {
          sentences.push(
            `${formatModelList(highModels)} ${highModels.length === 1 ? "predicts" : "predict"} ${formatTemperature(firstDaily.range.temperatureMax.max)} while ${formatModelList(lowModels)} ${lowModels.length === 1 ? "shows" : "show"} only ${formatTemperature(firstDaily.range.temperatureMax.min)}.`
          );
        }
      }
    }
  } else if (narrativeType === "transition") {
    // Describe the transition
    const transition = findTransitionDay(aggregated);
    if (transition && isPrecipitation(transition.condition)) {
      // Find precipitation amounts from models
      const dayDate = toISOString(transition.day.date).split("T")[0];
      const precipAmounts: Array<{ model: ModelName; amount: number }> = [];

      for (const modelForecast of aggregated.modelForecasts) {
        const daily = modelForecast.daily.find(
          (d) => toISOString(d.date).split("T")[0] === dayDate
        );
        if (daily) {
          precipAmounts.push({
            model: modelForecast.model,
            amount: daily.precipitation.total,
          });
        }
      }

      if (precipAmounts.length >= 2) {
        const sorted = [...precipAmounts].sort((a, b) => b.amount - a.amount);
        const high = sorted[0];
        const low = sorted[sorted.length - 1];

        if (high.amount - low.amount > 5) {
          sentences.push(
            `${formatModelName(high.model)} and ${formatModelName(sorted[1]?.model ?? low.model)} show heavier rain (${formatPrecipitation(high.amount)}) while ${formatModelName(low.model)} predicts a lighter system (${formatPrecipitation(low.amount)}).`
          );
        }
      }
    }
  }

  // Add confidence statement
  if (confidence.length > 0) {
    const avgLevel = getAverageConfidenceLevel(confidence);
    const periodDesc =
      narrativeType === "transition"
        ? "the dry period"
        : "this forecast period";

    sentences.push(
      fillTemplate(CONFIDENCE_TEMPLATES[avgLevel], { period: periodDesc })
    );
  }

  return sentences.join(" ");
}

/**
 * Get average confidence level from results
 */
function getAverageConfidenceLevel(
  confidence: readonly ConfidenceResult[]
): ConfidenceLevelName {
  if (confidence.length === 0) return "medium";

  const avgScore =
    confidence.reduce((sum, c) => sum + c.score, 0) / confidence.length;

  if (avgScore >= 0.8) return "high";
  if (avgScore >= 0.5) return "medium";
  return "low";
}

/**
 * Generate alerts for notable divergences
 */
function generateAlerts(
  aggregated: AggregatedForecast,
  confidence: readonly ConfidenceResult[]
): string[] {
  const alerts: string[] = [];

  // Check for extended range uncertainty
  if (aggregated.consensus.daily.length > 0) {
    const lastDay = aggregated.consensus.daily[aggregated.consensus.daily.length - 1];
    const today = new Date();
    const daysAhead = Math.round(
      (toDate(lastDay.date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysAhead >= UNCERTAINTY_DAYS_THRESHOLD) {
      const checkDay = formatRelativeDay(
        new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
      );
      alerts.push(
        fillTemplate(selectTemplate(UNCERTAINTY_TEMPLATES), {
          days: String(UNCERTAINTY_DAYS_THRESHOLD),
          checkDay,
        })
      );
    }
  }

  // Check for significant model disagreement
  const avgConfidence =
    confidence.length > 0
      ? confidence.reduce((sum, c) => sum + c.score, 0) / confidence.length
      : 0.5;

  if (avgConfidence < 0.5) {
    alerts.push(
      "Significant model disagreement - consider multiple scenarios."
    );
  }

  return alerts;
}

/**
 * Generate model-specific notes for outliers
 */
function generateModelNotes(
  aggregated: AggregatedForecast
): string[] {
  const notes: string[] = [];
  const outliers = identifyOutlierModels(aggregated);

  // Group outliers by model
  const byModel = new Map<ModelName, typeof outliers>();

  for (const outlier of outliers) {
    const existing = byModel.get(outlier.model) ?? [];
    existing.push(outlier);
    byModel.set(outlier.model, existing);
  }

  // Generate notes for each outlier model
  for (const [model, modelOutliers] of byModel) {
    if (modelOutliers.length === 0) continue;

    const tempOutlier = modelOutliers.find((o) => o.metric === "temperature");
    const precipOutlier = modelOutliers.find((o) => o.metric === "precipitation");

    if (tempOutlier && Math.abs(tempOutlier.zScore) > OUTLIER_CALLOUT_THRESHOLD) {
      const direction = tempOutlier.zScore > 0 ? "warmer" : "cooler";
      notes.push(
        `${formatModelName(model)} is notably ${direction} at ${formatTemperature(tempOutlier.value)}.`
      );
    }

    if (precipOutlier && Math.abs(precipOutlier.zScore) > OUTLIER_CALLOUT_THRESHOLD) {
      const direction = precipOutlier.zScore > 0 ? "wetter" : "drier";
      notes.push(
        `${formatModelName(model)} shows a ${direction} scenario (${formatPrecipitation(precipOutlier.value)}).`
      );
    }
  }

  return notes;
}

/**
 * Generate a Carlow Weather-style narrative summary from aggregated forecast data.
 *
 * @param aggregated - The aggregated forecast from multiple models
 * @param confidence - Array of confidence results for the forecast periods
 * @returns NarrativeSummary with headline, body, alerts, and model notes
 *
 * @example
 * ```typescript
 * const aggregated = aggregateForecasts(modelForecasts);
 * const confidence = [calculateConfidence(aggregated, 'overall', 0)];
 * const narrative = generateNarrative(aggregated, confidence);
 *
 * console.log(narrative.headline);
 * // "Models agree on dry conditions through Wednesday."
 *
 * console.log(narrative.body);
 * // "ECMWF and GFS show heavier rain (15-20mm) while ICON predicts..."
 * ```
 */
export function generateNarrative(
  aggregated: AggregatedForecast,
  confidence: readonly ConfidenceResult[]
): NarrativeSummary {
  // Handle empty forecast
  if (aggregated.consensus.daily.length === 0) {
    return {
      headline: "No forecast data available.",
      body: "",
      alerts: [],
      modelNotes: [],
    };
  }

  // Classify the narrative type
  const narrativeType = classifyNarrativeType(aggregated, confidence);
  const dominantCondition = getDominantCondition(aggregated);
  const transition = findTransitionDay(aggregated);

  // Generate headline based on narrative type
  let headline: string;
  switch (narrativeType) {
    case "agreement":
      headline = generateAgreementHeadline(aggregated, dominantCondition);
      break;
    case "disagreement":
      headline = generateDisagreementHeadline(aggregated, confidence);
      break;
    case "transition":
      headline = transition
        ? generateTransitionHeadline(aggregated, transition)
        : generateAgreementHeadline(aggregated, dominantCondition);
      break;
  }

  // Generate body, alerts, and model notes
  const body = generateBody(aggregated, confidence, narrativeType);
  const alerts = generateAlerts(aggregated, confidence);
  const modelNotes = generateModelNotes(aggregated);

  return {
    headline,
    body,
    alerts,
    modelNotes,
  };
}

// Export helper functions for testing
export {
  classifyNarrativeType,
  getDominantCondition,
  findTransitionDay,
  identifyOutlierModels,
  getAverageConfidenceLevel,
};
