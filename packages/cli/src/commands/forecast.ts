/**
 * Forecast command for Weather Oracle CLI.
 * Main command that geocodes location, fetches forecasts from all models,
 * aggregates data, generates narrative, and displays formatted output.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  calculateConfidence,
  generateNarrative,
  MODEL_INFO,
  toFahrenheit,
  toKmPerHour,
  toCardinalDirection,
  createCacheManager,
  createForecastCacheKey,
  type ModelName,
  type Location,
  type AggregatedForecast,
  type ConfidenceResult,
  type NarrativeSummary,
  type MultiModelResult,
} from "@weather-oracle/core";
import { createFormatter, type FormatterInput, type OutputFormatType } from "../formatters/index";
import { formatError } from "../errors/handler";
import { extractGlobalOptions, loadConfigWithOverrides } from "../program";

/**
 * Options for the forecast command
 */
export interface ForecastOptions {
  days?: number;
  models?: string[];
  units?: "metric" | "imperial";
  format?: OutputFormatType | "minimal";
  verbose?: boolean;
  color?: boolean;
  noCache?: boolean;
}

/**
 * Get weather emoji based on weather code
 */
function getWeatherEmoji(code: number): string {
  // WMO weather codes
  if (code === 0) return "\u2600\uFE0F"; // Clear
  if (code <= 3) return "\u26C5"; // Partly cloudy
  if (code <= 49) return "\u2601\uFE0F"; // Cloudy/fog
  if (code <= 59) return "\uD83C\uDF27\uFE0F"; // Drizzle
  if (code <= 69) return "\uD83C\uDF27\uFE0F"; // Rain
  if (code <= 79) return "\u2744\uFE0F"; // Snow
  if (code <= 84) return "\uD83C\uDF27\uFE0F"; // Showers
  if (code <= 94) return "\u26A1"; // Thunderstorm
  return "\u2753"; // Unknown
}

/**
 * Get confidence level text and emoji
 */
function getConfidenceDisplay(confidence: ConfidenceResult): {
  emoji: string;
  text: string;
} {
  switch (confidence.level) {
    case "high":
      return { emoji: "\u2705", text: "HIGH CONFIDENCE" };
    case "medium":
      return { emoji: "\u26A0\uFE0F", text: "MODERATE CONFIDENCE" };
    case "low":
      return { emoji: "\u2753", text: "LOW CONFIDENCE" };
  }
}

/**
 * Render narrative format output (default)
 */
