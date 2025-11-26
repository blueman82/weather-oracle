/**
 * Compare command for Weather Oracle CLI.
 * Shows side-by-side model comparison highlighting where models agree and disagree.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  MODEL_INFO,
  type ModelName,
  type ModelForecast,
  type Location,
  type AggregatedForecast,
} from "@weather-oracle/core";
import { mean, stdDev, calculateSpread } from "@weather-oracle/core";
import { formatError } from "../errors/handler";
import { extractGlobalOptions, loadConfigWithOverrides } from "../program";

/**
 * Box drawing characters for comparison table
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
  heavyH: "\u2501",
} as const;

/**
 * Plain box characters for non-TTY output
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
  heavyH: "-",
} as const;

/**
 * Options for the compare command
 */
export interface CompareOptions {
  days?: number;
  models?: string[];
  units?: "metric" | "imperial";
  verbose?: boolean;
  color?: boolean;
}

/**
 * Daily comparison data for a single day
 */
interface DayComparison {
  date: Date;
  dayLabel: string;
  tempMax: Map<ModelName, number>;
  tempMin: Map<ModelName, number>;
  precipProb: Map<ModelName, number>;
  precipTotal: Map<ModelName, number>;
  windMax: Map<ModelName, number>;
}

/**
 * Format a date as short day name (Mon, Tue, etc.)
 */
function formatShortDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

/**
 * Get color based on deviation from mean (standard deviations)
 */
function getDeviationColor(
  value: number,
  values: number[],
  useColor: boolean
): (text: string) => string {
  if (!useColor || values.length <= 1) {
    return (s: string) => s;
  }

  const avg = mean(values);
  const sd = stdDev(values);

  if (sd === 0) {
    return chalk.green; // All values same = high agreement
  }

  const zScore = Math.abs(value - avg) / sd;

  if (zScore <= 1) {
    return chalk.green; // Within 1 sigma
  } else if (zScore <= 2) {
    return chalk.yellow; // Within 2 sigma
  } else {
    return chalk.red; // Beyond 2 sigma (outlier)
  }
}

/**
 * Format temperature value with proper units
 */
function formatTemp(
  temp: number,
  units: "metric" | "imperial"
): string {
  if (units === "imperial") {
    const f = (temp * 9) / 5 + 32;
    return `${Math.round(f)}`;
  }
  return `${Math.round(temp)}`;
}

/**
 * Format precipitation probability
 */
function formatPrecipProb(prob: number): string {
  return `${Math.round(prob)}%`;
}

/**
 * Get spread classification label
 */
function getSpreadLabel(spread: number, metric: "temp" | "precip"): string {
  if (metric === "temp") {
    if (spread <= 1) return "Low uncertainty";
    if (spread <= 3) return "Moderate";
    return "High uncertainty";
  } else {
    if (spread <= 10) return "Low uncertainty";
    if (spread <= 30) return "Moderate";
    return "High uncertainty";
  }
}

/**
 * Build comparison data from forecasts
 */
