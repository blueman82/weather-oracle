/**
 * JSON formatter for machine-readable output.
 * Handles Date serialization and structured output.
 */

import type {
  OutputFormatter,
  FormatterInput,
  FormatterOptions,
} from "./types";
import type {
  AggregatedForecast,
  AggregatedDailyForecast,
  AggregatedHourlyForecast,
} from "@weather-oracle/core";

/**
 * Convert date to ISO string, handling both Date objects and strings
 */
function toISOString(date: Date | string): string {
  if (typeof date === "string") {
    return new Date(date).toISOString();
  }
  return date.toISOString();
}

/**
 * JSON output structure for weather forecast
 */
export interface JsonOutput {
  readonly location: {
    readonly query: string;
    readonly name: string;
    readonly country: string;
    readonly coordinates: {
      readonly latitude: number;
      readonly longitude: number;
    };
    readonly timezone: string;
  };
  readonly generatedAt: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly models: readonly string[];
  readonly confidence: {
    readonly level: string;
    readonly score: number;
    readonly explanation?: string;
  };
  readonly narrative: {
    readonly headline: string;
    readonly body: string;
    readonly alerts: readonly string[];
  };
  readonly daily: readonly JsonDailyForecast[];
  readonly hourly?: readonly JsonHourlyForecast[];
}

/**
 * JSON daily forecast structure
 */
export interface JsonDailyForecast {
  readonly date: string;
  readonly temperature: {
    readonly high: number;
    readonly low: number;
    readonly range?: {
      readonly highMin: number;
      readonly highMax: number;
      readonly lowMin: number;
      readonly lowMax: number;
    };
  };
  readonly precipitation: {
    readonly total: number;
    readonly probability: number;
    readonly hours: number;
  };
  readonly wind: {
    readonly avgSpeed: number;
    readonly maxSpeed: number;
    readonly direction: number;
    readonly directionCardinal: string;
  };
  readonly humidity: {
    readonly min: number;
    readonly max: number;
  };
  readonly cloudCover: {
    readonly avg: number;
    readonly max: number;
  };
  readonly uvIndex: number;
  readonly weatherCode: number;
  readonly confidence: {
    readonly level: string;
    readonly score: number;
  };
}

/**
 * JSON hourly forecast structure
 */
export interface JsonHourlyForecast {
  readonly timestamp: string;
  readonly temperature: number;
  readonly feelsLike: number;
  readonly humidity: number;
  readonly precipitation: number;
  readonly precipitationProbability: number;
  readonly windSpeed: number;
  readonly windDirection: number;
  readonly cloudCover: number;
  readonly weatherCode: number;
  readonly confidence: {
    readonly level: string;
    readonly score: number;
  };
}

/**
 * JSON formatter options
 */
export interface JsonFormatterOptions extends FormatterOptions {
  /**
   * Whether to pretty-print the JSON output
   */
  readonly pretty?: boolean;

  /**
   * Number of spaces for indentation (if pretty)
   */
  readonly indent?: number;

  /**
   * Whether to include hourly forecasts
   */
  readonly includeHourly?: boolean;

  /**
   * Whether to include model ranges
   */
  readonly includeRanges?: boolean;
}

/**
 * Custom replacer for JSON.stringify that handles Date objects
 */
function dateReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Get cardinal direction from degrees
 */
