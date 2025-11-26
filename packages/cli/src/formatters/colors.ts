/**
 * Color utilities and theming for CLI output.
 * Uses chalk for terminal colors with graceful degradation.
 */

import chalk from "chalk";
import type { ColorPalette, FormatterOptions } from "./types";
import type { ConfidenceLevelName } from "@weather-oracle/core";

/**
 * Check if the terminal supports colors
 */
export function supportsColors(): boolean {
  // Check for NO_COLOR environment variable (standard convention)
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  // Check for FORCE_COLOR environment variable
  if (process.env.FORCE_COLOR !== undefined) {
    return true;
  }
  // Default to true for TTY, false otherwise
  return process.stdout.isTTY === true;
}

/**
 * Default color palette using chalk
 * Chalk 5.x uses direct function calls, no Instance constructor
 */
export function createColorPalette(): ColorPalette {
  return {
    temp: {
      hot: chalk.red.bold as unknown as string,       // > 35C
      warm: chalk.yellow as unknown as string,        // 25-35C
      mild: chalk.green as unknown as string,         // 15-25C
      cool: chalk.cyan as unknown as string,          // 5-15C
      cold: chalk.blue as unknown as string,          // -5 to 5C
      freezing: chalk.magenta.bold as unknown as string, // < -5C
    },
    precip: {
      none: chalk.gray as unknown as string,          // 0mm
      light: chalk.cyan as unknown as string,         // 0-2mm
      moderate: chalk.blue as unknown as string,      // 2-10mm
      heavy: chalk.blue.bold as unknown as string,    // > 10mm
    },
    confidence: {
      high: chalk.green as unknown as string,
      medium: chalk.yellow as unknown as string,
      low: chalk.red as unknown as string,
    },
    ui: {
      header: chalk.bold.white as unknown as string,
      label: chalk.dim as unknown as string,
      value: chalk.white as unknown as string,
      muted: chalk.gray as unknown as string,
      warning: chalk.yellow as unknown as string,
      error: chalk.red as unknown as string,
      success: chalk.green as unknown as string,
    },
  };
}

/**
 * No-color palette for plain text output
 */
export function createPlainPalette(): ColorPalette {
  const identity = (s: string) => s;
  return {
    temp: {
      hot: identity,
      warm: identity,
      mild: identity,
      cool: identity,
      cold: identity,
      freezing: identity,
    },
    precip: {
      none: identity,
      light: identity,
      moderate: identity,
      heavy: identity,
    },
    confidence: {
      high: identity,
      medium: identity,
      low: identity,
    },
    ui: {
      header: identity,
      label: identity,
      value: identity,
      muted: identity,
      warning: identity,
      error: identity,
      success: identity,
    },
  } as unknown as ColorPalette;
}

/**
 * Get the appropriate color for a temperature value
 */
export function getTempColor(
  temp: number,
  palette: ColorPalette
): (text: string) => string {
  if (temp > 35) return palette.temp.hot as unknown as (text: string) => string;
  if (temp > 25) return palette.temp.warm as unknown as (text: string) => string;
  if (temp > 15) return palette.temp.mild as unknown as (text: string) => string;
  if (temp > 5) return palette.temp.cool as unknown as (text: string) => string;
  if (temp > -5) return palette.temp.cold as unknown as (text: string) => string;
  return palette.temp.freezing as unknown as (text: string) => string;
}

/**
 * Get the appropriate color for precipitation amount
 */
export function getPrecipColor(
  mm: number,
  palette: ColorPalette
): (text: string) => string {
  if (mm === 0) return palette.precip.none as unknown as (text: string) => string;
  if (mm < 2) return palette.precip.light as unknown as (text: string) => string;
  if (mm < 10) return palette.precip.moderate as unknown as (text: string) => string;
  return palette.precip.heavy as unknown as (text: string) => string;
}

/**
 * Get the appropriate color for confidence level
 */
export function getConfidenceColor(
  level: ConfidenceLevelName,
  palette: ColorPalette
): (text: string) => string {
  return palette.confidence[level] as unknown as (text: string) => string;
}

/**
 * Format temperature with color
 */
export function colorizeTemp(
  temp: number,
  palette: ColorPalette,
  units: "metric" | "imperial" = "metric"
): string {
  const colorFn = getTempColor(temp, palette);
  const displayTemp = units === "imperial" ? (temp * 9) / 5 + 32 : temp;
  const unit = units === "imperial" ? "F" : "C";
  return colorFn(`${Math.round(displayTemp)}\u00B0${unit}`);
}

/**
 * Format precipitation with color
 */
export function colorizePrecip(mm: number, palette: ColorPalette): string {
  const colorFn = getPrecipColor(mm, palette);
  if (mm === 0) return colorFn("0mm");
  if (mm < 0.5) return colorFn("<1mm");
  return colorFn(`${mm.toFixed(1)}mm`);
}

/**
 * Format confidence level with color
 */
export function colorizeConfidence(
  level: ConfidenceLevelName,
  score: number,
  palette: ColorPalette
): string {
  const colorFn = getConfidenceColor(level, palette);
  const percentage = Math.round(score * 100);
  const levelCapitalized = level.charAt(0).toUpperCase() + level.slice(1);
  return colorFn(`${levelCapitalized} (${percentage}%)`);
}

/**
 * Create confidence indicator symbol
 */
export function confidenceIndicator(
  level: ConfidenceLevelName,
  palette: ColorPalette
): string {
  const colorFn = getConfidenceColor(level, palette);
  switch (level) {
    case "high":
      return colorFn("\u2713"); // Check mark
    case "medium":
      return colorFn("~");      // Tilde
    case "low":
      return colorFn("?");      // Question mark
  }
}

/**
 * Get palette based on options
 */
export function getPalette(options?: FormatterOptions): ColorPalette {
  const useColors = options?.useColors ?? supportsColors();
  if (useColors) {
    return createColorPalette();
  }
  return createPlainPalette();
}
