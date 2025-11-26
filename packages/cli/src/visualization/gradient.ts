/**
 * True-Color Gradient System
 *
 * Temperature gradient system using LAB interpolation for smooth,
 * perceptually-uniform color transitions from arctic violet to crimson.
 * Supports progressive degradation based on terminal capabilities.
 */

import { RenderTier, detectColorSupport } from "./terminal";
import { labToRgb, interpolateLab, type LAB, type RGB } from "./color-space";

/**
 * Temperature color stops in LAB space.
 * From deep arctic violet (-30°C) to crimson danger (40°C).
 */
export const TEMP_GRADIENT_LAB: ReadonlyArray<{ temp: number; lab: LAB }> = [
  { temp: -30, lab: { l: 25, a: 45, b: -65 } }, // Deep arctic violet
  { temp: -10, lab: { l: 45, a: 25, b: -45 } }, // Purple-blue
  { temp: 0, lab: { l: 65, a: 5, b: -30 } }, // Steel blue
  { temp: 10, lab: { l: 75, a: -15, b: 15 } }, // Sage green
  { temp: 20, lab: { l: 85, a: 0, b: 30 } }, // Warm cream
  { temp: 30, lab: { l: 70, a: 35, b: 55 } }, // Tangerine
  { temp: 40, lab: { l: 55, a: 65, b: 50 } }, // Crimson danger
];

// Cached render tier to avoid repeated detection
let cachedTier: RenderTier | null = null;

/**
 * Gets the cached render tier, detecting if necessary.
 */
function getTier(): RenderTier {
  if (cachedTier === null) {
    cachedTier = detectColorSupport();
  }
  return cachedTier;
}

/**
 * Clears the cached tier. Useful for testing.
 */
export function clearGradientCache(): void {
  cachedTier = null;
}

/**
 * Finds the indices of the two temperature stops that bracket the given temperature.
 * Uses binary search for efficiency.
 *
 * @param temp - Temperature in Celsius
 * @returns Tuple of [lowerIndex, upperIndex]
 */
function findStopIndices(temp: number): [number, number] {
  // Handle edge cases
  if (temp <= TEMP_GRADIENT_LAB[0].temp) {
    return [0, 0];
  }
  if (temp >= TEMP_GRADIENT_LAB[TEMP_GRADIENT_LAB.length - 1].temp) {
    return [TEMP_GRADIENT_LAB.length - 1, TEMP_GRADIENT_LAB.length - 1];
  }

  // Binary search for the bracketing stops
  let low = 0;
  let high = TEMP_GRADIENT_LAB.length - 1;

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (TEMP_GRADIENT_LAB[mid].temp <= temp) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return [low, high];
}

/**
 * Interpolates the color for a given temperature using LAB color space.
 *
 * @param temp - Temperature in Celsius
 * @returns RGB color for the temperature
 */
export function interpolateColor(temp: number): RGB {
  const [lowIdx, highIdx] = findStopIndices(temp);

  // If at or beyond edges, return the edge color
  if (lowIdx === highIdx) {
    return labToRgb(TEMP_GRADIENT_LAB[lowIdx].lab);
  }

  const lowStop = TEMP_GRADIENT_LAB[lowIdx];
  const highStop = TEMP_GRADIENT_LAB[highIdx];

  // Calculate interpolation factor
  const range = highStop.temp - lowStop.temp;
  const t = (temp - lowStop.temp) / range;

  // Interpolate in LAB space and convert to RGB
  const interpolatedLab = interpolateLab(lowStop.lab, highStop.lab, t);
  return labToRgb(interpolatedLab);
}

/**
 * Returns a function that wraps text with ANSI truecolor escape sequences
 * for the given temperature. Automatically degrades based on terminal tier.
 *
 * @param temp - Temperature in Celsius
 * @returns Function that wraps text with appropriate color codes
 */
export function tempToColor(temp: number): (text: string) => string {
  const tier = getTier();

  switch (tier) {
    case RenderTier.RICH:
    case RenderTier.FULL: {
      const rgb = interpolateColor(temp);
      return (text: string) =>
        `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;
    }
    case RenderTier.STANDARD: {
      const ansi256 = tempToAnsi256(temp);
      return (text: string) => `\x1b[38;5;${ansi256}m${text}\x1b[0m`;
    }
    case RenderTier.COMPAT: {
      const ansi16 = tempTo16Color(temp);
      return (text: string) => `${ansi16}${text}\x1b[0m`;
    }
    case RenderTier.PLAIN:
    default:
      return (text: string) => text;
  }
}

/**
 * Converts a temperature to the nearest ANSI 256-color palette index.
 * Uses the 6x6x6 color cube (indices 16-231).
 *
 * @param temp - Temperature in Celsius
 * @returns ANSI 256-color palette index
 */
export function tempToAnsi256(temp: number): number {
  const rgb = interpolateColor(temp);

  // Convert RGB to 6x6x6 cube indices (0-5 range for each channel)
  const r6 = Math.round((rgb.r / 255) * 5);
  const g6 = Math.round((rgb.g / 255) * 5);
  const b6 = Math.round((rgb.b / 255) * 5);

  // ANSI 256 color cube starts at index 16
  // Formula: 16 + 36*r + 6*g + b
  return 16 + 36 * r6 + 6 * g6 + b6;
}

// ANSI 16-color escape sequences
const ANSI_16_COLORS = {
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  brightBlue: "\x1b[94m",
  brightCyan: "\x1b[96m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightRed: "\x1b[91m",
  brightMagenta: "\x1b[95m",
} as const;

/**
 * Converts a temperature to a basic 16-color ANSI escape sequence.
 * Maps temperature ranges to semantic colors.
 *
 * @param temp - Temperature in Celsius
 * @returns ANSI escape sequence string for the color
 */
export function tempTo16Color(temp: number): string {
  if (temp <= -20) {
    return ANSI_16_COLORS.magenta; // Deep cold - magenta/violet
  }
  if (temp <= -5) {
    return ANSI_16_COLORS.blue; // Cold - blue
  }
  if (temp <= 5) {
    return ANSI_16_COLORS.cyan; // Cool - cyan
  }
  if (temp <= 15) {
    return ANSI_16_COLORS.green; // Mild - green
  }
  if (temp <= 25) {
    return ANSI_16_COLORS.yellow; // Warm - yellow
  }
  if (temp <= 35) {
    return ANSI_16_COLORS.brightRed; // Hot - bright red
  }
  return ANSI_16_COLORS.red; // Extreme heat - red
}
