/**
 * Table formatter for CLI output.
 * Creates ASCII tables with colors for weather forecast display.
 */

import type {
  OutputFormatter,
  FormatterInput,
  FormatterOptions,
  ColorPalette,
} from "./types";
import type { AggregatedDailyForecast } from "@weather-oracle/core";
import {
  formatRelativeDay,
  toCardinalDirection,
  MODEL_INFO,
} from "@weather-oracle/core";
import {
  getPalette,
  colorizeTemp,
  colorizePrecip,
  colorizeConfidence,
  confidenceIndicator,
} from "./colors";

/**
 * Box drawing characters for table borders
 */
const BOX = {
  topLeft: "\u250C",
  topRight: "\u2510",
  bottomLeft: "\u2514",
  bottomRight: "\u2518",
  horizontal: "\u2500",
  vertical: "\u2502",
  cross: "\u253C",
  topT: "\u252C",
  bottomT: "\u2534",
  leftT: "\u251C",
  rightT: "\u2524",
} as const;

/**
 * Simplified box for plain output
 */
const PLAIN_BOX = {
  topLeft: "+",
  topRight: "+",
  bottomLeft: "+",
  bottomRight: "+",
  horizontal: "-",
  vertical: "|",
  cross: "+",
  topT: "+",
  bottomT: "+",
  leftT: "+",
  rightT: "+",
} as const;

/**
 * Table formatter implementation
 */
