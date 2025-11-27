/**
 * 7-Day Heatmap Grid Visualization
 *
 * Creates a 7×24 colored matrix showing the week's temperature pattern at a glance.
 * Uses half-block characters for density and LAB-interpolated colors for
 * perceptually-uniform temperature representation.
 */

import type { DailyForecast } from "@weather-oracle/core";
import { tempToColor } from "./gradient";

/**
 * Represents a single cell in the heatmap grid.
 */
export interface HeatmapCell {
  readonly temp: number;
  readonly hour: number;
  readonly day: number;
}

/**
 * Interpolates hourly temperatures from daily forecast data.
 * Creates smooth temperature curves between min and max.
 *
 * @param forecast - Daily forecast with temperature range
 * @returns Array of 24 interpolated temperatures (one per hour)
 */
function interpolateHourlyTemps(forecast: DailyForecast): number[] {
  const { min, max } = forecast.temperature;
  const minTemp = min as number;
  const maxTemp = max as number;

  // If we have hourly data, use it directly
  if (forecast.hourly && forecast.hourly.length >= 24) {
    return forecast.hourly
      .slice(0, 24)
      .map((h) => h.metrics.temperature as number);
  }

  // Otherwise, interpolate using a realistic daily temperature curve
  // Temperature typically:
  // - Lowest around 5-6 AM
  // - Rises to peak around 2-3 PM
  // - Falls again through evening
  const temps: number[] = [];

  for (let hour = 0; hour < 24; hour++) {
    // Use a sinusoidal approximation of daily temperature cycle
    // Phase shifted so minimum is at ~5 AM and maximum at ~3 PM
    const phaseShift = (hour - 5) * ((2 * Math.PI) / 24);
    const normalizedTemp = (1 - Math.cos(phaseShift)) / 2;
    temps.push(minTemp + normalizedTemp * (maxTemp - minTemp));
  }

  return temps;
}

/**
 * Generates the heatmap grid data from forecasts.
 *
 * @param forecasts - Array of daily forecasts (up to 7 days)
 * @returns 2D array of HeatmapCells [hour][day]
 */
function generateHeatmapGrid(forecasts: DailyForecast[]): HeatmapCell[][] {
  const days = Math.min(forecasts.length, 7);
  const grid: HeatmapCell[][] = [];

  // Initialize grid with 24 hours
  for (let hour = 0; hour < 24; hour++) {
    grid[hour] = [];
    for (let day = 0; day < days; day++) {
      const hourlyTemps = interpolateHourlyTemps(forecasts[day]);
      grid[hour][day] = {
        temp: hourlyTemps[hour],
        hour,
        day,
      };
    }
  }

  return grid;
}

/**
 * Formats a day name from a date.
 *
 * @param date - Date object
 * @returns Short day name (e.g., "Mon", "Tue")
 */
function formatDayLabel(date: Date | string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const d = typeof date === "string" ? new Date(date) : date;
  return days[d.getDay()];
}

/**
 * Renders a 7-day temperature heatmap visualization.
 *
 * The heatmap displays a 7×24 grid where:
 * - Columns represent days (up to 7)
 * - Rows represent hours (0-23)
 * - Colors indicate temperature using the gradient system
 *
 * @param forecasts - Array of daily forecasts (up to 7 days)
 * @returns Multi-line string containing the rendered heatmap
 */
export function render7DayHeatMap(forecasts: DailyForecast[]): string {
  if (forecasts.length === 0) {
    return "No forecast data available for heatmap.";
  }

  const days = Math.min(forecasts.length, 7);
  const grid = generateHeatmapGrid(forecasts);

  const lines: string[] = [];

  // Header with day labels
  let header = "     "; // Space for hour labels
  for (let day = 0; day < days; day++) {
    const dayLabel = formatDayLabel(forecasts[day].date);
    header += ` ${dayLabel}`;
  }
  lines.push(header);

  // Render each pair of hours (for compact display using 2 blocks per pair)
  for (let hourPair = 0; hourPair < 12; hourPair++) {
    const topHour = hourPair * 2;

    // Hour label on the left
    const hourLabel = topHour.toString().padStart(2, "0") + "h ";

    // Render the row
    const rowContent = renderHeatmapRowSimple(grid, topHour, days);
    lines.push(hourLabel + rowContent);
  }

  // Bottom time marker
  lines.push("     " + "24h".padStart(days * 4 - 1));

  return lines.join("\n");
}

/**
 * Simplified heatmap row rendering - one block per hour/day cell.
 *
 * @param grid - The heatmap grid data
 * @param startHour - Starting hour for this row
 * @param days - Number of days to render
 * @returns Colored string for the row
 */
function renderHeatmapRowSimple(
  grid: HeatmapCell[][],
  startHour: number,
  days: number
): string {
  let row = "";

  for (let day = 0; day < days; day++) {
    // Use two blocks per row to represent 2 hours
    const cell1 = grid[startHour]?.[day];
    const cell2 = grid[startHour + 1]?.[day];

    if (cell1) {
      const colorFn1 = tempToColor(cell1.temp);
      row += colorFn1("▀");
    }
    if (cell2) {
      const colorFn2 = tempToColor(cell2.temp);
      row += colorFn2("▄");
    }
    row += " ";
  }

  return row.trimEnd();
}

/**
 * Renders a temperature legend for the heatmap.
 *
 * Shows a gradient bar with labeled temperature stops.
 *
 * @param minTemp - Minimum temperature in the data (Celsius)
 * @param maxTemp - Maximum temperature in the data (Celsius)
 * @returns Multi-line string containing the legend
 */
export function renderHeatmapLegend(
  minTemp: number,
  maxTemp: number
): string {
  const lines: string[] = [];

  // Calculate legend stops
  const range = maxTemp - minTemp;
  const stops = 10;
  const step = range / (stops - 1);

  // Build gradient bar
  let gradientBar = "";
  for (let i = 0; i < stops; i++) {
    const temp = minTemp + i * step;
    const colorFn = tempToColor(temp);
    gradientBar += colorFn("█");
  }

  // Temperature labels
  const minLabel = `${Math.round(minTemp)}°`;
  const maxLabel = `${Math.round(maxTemp)}°`;

  lines.push("Temperature Scale:");
  lines.push(`${minLabel}${gradientBar}${maxLabel}`);

  return lines.join("\n");
}

/**
 * Extracts min and max temperatures from forecast array.
 *
 * @param forecasts - Array of daily forecasts
 * @returns Object with min and max temperatures
 */
export function getTemperatureRange(
  forecasts: DailyForecast[]
): { min: number; max: number } {
  if (forecasts.length === 0) {
    return { min: 0, max: 30 };
  }

  let min = Infinity;
  let max = -Infinity;

  for (const forecast of forecasts) {
    const tempMin = forecast.temperature.min as number;
    const tempMax = forecast.temperature.max as number;
    if (tempMin < min) min = tempMin;
    if (tempMax > max) max = tempMax;
  }

  return { min, max };
}
