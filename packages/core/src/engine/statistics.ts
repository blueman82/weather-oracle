/**
 * Statistical helper functions for weather data aggregation.
 * Provides mean, median, standard deviation, trimmed mean, and outlier detection.
 */

/**
 * Spread metrics for a set of numeric values
 */
export interface SpreadMetrics {
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly stdDev: number;
  readonly range: number;
}

/**
 * Calculate the arithmetic mean of an array of numbers.
 * Returns 0 for empty arrays.
 */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate the median of an array of numbers.
 * Returns 0 for empty arrays.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate the standard deviation of an array of numbers.
 * Uses population standard deviation (N, not N-1).
 * Returns 0 for empty arrays or single values.
 */
export function stdDev(values: readonly number[]): number {
  if (values.length <= 1) return 0;

  const avg = mean(values);
  const squaredDiffs = values.map((val) => (val - avg) ** 2);
  const avgSquaredDiff = mean(squaredDiffs);
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate the trimmed mean by excluding extreme values.
 * Removes the specified fraction of values from both ends, with a minimum
 * of 1 value from each end for arrays of 4+ values.
 *
 * @param values - Array of numbers
 * @param trimFraction - Fraction to trim from each end (default 0.1 = 10% from each end)
 * @returns Trimmed mean value
 */
export function trimmedMean(
  values: readonly number[],
  trimFraction: number = 0.1
): number {
  if (values.length === 0) return 0;
  if (values.length <= 2) return mean(values);
  if (values.length === 3) {
    // For 3 values, return the median (middle value)
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[1];
  }

  const sorted = [...values].sort((a, b) => a - b);

  // Calculate trim count: use fraction but ensure at least 1 for arrays >= 4
  let trimCount = Math.floor(sorted.length * trimFraction);
  if (trimCount === 0 && sorted.length >= 4) {
    trimCount = 1;
  }

  // Ensure we keep at least 2 values
  const maxTrim = Math.floor((sorted.length - 2) / 2);
  const actualTrim = Math.min(trimCount, maxTrim);

  const trimmed = sorted.slice(actualTrim, sorted.length - actualTrim);
  return mean(trimmed);
}

/**
 * Calculate complete spread metrics for a set of values.
 */
export function calculateSpread(values: readonly number[]): SpreadMetrics {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      range: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];

  return {
    mean: mean(values),
    median: median(values),
    min: minVal,
    max: maxVal,
    stdDev: stdDev(values),
    range: maxVal - minVal,
  };
}

/**
 * Calculate z-score for a value relative to a dataset.
 * Returns 0 if standard deviation is 0.
 */
export function zScore(value: number, values: readonly number[]): number {
  const avg = mean(values);
  const sd = stdDev(values);

  if (sd === 0) return 0;
  return (value - avg) / sd;
}

/**
 * Identify outliers using z-score threshold.
 * Values with |z-score| > threshold are considered outliers.
 *
 * @param values - Array of numbers
 * @param threshold - Z-score threshold (default 2.0)
 * @returns Array of indices that are outliers
 */
export function findOutlierIndices(
  values: readonly number[],
  threshold: number = 2.0
): number[] {
  if (values.length <= 2) return [];

  const avg = mean(values);
  const sd = stdDev(values);

  if (sd === 0) return [];

  const outliers: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const z = Math.abs((values[i] - avg) / sd);
    if (z > threshold) {
      outliers.push(i);
    }
  }

  return outliers;
}

/**
 * Calculate ensemble probability (percentage of values meeting a condition).
 *
 * @param values - Array of numbers
 * @param threshold - Threshold to compare against
 * @param comparison - Comparison type ('gt' for >, 'gte' for >=, 'lt' for <, 'lte' for <=)
 * @returns Percentage (0-100) of values meeting the condition
 */
export function ensembleProbability(
  values: readonly number[],
  threshold: number,
  comparison: "gt" | "gte" | "lt" | "lte" = "gt"
): number {
  if (values.length === 0) return 0;

  let count = 0;
  for (const val of values) {
    let matches = false;
    switch (comparison) {
      case "gt":
        matches = val > threshold;
        break;
      case "gte":
        matches = val >= threshold;
        break;
      case "lt":
        matches = val < threshold;
        break;
      case "lte":
        matches = val <= threshold;
        break;
    }
    if (matches) count++;
  }

  return (count / values.length) * 100;
}

/**
 * Determine confidence level based on standard deviation threshold.
 *
 * @param stdDev - The standard deviation of values
 * @param highThreshold - StdDev below this is "high" confidence
 * @param lowThreshold - StdDev above this is "low" confidence
 * @returns Confidence score between 0 and 1
 */
export function confidenceFromStdDev(
  stdDev: number,
  highThreshold: number,
  lowThreshold: number
): number {
  if (stdDev <= highThreshold) {
    return 1.0;
  }
  if (stdDev >= lowThreshold) {
    return 0.3;
  }
  // Linear interpolation between high and low thresholds
  const ratio = (stdDev - highThreshold) / (lowThreshold - highThreshold);
  return 1.0 - ratio * 0.7; // Maps to 0.3-1.0 range
}

/**
 * Determine confidence level based on range threshold.
 *
 * @param range - The range (max - min) of values
 * @param highThreshold - Range below this is "high" confidence
 * @param lowThreshold - Range above this is "low" confidence
 * @returns Confidence score between 0 and 1
 */
export function confidenceFromRange(
  range: number,
  highThreshold: number,
  lowThreshold: number
): number {
  if (range <= highThreshold) {
    return 1.0;
  }
  if (range >= lowThreshold) {
    return 0.3;
  }
  const ratio = (range - highThreshold) / (lowThreshold - highThreshold);
  return 1.0 - ratio * 0.7;
}
