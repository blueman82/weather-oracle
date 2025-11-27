/**
 * Temperature Sparklines
 *
 * Semantic-colored sparkline visualizations where character HEIGHT shows
 * relative value (trend shape) and COLOR shows absolute temperature (feeling).
 */

import { tempToColor } from "./gradient";

/**
 * Unicode block characters for sparkline heights.
 * Index 0 = lowest, index 7 = highest.
 */
export const SPARK_CHARS = [
  "\u2581", // ▁ (lower one eighth)
  "\u2582", // ▂ (lower two eighths)
  "\u2583", // ▃ (lower three eighths)
  "\u2584", // ▄ (lower four eighths)
  "\u2585", // ▅ (lower five eighths)
  "\u2586", // ▆ (lower six eighths)
  "\u2587", // ▇ (lower seven eighths)
  "\u2588", // █ (full block)
] as const;

/**
 * Unicode arrow characters for wind direction.
 * Indices map to 8 compass directions starting from North.
 */
const WIND_ARROWS = [
  "\u2193", // ↓ N (wind FROM north = blowing south)
  "\u2199", // ↙ NE
  "\u2190", // ← E
  "\u2196", // ↖ SE
  "\u2191", // ↑ S
  "\u2197", // ↗ SW
  "\u2192", // → W
  "\u2198", // ↘ NW
] as const;

/**
 * Maps a value to a sparkline character index (0-7).
 * Normalizes to the data range: min→0, max→7.
 *
 * @param value - The value to map
 * @param min - Minimum value in dataset
 * @param max - Maximum value in dataset
 * @returns Index into SPARK_CHARS (0-7)
 */
function valueToCharIndex(value: number, min: number, max: number): number {
  if (min === max) {
    return 4; // Middle height for constant values
  }
  const normalized = (value - min) / (max - min);
  const index = Math.round(normalized * 7);
  return Math.max(0, Math.min(7, index));
}

/**
 * Creates a temperature sparkline where each character's HEIGHT shows
 * relative value (trend) and COLOR shows absolute temperature.
 *
 * @param temps - Array of temperatures in Celsius
 * @returns Sparkline string with ANSI color codes
 */
export function createTempSparkline(temps: number[]): string {
  if (temps.length === 0) {
    return "";
  }

  const min = Math.min(...temps);
  const max = Math.max(...temps);

  return temps
    .map((temp) => {
      const charIndex = valueToCharIndex(temp, min, max);
      const colorFn = tempToColor(temp);
      return colorFn(SPARK_CHARS[charIndex]);
    })
    .join("");
}

/**
 * Precipitation bar characters.
 * Use different fill levels to show probability.
 */
const PRECIP_BARS = [
  " ", // 0%
  "\u2581", // ▁ ~12%
  "\u2582", // ▂ ~25%
  "\u2583", // ▃ ~37%
  "\u2584", // ▄ ~50%
  "\u2585", // ▅ ~62%
  "\u2586", // ▆ ~75%
  "\u2587", // ▇ ~87%
  "\u2588", // █ ~100%
] as const;

/**
 * Creates a precipitation bar visualization showing probability levels.
 * Uses blue color coding with intensity based on probability.
 *
 * @param probabilities - Array of precipitation probabilities (0-100)
 * @returns Precipitation bar string with ANSI color codes
 */
export function createPrecipBars(probabilities: number[]): string {
  if (probabilities.length === 0) {
    return "";
  }

  return probabilities
    .map((prob) => {
      // Clamp probability to 0-100
      const clamped = Math.max(0, Math.min(100, prob));
      // Map to bar index (0-8)
      const barIndex = Math.round(clamped / 12.5);
      const safeIndex = Math.min(8, barIndex);

      // Use blue color with varying intensity
      // Low probability = light blue, high = dark blue
      if (clamped === 0) {
        return PRECIP_BARS[0];
      }

      // Blue ANSI color with intensity based on probability
      const intensity = Math.round(155 + (clamped / 100) * 100);
      return `\x1b[38;2;100;150;${intensity}m${PRECIP_BARS[safeIndex]}\x1b[0m`;
    })
    .join("");
}

/**
 * Maps a wind direction (degrees) to an arrow character.
 *
 * @param degrees - Wind direction in degrees (0-360, 0=North)
 * @returns Arrow character showing wind direction
 */
function directionToArrow(degrees: number): string {
  // Normalize to 0-360
  const normalized = ((degrees % 360) + 360) % 360;
  // Each arrow covers 45 degrees, offset by 22.5 for centering
  const index = Math.round(normalized / 45) % 8;
  return WIND_ARROWS[index];
}

/**
 * Wind speed color thresholds (m/s).
 */
const WIND_SPEED_COLORS = [
  { threshold: 0, color: { r: 150, g: 200, b: 150 } }, // Calm - soft green
  { threshold: 5, color: { r: 200, g: 200, b: 100 } }, // Light - yellow-green
  { threshold: 10, color: { r: 255, g: 200, b: 50 } }, // Moderate - gold
  { threshold: 15, color: { r: 255, g: 150, b: 50 } }, // Fresh - orange
  { threshold: 20, color: { r: 255, g: 100, b: 50 } }, // Strong - red-orange
  { threshold: 25, color: { r: 255, g: 50, b: 100 } }, // Very strong - red
  { threshold: 30, color: { r: 200, g: 50, b: 200 } }, // Storm - purple
] as const;

/**
 * Gets a color for a wind speed.
 *
 * @param speed - Wind speed in m/s
 * @returns RGB color object
 */
function windSpeedColor(speed: number): { r: number; g: number; b: number } {
  for (let i = WIND_SPEED_COLORS.length - 1; i >= 0; i--) {
    if (speed >= WIND_SPEED_COLORS[i].threshold) {
      return WIND_SPEED_COLORS[i].color;
    }
  }
  return WIND_SPEED_COLORS[0].color;
}

/**
 * Creates a wind arrow visualization with direction and speed coloring.
 *
 * @param directions - Array of wind directions in degrees (0-360)
 * @param speeds - Array of wind speeds in m/s
 * @returns Wind arrow string with ANSI color codes
 */
export function createWindArrows(
  directions: number[],
  speeds: number[]
): string {
  if (directions.length === 0 || speeds.length === 0) {
    return "";
  }

  // Use the shorter array length
  const length = Math.min(directions.length, speeds.length);

  return Array.from({ length })
    .map((_, i) => {
      const arrow = directionToArrow(directions[i]);
      const color = windSpeedColor(speeds[i]);
      return `\x1b[38;2;${color.r};${color.g};${color.b}m${arrow}\x1b[0m`;
    })
    .join("");
}
