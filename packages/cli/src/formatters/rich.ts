/**
 * Rich Formatter
 *
 * Combines all visualization components into a cohesive, stunning weather display.
 * Features: header with ASCII art, temperature sparklines, model consensus
 * constellation, and 7-day heatmap.
 */

import type {
  OutputFormatter,
  FormatterInput,
  FormatterOptions,
} from "./types";
import type { WeatherTheme } from "../visualization/themes";
import type { RGB } from "../visualization/color-space";
import { tempToColor } from "../visualization/gradient";
import { getThemeForConditions, getBorderChars } from "../visualization/themes";
import { createTempSparkline } from "../visualization/sparklines";
import {
  render7DayHeatMap,
  renderHeatmapLegend,
  getTemperatureRange,
} from "../visualization/heatmap";
import { renderWeatherIcon, getCompactIcon } from "../visualization/ascii-art";
import {
  renderModelConstellation,
  extractConstellationPoints,
  calculateAgreement,
  renderAgreementBar,
} from "../visualization/constellation";
import { RenderTier, detectColorSupport } from "../visualization/terminal";
import { revealAnimation } from "../visualization/animation";
import { formatRelativeDay } from "@weather-oracle/core";

// Re-export revealAnimation for consumers to use with formatted output
export { revealAnimation };

/**
 * Extended formatter options for rich output
 */
export interface RichFormatterOptions extends FormatterOptions {
  /**
   * Whether to show the ASCII art header
   */
  readonly showArt?: boolean;

  /**
   * Whether to show the heatmap
   */
  readonly showHeatmap?: boolean;

  /**
   * Whether to show model constellation
   */
  readonly showConstellation?: boolean;

  /**
   * Display width for the output
   */
  readonly width?: number;
}

/**
 * Rich formatter that combines all visualization components.
 */
export class RichFormatter implements OutputFormatter {
  private readonly options: RichFormatterOptions;
  private readonly renderTier: RenderTier;

  constructor(options: RichFormatterOptions = {}) {
    this.options = {
      useColors: true,
      units: "metric",
      showArt: true,
      showHeatmap: true,
      showConstellation: true,
      showConfidence: true,
      width: 60,
      ...options,
    };
    this.renderTier = detectColorSupport();
  }

  format(data: FormatterInput): string {
    const { aggregated } = data;

    // Get current weather conditions from first hourly forecast
    const currentHour =
      aggregated.consensus.hourly[0] ?? aggregated.consensus.hourly[0];
    const weatherCode = currentHour?.metrics.weatherCode ?? 0;
    const currentHourOfDay = new Date().getHours();

    // Get theme based on weather and time
    const theme = getThemeForConditions(weatherCode, currentHourOfDay);

    const sections: string[] = [];

    // 1. Header with weather art + location
    sections.push(this.formatHeader(data, theme));

    // 2. Temperature section with sparkline
    sections.push(this.formatTemperature(data, theme));

    // 3. Model consensus section with constellation
    if (this.options.showConstellation && data.models.length > 1) {
      sections.push(this.formatModelConsensus(data, theme));
    }

    // 4. 7-day heatmap
    if (this.options.showHeatmap) {
      sections.push(this.formatHeatmap(data, theme));
    }

    return sections.join("\n\n");
  }

