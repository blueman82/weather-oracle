/**
 * Narrative formatter for Carlow Weather-style prose output.
 * Converts forecast data into readable, conversational text.
 */

import type {
  OutputFormatter,
  FormatterInput,
  FormatterOptions,
  ColorPalette,
} from "./types";
import {
  formatRelativeDay,
  formatModelName,
  toCardinalDirection,
} from "@weather-oracle/core";
import { getPalette, colorizeTemp, colorizeConfidence } from "./colors";

/**
 * Narrative formatter implementation
 */
export class NarrativeFormatter implements OutputFormatter {
  private readonly options: FormatterOptions;
  private readonly palette: ColorPalette;

  constructor(options: FormatterOptions = {}) {
    this.options = {
      useColors: true,
      units: "metric",
      showModelDetails: false,
      showConfidence: true,
      dateFormat: "relative",
      ...options,
    };
    this.palette = getPalette(this.options);
  }

  format(data: FormatterInput): string {
    const sections: string[] = [];

    // Location header
    sections.push(this.formatLocationHeader(data));

    // Main narrative from the narrative generator
    sections.push(this.formatMainNarrative(data));

    // Extended forecast summary
    if (data.aggregated.consensus.daily.length > 1) {
      sections.push(this.formatExtendedForecast(data));
    }

    // Model notes if there are any
    if (data.narrative.modelNotes.length > 0 && this.options.showModelDetails) {
      sections.push(this.formatModelNotes(data));
    }

    // Alerts
    if (data.narrative.alerts.length > 0) {
      sections.push(this.formatAlerts(data));
    }

    // Confidence footer
    if (this.options.showConfidence) {
      sections.push(this.formatConfidenceFooter(data));
    }

    return sections.join("\n\n");
  }

  /**
   * Format the location header
   */
  private formatLocationHeader(data: FormatterInput): string {
    const { location } = data;
    const ui = this.palette.ui;
    const headerFn = ui.header as unknown as (text: string) => string;
    const mutedFn = ui.muted as unknown as (text: string) => string;

    const locationName = location.resolved.name;
    const country = location.resolved.country;

    return [
      headerFn(`${locationName}, ${country}`),
      mutedFn(new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })),
    ].join("\n");
  }

  /**
   * Format the main narrative summary
   */
  private formatMainNarrative(data: FormatterInput): string {
    const { narrative } = data;
    const ui = this.palette.ui;
    const headerFn = ui.header as unknown as (text: string) => string;

    const lines: string[] = [];

    // Headline
    lines.push(headerFn(narrative.headline));

    // Body
    if (narrative.body) {
      lines.push("");
      lines.push(narrative.body);
    }

    return lines.join("\n");
  }

  /**
   * Format extended forecast as prose
   */
  private formatExtendedForecast(data: FormatterInput): string {
    const { aggregated } = data;
    const daily = aggregated.consensus.daily;
    const units = this.options.units ?? "metric";
    const ui = this.palette.ui;
    const labelFn = ui.label as unknown as (text: string) => string;

    const lines: string[] = [labelFn("Day-by-day outlook:")];
    const maxDays = this.options.maxDays ?? 7;

    for (const day of daily.slice(0, maxDays)) {
      const forecast = day.forecast;
      const dayName = formatRelativeDay(day.date);
      const high = this.formatTemp(forecast.temperature.max as number, units);
      const low = this.formatTemp(forecast.temperature.min as number, units);

      let description = this.getConditionDescription(forecast.weatherCode as number);

      // Add precipitation details if significant
      const precipTotal = forecast.precipitation.total as number;
      if (precipTotal > 1) {
        description += ` with ${precipTotal.toFixed(0)}mm rain`;
      }

      // Add wind if strong
      const windMax = forecast.wind.maxSpeed as number * 3.6; // Convert to km/h
      if (windMax > 30) {
        const windDir = toCardinalDirection(forecast.wind.dominantDirection);
        description += `, ${windDir} winds to ${Math.round(windMax)}km/h`;
      }

      lines.push(`  ${this.capitalize(dayName)}: ${high}/${low}, ${description}`);
    }

    // Add note about extended period if there are more days than displayed
    if (daily.length > maxDays) {
      const mutedFn = ui.muted as unknown as (text: string) => string;
      lines.push(mutedFn(`  ...and ${daily.length - maxDays} more day(s)`));
    }

    return lines.join("\n");
  }

  /**
   * Format model notes section
   */
  private formatModelNotes(data: FormatterInput): string {
    const { narrative } = data;
    const ui = this.palette.ui;
    const labelFn = ui.label as unknown as (text: string) => string;

    const lines: string[] = [labelFn("Notable model differences:")];

    for (const note of narrative.modelNotes) {
      lines.push(`  - ${note}`);
    }

    return lines.join("\n");
  }

  /**
   * Format alerts section
   */
  private formatAlerts(data: FormatterInput): string {
    const { narrative } = data;
    const ui = this.palette.ui;
    const warningFn = ui.warning as unknown as (text: string) => string;

    const lines: string[] = [];

    for (const alert of narrative.alerts) {
      lines.push(warningFn(`\u26A0 ${alert}`));
    }

    return lines.join("\n");
  }

  /**
   * Format the confidence footer
   */
  private formatConfidenceFooter(data: FormatterInput): string {
    const { aggregated } = data;
    const ui = this.palette.ui;
    const mutedFn = ui.muted as unknown as (text: string) => string;

    const overallConf = aggregated.overallConfidence;
    const confStr = colorizeConfidence(
      overallConf.level,
      overallConf.score,
      this.palette
    );

    // Models used
    const modelNames = aggregated.models.map(formatModelName).join(", ");

    return [
      mutedFn("---"),
      `Confidence: ${confStr}`,
      mutedFn(`Based on: ${modelNames}`),
    ].join("\n");
  }

  /**
   * Format temperature with color
   */
  private formatTemp(temp: number, units: "metric" | "imperial"): string {
    return colorizeTemp(temp, this.palette, units);
  }

  /**
   * Get human-readable condition description from weather code
   */
  private getConditionDescription(code: number): string {
    // WMO weather codes
    if (code === 0) return "clear skies";
    if (code >= 1 && code <= 2) return "partly cloudy";
    if (code === 3) return "cloudy";
    if (code >= 45 && code <= 48) return "fog";
    if (code >= 51 && code <= 57) return "drizzle";
    if (code >= 61 && code <= 65) return "rain";
    if (code >= 66 && code <= 67) return "freezing rain";
    if (code >= 71 && code <= 77) return "snow";
    if (code >= 80 && code <= 82) return "showers";
    if (code >= 85 && code <= 86) return "snow showers";
    if (code >= 95 && code <= 99) return "thunderstorms";
    return "mixed conditions";
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Create a narrative formatter with default options
 */
export function createNarrativeFormatter(
  options?: FormatterOptions
): NarrativeFormatter {
  return new NarrativeFormatter(options);
}
