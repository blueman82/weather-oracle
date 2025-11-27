/**
 * Model Agreement Constellation
 *
 * Visual representation of model agreement where clustering instantly
 * communicates uncertainty without reading numbers. Models are mapped
 * to horizontal positions on a scale, creating visual clustering that
 * shows agreement level at a glance.
 */

import { tempToColor } from "./gradient";
import type { WeatherTheme } from "./themes";
import type { ModelForecast, ModelName } from "@weather-oracle/core";

/**
 * A point in the constellation representing a single model's prediction.
 */
export interface ConstellationPoint {
  /** Name of the weather model */
  model: ModelName;
  /** Predicted value for the metric */
  value: number;
  /** Confidence score from 0 to 1 */
  confidence: number;
}

/**
 * Confidence symbols based on score thresholds.
 * - High (>0.8): Filled circle
 * - Medium (0.5-0.8): Half-filled circle
 * - Low (<0.5): Empty circle
 */
const CONFIDENCE_SYMBOLS = {
  high: "●",
  medium: "◐",
  low: "○",
} as const;

/**
 * Returns the appropriate symbol for a confidence score.
 */
function getConfidenceSymbol(confidence: number): string {
  if (confidence > 0.8) return CONFIDENCE_SYMBOLS.high;
  if (confidence >= 0.5) return CONFIDENCE_SYMBOLS.medium;
  return CONFIDENCE_SYMBOLS.low;
}

/**
 * Model name abbreviations for compact display.
 */
const MODEL_ABBREVIATIONS: Record<ModelName, string> = {
  ecmwf: "EC",
  gfs: "GFS",
  icon: "ICN",
  meteofrance: "MF",
  ukmo: "UK",
  jma: "JMA",
  gem: "GEM",
};

/**
 * Extracts constellation points from model forecasts for a specific metric.
 *
 * @param models - Array of model forecasts
 * @param metric - The metric to extract ('temperature', 'precipitation', 'windSpeed')
 * @param hourIndex - Index into the hourly forecast array (default: 0)
 * @returns Array of constellation points
 */
export function extractConstellationPoints(
  models: readonly ModelForecast[],
  metric: "temperature" | "precipitation" | "windSpeed",
  hourIndex: number = 0
): ConstellationPoint[] {
  return models
    .filter((m) => m.hourly.length > hourIndex)
    .map((m) => {
      const hour = m.hourly[hourIndex];
      let value: number;
      switch (metric) {
        case "temperature":
          value = hour.metrics.temperature;
          break;
        case "precipitation":
          value = hour.metrics.precipitation;
          break;
        case "windSpeed":
          value = hour.metrics.windSpeed;
          break;
      }
      return {
        model: m.model,
        value,
        confidence: 0.7, // Default confidence if not available
      };
    });
}

/**
 * Renders a visual constellation of model predictions on a horizontal scale.
 * High agreement shows tight clustering; low agreement shows spread.
 *
 * @param models - Array of model forecasts
 * @param metric - The metric to visualize
 * @param options - Optional configuration
 * @returns Multi-line string visualization
 */
export function renderModelConstellation(
  models: readonly ModelForecast[],
  metric: "temperature" | "precipitation" | "windSpeed",
  options: {
    width?: number;
    hourIndex?: number;
    showLegend?: boolean;
    theme?: WeatherTheme;
  } = {}
): string {
  const { width = 60, hourIndex = 0, showLegend = true } = options;

  const points = extractConstellationPoints(models, metric, hourIndex);

  if (points.length === 0) {
    return "No model data available";
  }

  // Calculate scale range
  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  // Add padding to range if all values are the same
  const displayMin = range === 0 ? minVal - 1 : minVal;
  const displayMax = range === 0 ? maxVal + 1 : maxVal;
  const displayRange = displayMax - displayMin;

  // Map values to positions
  const positions = points.map((p) => ({
    ...p,
    position: Math.round(((p.value - displayMin) / displayRange) * (width - 1)),
  }));

  // Build the constellation row
  const row: string[] = new Array(width).fill(" ");
  const labels: Map<number, string[]> = new Map();

  for (const p of positions) {
    const symbol = getConfidenceSymbol(p.confidence);
    const colorize =
      metric === "temperature" ? tempToColor(p.value) : (s: string) => s;
    row[p.position] = colorize(symbol);

    // Collect labels at each position
    const existing = labels.get(p.position) || [];
    existing.push(MODEL_ABBREVIATIONS[p.model]);
    labels.set(p.position, existing);
  }

  // Build output lines
  const lines: string[] = [];

  // Metric label
  const metricLabels: Record<string, string> = {
    temperature: "Temperature (°C)",
    precipitation: "Precipitation (mm)",
    windSpeed: "Wind Speed (m/s)",
  };
  lines.push(`  ${metricLabels[metric]}`);
  lines.push("");

  // Scale with markers
  const minLabel = displayMin.toFixed(1);
  const maxLabel = displayMax.toFixed(1);
  const scaleLine =
    minLabel + "─".repeat(width - minLabel.length - maxLabel.length) + maxLabel;
  lines.push(`  ${scaleLine}`);

  // Constellation row
  lines.push(`  ${row.join("")}`);

  // Legend if requested
  if (showLegend) {
    lines.push("");
    const labelEntries: string[] = [];
    for (const [pos, modelLabels] of Array.from(labels.entries()).sort(
      (a, b) => a[0] - b[0]
    )) {
      const point = positions.find((p) => p.position === pos);
      if (point) {
        labelEntries.push(`${modelLabels.join(",")}: ${point.value.toFixed(1)}`);
      }
    }
    lines.push(`  ${labelEntries.join("  ")}`);
  }

  return lines.join("\n");
}

