/**
 * Output formatters for Weather Oracle CLI.
 * Provides table, narrative, JSON, and rich output formats.
 */

// Type exports
export type {
  OutputFormatType,
  FormatterInput,
  OutputFormatter,
  FormatterOptions,
  ColorPalette,
} from "./types";

// Color utilities
export {
  supportsColors,
  createColorPalette,
  createPlainPalette,
  getTempColor,
  getPrecipColor,
  getConfidenceColor,
  colorizeTemp,
  colorizePrecip,
  colorizeConfidence,
  confidenceIndicator,
  getPalette,
} from "./colors";

// Table formatter
export { TableFormatter, createTableFormatter } from "./table";

// Narrative formatter
export { NarrativeFormatter, createNarrativeFormatter } from "./narrative";

// JSON formatter
export {
  JsonFormatter,
  createJsonFormatter,
  type JsonOutput,
  type JsonDailyForecast,
  type JsonHourlyForecast,
  type JsonFormatterOptions,
} from "./json";

// Rich formatter
export {
  RichFormatter,
  createRichFormatter,
  revealAnimation,
  type RichFormatterOptions,
} from "./rich";

// Re-import for factory
import type { OutputFormatType, OutputFormatter, FormatterOptions } from "./types";
import { TableFormatter } from "./table";
import { NarrativeFormatter } from "./narrative";
import { JsonFormatter } from "./json";
import { RichFormatter } from "./rich";

/**
 * Registry of formatters by type
 */
const formatters: Record<
  OutputFormatType,
  new (options?: FormatterOptions) => OutputFormatter
> = {
  table: TableFormatter,
  narrative: NarrativeFormatter,
  json: JsonFormatter,
  rich: RichFormatter,
};

/**
 * Create a formatter for the specified output type.
 * Strategy pattern: formatters[format].format(data)
 *
 * @param type - The output format type
 * @param options - Formatter options
 * @returns An OutputFormatter instance
 *
 * @example
 * ```typescript
 * const formatter = createFormatter('table', { useColors: true });
 * const output = formatter.format(data);
 * console.log(output);
 * ```
 */
export function createFormatter(
  type: OutputFormatType,
  options?: FormatterOptions
): OutputFormatter {
  const FormatterClass = formatters[type];
  if (!FormatterClass) {
    throw new Error(`Unknown formatter type: ${type}`);
  }
  return new FormatterClass(options);
}

/**
 * Get all available formatter types
 */
export function getAvailableFormats(): OutputFormatType[] {
  return Object.keys(formatters) as OutputFormatType[];
}

/**
 * Check if a format type is valid
 */
export function isValidFormat(format: string): format is OutputFormatType {
  return format in formatters;
}

/**
 * Format data using the specified format type.
 * Convenience function that creates a formatter and formats in one call.
 *
 * @param type - The output format type
 * @param data - The formatter input data
 * @param options - Formatter options
 * @returns Formatted string output
 *
 * @example
 * ```typescript
 * const output = format('json', data, { pretty: true });
 * console.log(output);
 * ```
 */
export function format(
  type: OutputFormatType,
  data: Parameters<OutputFormatter["format"]>[0],
  options?: FormatterOptions
): string {
  const formatter = createFormatter(type, options);
  return formatter.format(data);
}