function toCardinal(degrees: number): string {
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * JSON formatter implementation
 */
export class JsonFormatter implements OutputFormatter {
  private readonly options: JsonFormatterOptions;

  constructor(options: JsonFormatterOptions = {}) {
    this.options = {
      pretty: true,
      indent: 2,
      includeHourly: false,
      includeRanges: true,
      ...options,
    };
  }

  format(data: FormatterInput): string {
    const output = this.buildOutput(data);

    if (this.options.pretty) {
      return JSON.stringify(output, dateReplacer, this.options.indent);
    }

    return JSON.stringify(output, dateReplacer);
  }

  /**
   * Build the complete JSON output structure
   */
  private buildOutput(data: FormatterInput): JsonOutput {
    const { location, aggregated, confidence, narrative } = data;

    const output: JsonOutput = {
      location: {
        query: location.query,
        name: location.resolved.name,
        country: location.resolved.country,
        coordinates: {
          latitude: location.resolved.coordinates.latitude as number,
          longitude: location.resolved.coordinates.longitude as number,
        },
        timezone: location.resolved.timezone as string,
      },
      generatedAt: toISOString(aggregated.generatedAt),
      validFrom: toISOString(aggregated.validFrom),
      validTo: toISOString(aggregated.validTo),
      models: aggregated.models.slice(),
      confidence: {
        level: aggregated.overallConfidence.level,
        score: aggregated.overallConfidence.score,
        explanation: confidence.length > 0 ? confidence[0].explanation : undefined,
      },
      narrative: {
        headline: narrative.headline,
        body: narrative.body,
        alerts: narrative.alerts.slice(),
      },
      daily: this.buildDailyForecasts(aggregated),
    };

    // Include hourly if requested
    if (this.options.includeHourly) {
      (output as { hourly: readonly JsonHourlyForecast[] }).hourly =
        this.buildHourlyForecasts(aggregated);
    }

    return output;
  }

  /**
   * Build daily forecast array
   */
  private buildDailyForecasts(
    aggregated: AggregatedForecast
  ): JsonDailyForecast[] {
    return aggregated.consensus.daily.map((day) =>
      this.buildDailyForecast(day)
    );
  }

  /**
   * Build a single daily forecast
   */
  private buildDailyForecast(day: AggregatedDailyForecast): JsonDailyForecast {
    const forecast = day.forecast;

    const daily: JsonDailyForecast = {
      date: toISOString(day.date).split("T")[0],
      temperature: {
        high: forecast.temperature.max as number,
        low: forecast.temperature.min as number,
        ...(this.options.includeRanges && {
          range: {
            highMin: day.range.temperatureMax.min,
            highMax: day.range.temperatureMax.max,
            lowMin: day.range.temperatureMin.min,
            lowMax: day.range.temperatureMin.max,
          },
        }),
      },
      precipitation: {
        total: forecast.precipitation.total as number,
        probability: forecast.precipitation.probability,
        hours: forecast.precipitation.hours,
      },
      wind: {
        avgSpeed: forecast.wind.avgSpeed as number,
        maxSpeed: forecast.wind.maxSpeed as number,
        direction: forecast.wind.dominantDirection as number,
        directionCardinal: toCardinal(forecast.wind.dominantDirection as number),
      },
      humidity: {
        min: forecast.humidity.min as number,
        max: forecast.humidity.max as number,
      },
      cloudCover: {
        avg: forecast.cloudCover.avg as number,
        max: forecast.cloudCover.max as number,
      },
      uvIndex: forecast.uvIndex.max as number,
      weatherCode: forecast.weatherCode as number,
      confidence: {
        level: day.confidence.level,
        score: day.confidence.score,
      },
    };

    return daily;
  }

  /**
   * Build hourly forecast array
   */
  private buildHourlyForecasts(
    aggregated: AggregatedForecast
  ): JsonHourlyForecast[] {
    return aggregated.consensus.hourly.map((hour) =>
      this.buildHourlyForecast(hour)
    );
  }

  /**
   * Build a single hourly forecast
   */
  private buildHourlyForecast(hour: AggregatedHourlyForecast): JsonHourlyForecast {
    const metrics = hour.metrics;

    return {
      timestamp: toISOString(hour.timestamp),
      temperature: metrics.temperature as number,
      feelsLike: metrics.feelsLike as number,
      humidity: metrics.humidity as number,
      precipitation: metrics.precipitation as number,
      precipitationProbability: metrics.precipitationProbability,
      windSpeed: metrics.windSpeed as number,
      windDirection: metrics.windDirection as number,
      cloudCover: metrics.cloudCover as number,
      weatherCode: metrics.weatherCode as number,
      confidence: {
        level: hour.confidence.level,
        score: hour.confidence.score,
      },
    };
  }
}

/**
 * Create a JSON formatter with default options
 */
export function createJsonFormatter(
  options?: JsonFormatterOptions
): JsonFormatter {
  return new JsonFormatter(options);
}