/**
 * Calculates the agreement score (0-1) based on model spread.
 * 1 = perfect agreement, 0 = maximum disagreement.
 *
 * @param points - Constellation points to analyze
 * @returns Agreement score from 0 to 1
 */
export function calculateAgreement(points: readonly ConstellationPoint[]): number {
  if (points.length <= 1) return 1;

  const values = points.map((p) => p.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Calculate coefficient of variation (CV)
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : stdDev;

  // Convert CV to agreement score (lower CV = higher agreement)
  // CV of 0.1 (10%) maps to ~0.9 agreement
  // CV of 0.5 (50%) maps to ~0.5 agreement
  return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Renders a compact agreement bar showing consensus level.
 *
 * @param agreement - Agreement score from 0 to 1
 * @param options - Optional configuration
 * @returns Single-line string visualization
 */
export function renderAgreementBar(
  agreement: number,
  options: {
    width?: number;
    showPercentage?: boolean;
  } = {}
): string {
  const { width = 20, showPercentage = true } = options;

  // Clamp agreement to [0, 1]
  const clampedAgreement = Math.max(0, Math.min(1, agreement));
  const filledCount = Math.round(clampedAgreement * width);

  // Use block characters for the bar
  const filled = "█".repeat(filledCount);
  const empty = "░".repeat(width - filledCount);

  // Color based on agreement level
  let bar = `${filled}${empty}`;

  // Add color coding
  if (clampedAgreement >= 0.8) {
    bar = `\x1b[32m${bar}\x1b[0m`; // Green for high agreement
  } else if (clampedAgreement >= 0.5) {
    bar = `\x1b[33m${bar}\x1b[0m`; // Yellow for medium agreement
  } else {
    bar = `\x1b[31m${bar}\x1b[0m`; // Red for low agreement
  }

  if (showPercentage) {
    const percentage = Math.round(clampedAgreement * 100);
    return `[${bar}] ${percentage}%`;
  }

  return `[${bar}]`;
}

/**
 * Renders a full constellation panel with agreement indicator.
 *
 * @param models - Array of model forecasts
 * @param metric - The metric to visualize
 * @param options - Optional configuration
 * @returns Multi-line string with constellation and agreement bar
 */
export function renderConstellationPanel(
  models: readonly ModelForecast[],
  metric: "temperature" | "precipitation" | "windSpeed",
  options: {
    width?: number;
    hourIndex?: number;
    theme?: WeatherTheme;
  } = {}
): string {
  const points = extractConstellationPoints(models, metric, options.hourIndex);
  const agreement = calculateAgreement(points);

  const lines: string[] = [];

  // Title
  lines.push("Model Agreement Constellation");
  lines.push("═".repeat(options.width || 60));

  // Constellation
  lines.push(
    renderModelConstellation(models, metric, {
      ...options,
      showLegend: true,
    })
  );

  // Agreement bar
  lines.push("");
  lines.push(`  Agreement: ${renderAgreementBar(agreement)}`);

  // Interpretation
  let interpretation: string;
  if (agreement >= 0.8) {
    interpretation = "High confidence - models strongly agree";
  } else if (agreement >= 0.5) {
    interpretation = "Moderate confidence - some model divergence";
  } else {
    interpretation = "Low confidence - significant model disagreement";
  }
  lines.push(`  ${interpretation}`);

  return lines.join("\n");
}