  /**
   * Format the header section with ASCII art and location info
   */
  private formatHeader(data: FormatterInput, theme: WeatherTheme): string {
    const { location, aggregated } = data;
    const lines: string[] = [];

    // Get current conditions
    const currentHour = aggregated.consensus.hourly[0];
    const weatherCode = currentHour?.metrics.weatherCode ?? 0;
    const currentTemp = currentHour?.metrics.temperature ?? 0;

    // Render ASCII art if enabled and terminal supports it
    if (this.options.showArt && this.renderTier !== RenderTier.PLAIN) {
      const art = renderWeatherIcon(weatherCode, theme);
      lines.push(art);
      lines.push("");
    }

    // Location and current temp
    const locationName = location.resolved.name;
    const country = location.resolved.country;
    const tempColorFn = tempToColor(currentTemp);
    const tempStr = this.formatTemperatureValue(currentTemp);
    const icon = getCompactIcon(weatherCode);

    const headerLine = this.colorize(
      `${icon} ${locationName}, ${country}`,
      theme.primary
    );
    const tempLine = tempColorFn(`Currently: ${tempStr}`);

    lines.push(headerLine);
    lines.push(tempLine);

    // Add border below header
    const boxChars = getBorderChars(theme.borderStyle);
    const borderWidth = this.options.width ?? 60;
    lines.push(this.colorize(boxChars.horizontal.repeat(borderWidth), theme.secondary));

    return lines.join("\n");
  }

  /**
   * Format the temperature section with sparkline
   */
  private formatTemperature(data: FormatterInput, theme: WeatherTheme): string {
    const { aggregated } = data;
    const lines: string[] = [];

    // Section header
    lines.push(this.colorize("Temperature Trend", theme.primary));
    lines.push("");

    // Get hourly temperatures for sparkline (next 24 hours)
    const hourlyTemps = aggregated.consensus.hourly
      .slice(0, 24)
      .map((h) => h.metrics.temperature as number);

    if (hourlyTemps.length > 0) {
      // Create sparkline
      const sparkline = createTempSparkline(hourlyTemps);
      lines.push(`  Next 24h: ${sparkline}`);

      // Min/max summary
      const min = Math.min(...hourlyTemps);
      const max = Math.max(...hourlyTemps);
      const minColor = tempToColor(min);
      const maxColor = tempToColor(max);
      lines.push(
        `  Range: ${minColor(this.formatTemperatureValue(min))} - ${maxColor(this.formatTemperatureValue(max))}`
      );
    }

    // Daily summary
    lines.push("");
    lines.push(this.colorize("Daily Summary", theme.secondary));

    const daily = aggregated.consensus.daily.slice(0, 7);
    for (const day of daily) {
      const dayName = formatRelativeDay(day.date).padEnd(10);
      const maxTemp = day.forecast.temperature.max as number;
      const minTemp = day.forecast.temperature.min as number;
      const maxColor = tempToColor(maxTemp);
      const minColor = tempToColor(minTemp);
      const icon = getCompactIcon(day.forecast.weatherCode);

      lines.push(
        `  ${dayName} ${icon} ${maxColor(this.formatTemperatureValue(maxTemp))} / ${minColor(this.formatTemperatureValue(minTemp))}`
      );
    }

    return lines.join("\n");
  }