function buildComparisonData(
  forecasts: readonly ModelForecast[],
  days: number
): DayComparison[] {
  const comparisons: Map<string, DayComparison> = new Map();

  for (const forecast of forecasts) {
    for (const daily of forecast.daily.slice(0, days)) {
      const dateKey = daily.date.toISOString().split("T")[0];

      if (!comparisons.has(dateKey)) {
        comparisons.set(dateKey, {
          date: daily.date,
          dayLabel: formatShortDay(daily.date),
          tempMax: new Map(),
          tempMin: new Map(),
          precipProb: new Map(),
          precipTotal: new Map(),
          windMax: new Map(),
        });
      }

      const comp = comparisons.get(dateKey)!;
      comp.tempMax.set(forecast.model, daily.temperature.max as number);
      comp.tempMin.set(forecast.model, daily.temperature.min as number);
      comp.precipProb.set(forecast.model, daily.precipitation.probability);
      comp.precipTotal.set(forecast.model, daily.precipitation.total as number);
      comp.windMax.set(forecast.model, daily.wind.maxSpeed as number);
    }
  }

  // Sort by date
  return Array.from(comparisons.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

/**
 * Render the comparison table
 */
function renderComparisonTable(
  location: Location,
  forecasts: readonly ModelForecast[],
  _aggregated: AggregatedForecast,
  options: CompareOptions
): string {
  const lines: string[] = [];
  const useColor = options.color !== false && process.stdout.isTTY;
  const box = useColor ? BOX : PLAIN_BOX;
  const units = options.units ?? "metric";
  const days = Math.min(options.days ?? 5, 7);

  // Get models used
  const models = forecasts.map((f) => f.model);

  // Build comparison data
  const comparisons = buildComparisonData(forecasts, days);

  if (comparisons.length === 0) {
    return "No forecast data available for comparison.";
  }

  // Header
  const headerIcon = useColor ? "\uD83D\uDCCA" : "";
  lines.push("");
  lines.push(
    chalk.bold(`${headerIcon} Model Comparison: ${location.resolved.name}, ${location.resolved.country}`)
  );
  lines.push(box.heavyH.repeat(50));
  lines.push("");

  // Calculate column widths
  const labelWidth = 8; // Model name column
  const dayWidth = 5;   // Per-day column
  const spreadWidth = 8; // Spread column

  // Day headers row
  const dayHeaders = comparisons.map((c) => c.dayLabel);

  // Render temperature section
  lines.push(
    chalk.bold.cyan(`\uD83C\uDF21\uFE0F  Temperature ${units === "imperial" ? "(\u00B0F)" : "(\u00B0C)"} - High`)
  );
  lines.push("");

  // Header row
  const tempHeader =
    padRight("", labelWidth) +
    dayHeaders.map((d) => padCenter(d, dayWidth)).join("  ") +
    "  " +
    padCenter("", spreadWidth);
  lines.push(chalk.dim(tempHeader));

  // Separator
  lines.push(
    " ".repeat(labelWidth) +
      dayHeaders.map(() => box.horizontal.repeat(dayWidth)).join("  ")
  );

  // Model rows for temperature
  for (const model of models) {
    const modelInfo = MODEL_INFO[model];
    const displayName = modelInfo.displayName.substring(0, 7);

    const cells: string[] = [];
    for (const comp of comparisons) {
      const value = comp.tempMax.get(model);
      if (value !== undefined) {
        const allValues = Array.from(comp.tempMax.values());
        const colorFn = getDeviationColor(value, allValues, useColor);
        cells.push(colorFn(padCenter(formatTemp(value, units), dayWidth)));
      } else {
        cells.push(padCenter("-", dayWidth));
      }
    }

    lines.push(
      chalk.white(padRight(displayName, labelWidth)) + cells.join("  ")
    );
  }

  // Spread row
  const tempSpreads: string[] = [];
  let avgTempSpread = 0;
  for (const comp of comparisons) {
    const values = Array.from(comp.tempMax.values());
    const spread = calculateSpread(values);
    tempSpreads.push(padCenter(`${Math.round(spread.range)}\u00B0`, dayWidth));
    avgTempSpread += spread.range;
  }
  avgTempSpread /= comparisons.length;

  lines.push(
    " ".repeat(labelWidth) +
      comparisons.map(() => box.horizontal.repeat(dayWidth)).join("  ")
  );
  lines.push(
    chalk.dim(padRight("Spread", labelWidth)) +
      tempSpreads.join("  ") +
      chalk.dim(`  \u2190 ${getSpreadLabel(avgTempSpread, "temp")}`)
  );

  lines.push("");

  // Render precipitation probability section
  lines.push(chalk.bold.blue(`\uD83D\uDCA7 Precipitation Probability`));
  lines.push("");

  // Header row
  lines.push(chalk.dim(tempHeader));
  lines.push(
    " ".repeat(labelWidth) +
      dayHeaders.map(() => box.horizontal.repeat(dayWidth)).join("  ")
  );

  // Model rows for precipitation
  for (const model of models) {
    const modelInfo = MODEL_INFO[model];
    const displayName = modelInfo.displayName.substring(0, 7);

    const cells: string[] = [];
    for (const comp of comparisons) {
      const value = comp.precipProb.get(model);
      if (value !== undefined) {
        const allValues = Array.from(comp.precipProb.values());
        const colorFn = getDeviationColor(value, allValues, useColor);
        cells.push(colorFn(padCenter(formatPrecipProb(value), dayWidth)));
      } else {
        cells.push(padCenter("-", dayWidth));
      }
    }

    lines.push(
      chalk.white(padRight(displayName, labelWidth)) + cells.join("  ")
    );
  }

  // Spread row for precipitation
  const precipSpreads: string[] = [];
  let avgPrecipSpread = 0;
  for (const comp of comparisons) {
    const values = Array.from(comp.precipProb.values());
    const spread = calculateSpread(values);
    precipSpreads.push(padCenter(`${Math.round(spread.range)}%`, dayWidth));
    avgPrecipSpread += spread.range;
  }
  avgPrecipSpread /= comparisons.length;

  lines.push(
    " ".repeat(labelWidth) +
      comparisons.map(() => box.horizontal.repeat(dayWidth)).join("  ")
  );
  lines.push(
    chalk.dim(padRight("Spread", labelWidth)) +
      precipSpreads.join("  ") +
      chalk.dim(`  \u2190 ${getSpreadLabel(avgPrecipSpread, "precip")}`)
  );

  lines.push("");

  // Summary footer
  const successCount = forecasts.length;
  const totalModels = models.length;
  lines.push(
    chalk.dim(
      `Based on ${successCount}/${totalModels} models. ` +
        chalk.green("\u2588") +
        " within 1\u03C3, " +
        chalk.yellow("\u2588") +
        " within 2\u03C3, " +
        chalk.red("\u2588") +
        " >2\u03C3 from mean`"
    )
  );

  return lines.join("\n");
}

/**
 * Pad string to right
 */
function padRight(str: string, width: number): string {
  return str.padEnd(width);
}

/**
 * Pad string to center
 */
function padCenter(str: string, width: number): string {
  const pad = Math.max(0, width - str.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

/**
 * Compare command action handler
 */
export async function compareHandler(
  locationQuery: string,
  options: CompareOptions
): Promise<void> {
  const spinner = ora({
    text: "Resolving location...",
    spinner: "dots",
  }).start();

  try {
    // Load config with CLI overrides
    const config = await loadConfigWithOverrides(options);
    const verbose = options.verbose ?? false;

    // Resolve location
    const geocoded = await geocodeLocation(locationQuery);
    const location: Location = {
      query: locationQuery,
      resolved: geocoded,
    };

    spinner.text = `Fetching forecasts for ${geocoded.name}...`;

    // Determine which models to fetch
    const modelsToFetch = options.models
      ? (options.models as ModelName[])
      : (config.models?.defaults as ModelName[] | undefined) ?? undefined;

    // Fetch all models
    const result = await fetchAllModels(location, modelsToFetch, {
      forecastDays: options.days ?? 7,
    });

    if (result.forecasts.length === 0) {
      spinner.fail("Failed to fetch any model forecasts");
      if (result.failures.length > 0) {
        console.error(chalk.dim("Failures:"));
        for (const failure of result.failures) {
          console.error(chalk.dim(`  - ${failure.model}: ${failure.error.message}`));
        }
      }
      process.exit(1);
    }

    spinner.succeed(`Fetched ${result.forecasts.length} model forecasts`);

    // Show failures if verbose
    if (verbose && result.failures.length > 0) {
      console.log(chalk.dim("\nSome models failed:"));
      for (const failure of result.failures) {
        console.log(chalk.dim(`  - ${failure.model}: ${failure.error.message}`));
      }
    }

    // Aggregate forecasts for additional stats
    const aggregated = aggregateForecasts(result.forecasts);

    // Render comparison table
    const output = renderComparisonTable(
      location,
      result.forecasts,
      aggregated,
      options
    );

    console.log(output);
  } catch (error) {
    spinner.fail("Failed");
    console.error(formatError(error, { verbose: options.verbose ?? false }));
    process.exit(1);
  }
}

/**
 * Register the compare command with the CLI program
 */
export function registerCompareCommand(program: Command): void {
  program
    .command("compare <location>")
    .description("Compare forecasts across weather models side-by-side")
    .option("-d, --days <n>", "Number of days to compare (1-7, default: 5)", (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > 7) {
        throw new Error("Days must be between 1 and 7");
      }
      return n;
    })
    .option("-m, --models <list>", "Models to compare (comma-separated)", (v) =>
      v.split(",").map((m) => m.trim().toLowerCase())
    )
    .action(async (location: string, cmdOptions) => {
      const globalOptions = extractGlobalOptions(program.opts());
      const options: CompareOptions = {
        ...globalOptions,
        ...cmdOptions,
      };
      await compareHandler(location, options);
    });
}