export class TableFormatter implements OutputFormatter {
  private readonly options: FormatterOptions;
  private readonly palette: ColorPalette;
  private readonly box: typeof BOX | typeof PLAIN_BOX;

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
    this.box = this.options.useColors !== false ? BOX : PLAIN_BOX;
  }

  format(data: FormatterInput): string {
    const lines: string[] = [];

    // Header with location
    lines.push(this.formatHeader(data));
    lines.push("");

    // Daily forecast table
    lines.push(this.formatDailyTable(data));

    // Confidence summary
    if (this.options.showConfidence) {
      lines.push("");
      lines.push(this.formatConfidenceSummary(data));
    }

    // Model details if enabled
    if (this.options.showModelDetails) {
      lines.push("");
      lines.push(this.formatModelDetails(data));
    }

    return lines.join("\n");
  }

  /**
   * Format the header section with location info
   */
  private formatHeader(data: FormatterInput): string {
    const { location, aggregated } = data;
    const ui = this.palette.ui;

    const locationName = location.resolved.name;
    const country = location.resolved.country;
    const modelsCount = aggregated.models.length;

    const headerFn = ui.header as unknown as (text: string) => string;
    const mutedFn = ui.muted as unknown as (text: string) => string;

    return [
      headerFn(`Weather Forecast for ${locationName}, ${country}`),
      mutedFn(`Based on ${modelsCount} weather models`),
    ].join("\n");
  }

  /**
   * Format the daily forecast table
   */
  private formatDailyTable(data: FormatterInput): string {
    const { aggregated } = data;
    const daily = aggregated.consensus.daily;

    if (daily.length === 0) {
      return "No forecast data available.";
    }

    // Column definitions
    const columns = [
      { header: "Day", width: 12 },
      { header: "High", width: 8 },
      { header: "Low", width: 8 },
      { header: "Precip", width: 10 },
      { header: "Wind", width: 12 },
      { header: "Conf", width: 6 },
    ];

    // Build table
    const lines: string[] = [];

    // Top border
    lines.push(this.buildTableRow(columns, "top"));

    // Header row
    const headerFn = this.palette.ui.header as unknown as (text: string) => string;
    lines.push(
      this.buildDataRow(columns.map((c) => headerFn(c.header)), columns)
    );

    // Separator
    lines.push(this.buildTableRow(columns, "middle"));

    // Data rows
    for (const day of daily) {
      lines.push(this.formatDailyRow(day, columns));
    }

    // Bottom border
    lines.push(this.buildTableRow(columns, "bottom"));

    return lines.join("\n");
  }

  /**
   * Format a single daily forecast row
   */
  private formatDailyRow(
    day: AggregatedDailyForecast,
    columns: Array<{ header: string; width: number }>
  ): string {
    const forecast = day.forecast;
    const units = this.options.units ?? "metric";

    // Day name
    const dayName = formatRelativeDay(day.date);

    // Temperature
    const highTemp = colorizeTemp(
      forecast.temperature.max as number,
      this.palette,
      units
    );
    const lowTemp = colorizeTemp(
      forecast.temperature.min as number,
      this.palette,
      units
    );

    // Precipitation
    const precip = colorizePrecip(
      forecast.precipitation.total as number,
      this.palette
    );

    // Wind
    const windSpeed = this.formatWindSpeed(forecast.wind.maxSpeed as number);
    const windDir = toCardinalDirection(forecast.wind.dominantDirection);
    const wind = `${windSpeed} ${windDir}`;

    // Confidence
    const conf = confidenceIndicator(day.confidence.level, this.palette);

    const values = [dayName, highTemp, lowTemp, precip, wind, conf];
    return this.buildDataRow(values, columns);
  }

  /**
   * Format wind speed with units
   */
  private formatWindSpeed(mps: number): string {
    const units = this.options.units ?? "metric";
    if (units === "imperial") {
      const mph = mps * 2.237;
      return `${Math.round(mph)}mph`;
    }
    const kmh = mps * 3.6;
    return `${Math.round(kmh)}km/h`;
  }

  /**
   * Build a table border row
   */
  private buildTableRow(
    columns: Array<{ width: number }>,
    position: "top" | "middle" | "bottom"
  ): string {
    const { box } = this;
    let left: string, middle: string, right: string;

    switch (position) {
      case "top":
        left = box.topLeft;
        middle = box.topT;
        right = box.topRight;
        break;
      case "middle":
        left = box.leftT;
        middle = box.cross;
        right = box.rightT;
        break;
      case "bottom":
        left = box.bottomLeft;
        middle = box.bottomT;
        right = box.bottomRight;
        break;
    }

    const segments = columns.map((c) => box.horizontal.repeat(c.width + 2));
    return left + segments.join(middle) + right;
  }

  /**
   * Build a data row with proper padding
   */
  private buildDataRow(
    values: string[],
    columns: Array<{ width: number }>
  ): string {
    const { box } = this;
    const cells = values.map((value, i) => {
      const width = columns[i].width;
      // Strip ANSI codes for length calculation
      const visibleLength = this.stripAnsi(value).length;
      const padding = Math.max(0, width - visibleLength);
      return ` ${value}${" ".repeat(padding)} `;
    });
    return box.vertical + cells.join(box.vertical) + box.vertical;
  }

  /**
   * Strip ANSI escape codes from a string
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  }

  /**
   * Format the confidence summary section
   */
  private formatConfidenceSummary(data: FormatterInput): string {
    const { aggregated, confidence } = data;
    const ui = this.palette.ui;
    const labelFn = ui.label as unknown as (text: string) => string;

    const overallConf = aggregated.overallConfidence;
    const confStr = colorizeConfidence(
      overallConf.level,
      overallConf.score,
      this.palette
    );

    // Get first confidence result explanation if available
    const explanation =
      confidence.length > 0
        ? confidence[0].explanation
        : `${aggregated.models.length} models analyzed`;

    return [
      labelFn("Overall Confidence: ") + confStr,
      labelFn(explanation),
    ].join("\n");
  }

  /**
   * Format model details section
   */
  private formatModelDetails(data: FormatterInput): string {
    const { aggregated } = data;
    const ui = this.palette.ui;
    const headerFn = ui.header as unknown as (text: string) => string;
    const labelFn = ui.label as unknown as (text: string) => string;
    const valueFn = ui.value as unknown as (text: string) => string;

    const lines: string[] = [headerFn("Model Sources:")];

    for (const weight of aggregated.modelWeights) {
      const info = MODEL_INFO[weight.model];
      const displayName = info.displayName;
      const provider = info.provider;
      const weightPct = Math.round(weight.weight * 100);

      lines.push(
        `  ${valueFn(displayName)} ${labelFn(`(${provider})`)} - ${weightPct}%`
      );
    }

    return lines.join("\n");
  }
}

/**
 * Create a table formatter with default options
 */
export function createTableFormatter(
  options?: FormatterOptions
): TableFormatter {
  return new TableFormatter(options);
}
