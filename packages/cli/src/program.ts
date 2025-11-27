/**
 * CLI program configuration using Commander.js.
 * Defines the root program with global options.
 */

import { Command, type OptionValues } from "commander";
import chalk from "chalk";
import { loadConfig, type AppConfig, type UnitSystem, type OutputFormat } from "@weather-oracle/core";
import { registerCompareCommand } from "./commands/compare";
import { registerConfigCommand } from "./commands/config";
import { registerForecastCommand } from "./commands/forecast";

/**
 * Valid model names for CLI input
 */
const VALID_MODELS = ["ecmwf", "gfs", "icon", "meteofrance", "ukmo", "jma", "gem"] as const;

/**
 * Global CLI options parsed from command line
 */
export interface GlobalOptions {
  units?: UnitSystem;
  days?: number;
  models?: string[];
  format?: OutputFormat;
  verbose?: boolean;
  color?: boolean;
}

/**
 * Parse models from comma-separated string
 */
function parseModels(value: string): string[] {
  const models = value.split(",").map((m) => m.trim().toLowerCase());
  for (const model of models) {
    if (!VALID_MODELS.includes(model as (typeof VALID_MODELS)[number])) {
      throw new Error(
        `Invalid model "${model}". Valid models: ${VALID_MODELS.join(", ")}`
      );
    }
  }
  return models;
}

/**
 * Parse days value with validation
 */
function parseDays(value: string): number {
  const days = parseInt(value, 10);
  if (isNaN(days) || days < 1 || days > 16) {
    throw new Error("Days must be a number between 1 and 16");
  }
  return days;
}

/**
 * Parse units value with validation
 */
function parseUnits(value: string): UnitSystem {
  const normalized = value.toLowerCase();
  if (normalized !== "metric" && normalized !== "imperial") {
    throw new Error('Units must be "metric" or "imperial"');
  }
  return normalized;
}

/**
 * Parse output format with validation
 */
function parseFormat(value: string): OutputFormat {
  const normalized = value.toLowerCase();
  if (normalized !== "table" && normalized !== "json" && normalized !== "rich" && normalized !== "minimal") {
    throw new Error('Format must be "table", "json", "rich", or "minimal"');
  }
  return normalized as OutputFormat;
}

/**
 * Extract global options from Commander options object
 */
export function extractGlobalOptions(options: OptionValues): GlobalOptions {
  return {
    units: options.units as UnitSystem | undefined,
    days: options.days as number | undefined,
    models: options.models as string[] | undefined,
    format: options.format as OutputFormat | undefined,
    verbose: options.verbose as boolean | undefined,
    color: options.color as boolean | undefined,
  };
}

/**
 * Deep partial type for config overrides
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Build configuration overrides from CLI options
 */
export function buildConfigOverrides(options: GlobalOptions): DeepPartial<AppConfig> {
  const overrides: DeepPartial<AppConfig> = {};

  if (options.units !== undefined || options.format !== undefined || options.color !== undefined) {
    overrides.display = {
      ...(options.units !== undefined && { units: options.units }),
      ...(options.format !== undefined && { outputFormat: options.format }),
      ...(options.color !== undefined && { colorOutput: options.color }),
    };
  }

  if (options.models !== undefined) {
    overrides.models = {
      defaults: options.models as AppConfig["models"]["defaults"],
    };
  }

  return overrides;
}

/**
 * Load configuration with CLI overrides applied
 */
export async function loadConfigWithOverrides(options: GlobalOptions): Promise<AppConfig> {
  const overrides = buildConfigOverrides(options);
  return loadConfig({ overrides: overrides as Partial<AppConfig> });
}

/**
 * Check if color output should be enabled based on options and environment
 */
export function shouldUseColor(options: GlobalOptions): boolean {
  // Explicit --no-color flag takes precedence
  if (options.color === false) {
    return false;
  }
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
 * Create the CLI program with all global options configured
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("weather-oracle")
    .version("0.1.0")
    .description(
      "Multi-model weather forecast aggregator - get consensus forecasts from multiple weather models"
    )
    .option("-u, --units <type>", "Temperature units (metric/imperial)", parseUnits)
    .option("-d, --days <n>", "Forecast days (1-16, default: 7)", parseDays)
    .option("-m, --models <list>", "Models to query (comma-separated)", parseModels)
    .option("-f, --format <type>", "Output format (table/json/rich/minimal)", parseFormat)
    .option("-v, --verbose", "Show detailed output")
    .option("--no-color", "Disable colored output")
    .configureOutput({
      outputError: (str, write) => {
        write(chalk.red(str));
      },
    });

  // Register commands
  registerForecastCommand(program);
  registerCompareCommand(program);
  registerConfigCommand(program);

  return program;
}

export { chalk };