  /**
   * Strip ANSI escape codes to get visible length
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, "");
  }

  /**
   * Format the model consensus section with constellation
   */
  private formatModelConsensus(
    data: FormatterInput,
    theme: WeatherTheme
  ): string {
    const { models, aggregated } = data;
    const lines: string[] = [];

    // Section header
    lines.push(this.colorize("Model Consensus", theme.primary));

    // Box border
    const boxChars = getBorderChars(theme.borderStyle);

    // Pre-render content to calculate adaptive width
    const contentLines: string[] = [];

    // Constellation visualization (render first to measure)
    const preliminaryConstellation = renderModelConstellation(models, "temperature", {
      width: 50, // Base width for constellation points
      hourIndex: 0,
      showLegend: true,
      theme,
    });
    contentLines.push(...preliminaryConstellation.split("\n"));

    // Overall agreement line
    const points = extractConstellationPoints(models, "temperature", 0);
    const agreement = calculateAgreement(points);
    const agreementBar = renderAgreementBar(agreement, { width: 20 });
    const overallLine = `Overall: ${agreementBar}`;
    contentLines.push(overallLine);

    // Confidence interpretation line
    const confLevel = aggregated.overallConfidence.level;
    const confScore = Math.round(aggregated.overallConfidence.score * 100);
    let interpretation: string;
    if (confLevel === "high") {
      interpretation = `High confidence (${confScore}%) - models strongly agree`;
    } else if (confLevel === "medium") {
      interpretation = `Moderate confidence (${confScore}%) - some divergence`;
    } else {
      interpretation = `Low confidence (${confScore}%) - significant disagreement`;
    }
    contentLines.push(interpretation);

    // Calculate adaptive width based on longest content line
    const maxContentWidth = Math.max(
      ...contentLines.map((line) => this.stripAnsi(line).length)
    );
    const width = maxContentWidth + 6; // +4 for borders/padding, +2 for margin

    // Top border
    lines.push(
      this.colorize(
        boxChars.topLeft + boxChars.horizontal.repeat(width - 2) + boxChars.topRight,
        theme.secondary
      )
    );

    // Add constellation lines with vertical borders
    for (const line of preliminaryConstellation.split("\n")) {
      const visibleLen = this.stripAnsi(line).length;
      const padding = width - 4 - visibleLen;
      lines.push(
        this.colorize(boxChars.vertical, theme.secondary) +
          " " +
          line +
          " ".repeat(Math.max(0, padding)) +
          " " +
          this.colorize(boxChars.vertical, theme.secondary)
      );
    }

    // Overall agreement with proper padding
    const overallVisibleLen = this.stripAnsi(overallLine).length;
    lines.push(
      this.colorize(boxChars.vertical, theme.secondary) +
        " " +
        overallLine +
        " ".repeat(Math.max(0, width - 4 - overallVisibleLen)) +
        " " +
        this.colorize(boxChars.vertical, theme.secondary)
    );

    // Confidence level interpretation with proper padding
    lines.push(
      this.colorize(boxChars.vertical, theme.secondary) +
        " " +
        interpretation +
        " ".repeat(Math.max(0, width - 4 - interpretation.length)) +
        " " +
        this.colorize(boxChars.vertical, theme.secondary)
    );

    // Bottom border
    lines.push(
      this.colorize(
        boxChars.bottomLeft +
          boxChars.horizontal.repeat(width - 2) +
          boxChars.bottomRight,
        theme.secondary
      )
    );

    return lines.join("\n");
  }

  /**
   * Format the 7-day heatmap section
   */
  private formatHeatmap(data: FormatterInput, theme: WeatherTheme): string {
    const { aggregated } = data;
    const lines: string[] = [];

    // Section header
    lines.push(this.colorize("7-Day Temperature Heatmap", theme.primary));
    lines.push("");

    // Get daily forecasts
    const dailyForecasts = aggregated.consensus.daily
      .slice(0, 7)
      .map((d) => d.forecast);

    if (dailyForecasts.length > 0) {
      // Render heatmap
      const heatmap = render7DayHeatMap(dailyForecasts);
      lines.push(heatmap);

      // Add legend
      lines.push("");
      const { min, max } = getTemperatureRange(dailyForecasts);
      const legend = renderHeatmapLegend(min, max);
      lines.push(legend);
    } else {
      lines.push("  No forecast data available for heatmap.");
    }

    return lines.join("\n");
  }

  /**
   * Format a temperature value with units
   */
  private formatTemperatureValue(temp: number): string {
    const units = this.options.units ?? "metric";
    if (units === "imperial") {
      const fahrenheit = (temp * 9) / 5 + 32;
      return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(temp)}°C`;
  }

  /**
   * Apply theme color to text using ANSI escape codes
   */
  private colorize(text: string, color: RGB): string {
    if (
      this.options.useColors === false ||
      this.renderTier === RenderTier.PLAIN
    ) {
      return text;
    }

    if (
      this.renderTier === RenderTier.RICH ||
      this.renderTier === RenderTier.FULL
    ) {
      return `\x1b[38;2;${color.r};${color.g};${color.b}m${text}\x1b[0m`;
    }

    // Fallback for lower tiers - no color
    return text;
  }
}

/**
 * Create a rich formatter with default options
 */
export function createRichFormatter(
  options?: RichFormatterOptions
): RichFormatter {
  return new RichFormatter(options);
}