function renderNarrativeOutput(
  location: Location,
  aggregated: AggregatedForecast,
  confidence: ConfidenceResult,
  narrative: NarrativeSummary,
  options: ForecastOptions
): string {
  const lines: string[] = [];
  const useColor = options.color !== false && process.stdout.isTTY;
  const units = options.units ?? "metric";

  // Get first daily forecast for summary data
  const firstDay = aggregated.consensus.daily[0];
  if (!firstDay) {
    return "No forecast data available.";
  }

  const weatherEmoji = getWeatherEmoji(firstDay.forecast.weatherCode as number);
  const confDisplay = getConfidenceDisplay(confidence);

  // Header
  lines.push("");
  if (useColor) {
    lines.push(
      chalk.bold(`${weatherEmoji}  ${location.resolved.name}, ${location.resolved.country} - Weather Outlook`)
    );
    lines.push(chalk.dim("\u2501".repeat(50)));
  } else {
    lines.push(`${weatherEmoji}  ${location.resolved.name}, ${location.resolved.country} - Weather Outlook`);
    lines.push("=".repeat(50));
  }
  lines.push("");

  // Model consensus
  const modelsAgree = aggregated.models.length;
  const totalModels = Object.keys(MODEL_INFO).length;
  if (useColor) {
    lines.push(
      chalk.bold(`\uD83D\uDCCA Model Consensus: ${confDisplay.text}`)
    );
  } else {
    lines.push(`Model Consensus: ${confDisplay.text}`);
  }
  lines.push(`   ${modelsAgree} of ${totalModels} models contributing to forecast`);

  // Add narrative headline
  if (narrative.headline) {
    lines.push(`   ${narrative.headline}`);
  }
  lines.push("");

  // Temperature
  const tempRange = units === "imperial"
    ? `${Math.round(toFahrenheit(firstDay.forecast.temperature.min))}-${Math.round(toFahrenheit(firstDay.forecast.temperature.max))}\u00B0F`
    : `${Math.round(firstDay.forecast.temperature.min as number)}-${Math.round(firstDay.forecast.temperature.max as number)}\u00B0C`;

  if (useColor) {
    lines.push(chalk.bold(`\uD83C\uDF21\uFE0F  Temperature: ${tempRange}`));
  } else {
    lines.push(`Temperature: ${tempRange}`);
  }

  // Precipitation
  const precipProb = Math.round(firstDay.forecast.precipitation.probability);
  const precipIcon = precipProb > 50 ? "\uD83D\uDCA7" : "\uD83D\uDCA7";
  if (useColor) {
    lines.push(chalk.bold(`${precipIcon} Precipitation: ${precipProb}% chance`));
  } else {
    lines.push(`Precipitation: ${precipProb}% chance`);
  }

  // Wind
  const windSpeedKmh = Math.round(toKmPerHour(firstDay.forecast.wind.maxSpeed));
  const windDir = toCardinalDirection(firstDay.forecast.wind.dominantDirection);
  if (useColor) {
    lines.push(chalk.bold(`\uD83D\uDCA8 Wind: ${windSpeedKmh} km/h ${windDir}`));
  } else {
    lines.push(`Wind: ${windSpeedKmh} km/h ${windDir}`);
  }

  // Humidity
  const humidityMin = Math.round(firstDay.forecast.humidity.min as number);
  const humidityMax = Math.round(firstDay.forecast.humidity.max as number);
  if (useColor) {
    lines.push(chalk.bold(`\uD83D\uDCA6 Humidity: ${humidityMin}-${humidityMax}%`));
  } else {
    lines.push(`Humidity: ${humidityMin}-${humidityMax}%`);
  }

  lines.push("");

  // Narrative body if present
  if (narrative.body) {
    if (useColor) {
      lines.push(chalk.dim(narrative.body));
    } else {
      lines.push(narrative.body);
    }
    lines.push("");
  }

  // Alerts
  if (narrative.alerts.length > 0) {
    if (useColor) {
      lines.push(chalk.yellow("\u26A0\uFE0F  Alerts:"));
    } else {
      lines.push("Alerts:");
    }
    for (const alert of narrative.alerts) {
      lines.push(`   \u2022 ${alert}`);
    }
    lines.push("");
  }

  // Model notes
  if (options.verbose && narrative.modelNotes.length > 0) {
    if (useColor) {
      lines.push(chalk.dim("Model notes:"));
    } else {
      lines.push("Model notes:");
    }
    for (const note of narrative.modelNotes) {
      lines.push(chalk.dim(`   \u2022 ${note}`));
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Render minimal format output
 */
function renderMinimalOutput(
  location: Location,
  aggregated: AggregatedForecast,
  options: ForecastOptions
): string {
  const units = options.units ?? "metric";
  const firstDay = aggregated.consensus.daily[0];

  if (!firstDay) {
    return "No forecast data available.";
  }

  const tempMin = Math.round(
    units === "imperial"
      ? toFahrenheit(firstDay.forecast.temperature.min)
      : (firstDay.forecast.temperature.min as number)
  );
  const tempMax = Math.round(
    units === "imperial"
      ? toFahrenheit(firstDay.forecast.temperature.max)
      : (firstDay.forecast.temperature.max as number)
  );
  const precipProb = Math.round(firstDay.forecast.precipitation.probability);
  const emoji = getWeatherEmoji(firstDay.forecast.weatherCode as number);
  const unit = units === "imperial" ? "F" : "C";

  return `${emoji} ${location.resolved.name}: ${tempMin}-${tempMax}\u00B0${unit}, ${precipProb}% rain`;
}

/**
 * Forecast command action handler
 */
export async function forecastHandler(
  locationQuery: string,
  options: ForecastOptions
): Promise<void> {
  const spinner = ora({
    text: "Resolving location...",
    spinner: "dots",
  }).start();

  try {
    // Load config with CLI overrides (extract only the global options)
    // Note: 'narrative' format is CLI-specific, not passed to config
    const configFormat = options.format !== "narrative" ? options.format : undefined;
    const config = await loadConfigWithOverrides({
      units: options.units,
      days: options.days,
      models: options.models,
      format: configFormat as "table" | "json" | "minimal" | undefined,
      verbose: options.verbose,
      color: options.color,
    });
    const verbose = options.verbose ?? false;

    // Use config values as defaults (fixes bug where config.display.units was ignored)
    const effectiveOptions: ForecastOptions = {
      ...options,
      units: options.units ?? config.display.units,
    };

    // Create cache manager (disabled if --no-cache flag is set)
    const cache = createCacheManager({ enabled: !options.noCache });

    // Step 1: Geocode location
    const geocoded = await geocodeLocation(locationQuery);
    const location: Location = {
      query: locationQuery,
      resolved: geocoded,
    };

    spinner.text = `Fetching forecasts for ${geocoded.name}...`;

    // Step 2: Determine which models to fetch
    const modelsToFetch = options.models
      ? (options.models as ModelName[])
      : (config.models?.defaults as ModelName[] | undefined) ?? undefined;

    // Step 3: Check cache or fetch all models
    const cacheKey = createForecastCacheKey(
      geocoded.coordinates.latitude,
      geocoded.coordinates.longitude,
      modelsToFetch?.join(",") ?? "all",
      new Date()
    );

    let result: MultiModelResult;
    const cachedResult = await cache.get<MultiModelResult>(cacheKey);

    if (cachedResult) {
      spinner.text = "Using cached forecast data...";
      result = cachedResult;
      if (verbose) {
        spinner.info("Using cached data (use --no-cache to fetch fresh)");
        spinner.start();
      }
    } else {
      result = await fetchAllModels(location, modelsToFetch, {
        forecastDays: options.days ?? 7,
      });

      // Cache the result for future requests (1 hour TTL)
      if (result.forecasts.length > 0) {
        await cache.set(cacheKey, result, 3600);
      }
    }

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

    spinner.text = "Aggregating forecast data...";

    // Step 4: Aggregate forecasts
    const aggregated = aggregateForecasts(result.forecasts);

    spinner.text = "Calculating confidence...";

    // Step 5: Calculate confidence
    const confidence = calculateConfidence(aggregated, "overall", 0);

    spinner.text = "Generating narrative...";

    // Step 6: Generate narrative
    const narrative = generateNarrative(aggregated, [confidence]);

    spinner.succeed(`Forecast ready (${result.forecasts.length} models)`);

    // Show failures if verbose
    if (verbose && result.failures.length > 0) {
      console.log(chalk.dim("\nSome models failed:"));
      for (const failure of result.failures) {
        console.log(chalk.dim(`  - ${failure.model}: ${failure.error.message}`));
      }
    }

    // Step 7: Format and display output
    const format = options.format ?? "narrative";

    let output: string;
    if (format === "minimal") {
      output = renderMinimalOutput(location, aggregated, effectiveOptions);
    } else if (format === "table" || format === "json" || format === "narrative") {
      // Use formatter factory for table, json, and narrative
      const formatterInput: FormatterInput = {
        location,
        aggregated,
        confidence: [confidence],
        narrative,
        models: result.forecasts,
      };

      const formatter = createFormatter(format, {
        useColors: effectiveOptions.color !== false && process.stdout.isTTY,
        units: effectiveOptions.units ?? "metric",
        showModelDetails: verbose,
        showConfidence: true,
        maxDays: options.days ?? config.display.defaultDays,
      });

      output = formatter.format(formatterInput);
    } else {
      // Default to built-in narrative renderer for best output
      output = renderNarrativeOutput(
        location,
        aggregated,
        confidence,
        narrative,
        effectiveOptions
      );
    }

    console.log(output);
  } catch (error) {
    spinner.fail("Failed");
    console.error(formatError(error, { verbose: options.verbose ?? false }));
    process.exit(1);
  }
}

/**
 * Register the forecast command with the CLI program
 */
export function registerForecastCommand(program: Command): void {
  // Remove the placeholder forecast command and add the real one
  const existingCommandIndex = (program.commands as Command[]).findIndex((cmd) => cmd.name() === "forecast");
  if (existingCommandIndex !== -1) {
    (program.commands as Command[]).splice(existingCommandIndex, 1);
  }

  program
    .command("forecast <location>")
    .description("Get weather forecast for a location with model consensus")
    .option("-d, --days <n>", "Forecast days (1-16, default: 7)", (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > 16) {
        throw new Error("Days must be between 1 and 16");
      }
      return n;
    })
    .option("-m, --models <list>", "Models to query (comma-separated)", (v) =>
      v.split(",").map((m) => m.trim().toLowerCase())
    )
    .option(
      "-f, --format <type>",
      "Output format (table/json/narrative/minimal)",
      (v) => {
        const normalized = v.toLowerCase();
        if (!["table", "json", "narrative", "minimal"].includes(normalized)) {
          throw new Error('Format must be "table", "json", "narrative", or "minimal"');
        }
        return normalized as OutputFormatType | "minimal";
      }
    )
    .option("--no-cache", "Disable caching (fetch fresh data from API)")
    .action(async (location: string, cmdOptions) => {
      const globalOptions = extractGlobalOptions(program.opts());
      // Build options, preferring command-specific options over global
      // Note: Commander's --no-cache sets cmdOptions.cache = false
      const options: ForecastOptions = {
        days: cmdOptions.days ?? globalOptions.days,
        models: cmdOptions.models ?? globalOptions.models,
        units: globalOptions.units,
        format: cmdOptions.format ?? (globalOptions.format as OutputFormatType | "minimal" | undefined),
        verbose: globalOptions.verbose,
        color: globalOptions.color,
        noCache: cmdOptions.cache === false,
      };
      await forecastHandler(location, options);
    });
}
