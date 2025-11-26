/**
 * Type definitions for output formatters.
 * Defines the FormatterInput and OutputFormatter interface.
 */

import type {
  Location,
  AggregatedForecast,
  ModelForecast,
} from "@weather-oracle/core";
import type { ConfidenceResult, NarrativeSummary } from "@weather-oracle/core";

/**
 * Supported output format types
 */
export type OutputFormatType = "table" | "narrative" | "json";

/**
 * Input data for formatters
 */
export interface FormatterInput {
  readonly location: Location;
  readonly aggregated: AggregatedForecast;
  readonly confidence: readonly ConfidenceResult[];
  readonly narrative: NarrativeSummary;
  readonly models: readonly ModelForecast[];
}

/**
 * Formatter interface - strategy pattern
 */
export interface OutputFormatter {
  /**
   * Format the input data into a string for display
   */
  format(data: FormatterInput): string;
}

/**
 * Formatter options for customization
 */
export interface FormatterOptions {
  /**
   * Whether to use colors in output (for table formatter)
   * Defaults to true if terminal supports colors
   */
  readonly useColors?: boolean;

  /**
   * Unit system for temperature display
   */
  readonly units?: "metric" | "imperial";

  /**
   * Whether to show model details
   */
  readonly showModelDetails?: boolean;

  /**
   * Whether to show confidence indicators
   */
  readonly showConfidence?: boolean;

  /**
   * Date format style
   */
  readonly dateFormat?: "relative" | "absolute";

  /**
   * Maximum number of days to display in output
   * When specified, shows all days up to this limit without truncation
   */
  readonly maxDays?: number;
}

/**
 * Color palette for weather display
 */
export interface ColorPalette {
  readonly temp: {
    readonly hot: string;
    readonly warm: string;
    readonly mild: string;
    readonly cool: string;
    readonly cold: string;
    readonly freezing: string;
  };
  readonly precip: {
    readonly none: string;
    readonly light: string;
    readonly moderate: string;
    readonly heavy: string;
  };
  readonly confidence: {
    readonly high: string;
    readonly medium: string;
    readonly low: string;
  };
  readonly ui: {
    readonly header: string;
    readonly label: string;
    readonly value: string;
    readonly muted: string;
    readonly warning: string;
    readonly error: string;
    readonly success: string;
  };
}
