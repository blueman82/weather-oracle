/**
 * Template strings and builders for narrative generation.
 * Carlow Weather-style plain language summaries.
 */

import type { ConfidenceLevelName, ModelName } from "../types/models";
import type { WeatherCode } from "../types/weather";

/**
 * Weather condition categories for narrative descriptions
 */
export type WeatherCondition =
  | "sunny"
  | "partly_cloudy"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy_rain"
  | "thunderstorm"
  | "snow"
  | "sleet"
  | "unknown";

/**
 * Map WMO weather codes to human-readable conditions.
 * WMO codes: https://codes.wmo.int/bufr4/codeflag/_0-20-003
 */
export function weatherCodeToCondition(code: WeatherCode | number): WeatherCondition {
  const numCode = code as number;

  // Clear sky
  if (numCode === 0) return "sunny";

  // Mainly clear, partly cloudy
  if (numCode >= 1 && numCode <= 2) return "partly_cloudy";

  // Overcast
  if (numCode === 3) return "cloudy";

  // Fog
  if (numCode >= 45 && numCode <= 48) return "fog";

  // Drizzle
  if (numCode >= 51 && numCode <= 57) return "drizzle";

  // Rain
  if (numCode >= 61 && numCode <= 65) return "rain";
  if (numCode >= 66 && numCode <= 67) return "sleet"; // Freezing rain

  // Heavy rain / showers
  if (numCode >= 80 && numCode <= 82) return "rain";
  if (numCode === 65 || numCode === 82) return "heavy_rain";

  // Snow
  if (numCode >= 71 && numCode <= 77) return "snow";
  if (numCode >= 85 && numCode <= 86) return "snow";

  // Thunderstorm
  if (numCode >= 95 && numCode <= 99) return "thunderstorm";

  return "unknown";
}

/**
 * Get human-readable weather description
 */
export function conditionToDescription(condition: WeatherCondition): string {
  switch (condition) {
    case "sunny":
      return "sunny";
    case "partly_cloudy":
      return "partly cloudy";
    case "cloudy":
      return "cloudy";
    case "overcast":
      return "overcast";
    case "fog":
      return "foggy";
    case "drizzle":
      return "light rain";
    case "rain":
      return "rain";
    case "heavy_rain":
      return "heavy rain";
    case "thunderstorm":
      return "thunderstorms";
    case "snow":
      return "snow";
    case "sleet":
      return "sleet";
    case "unknown":
      return "mixed conditions";
  }
}

/**
 * Check if condition involves precipitation
 */
export function isPrecipitation(condition: WeatherCondition): boolean {
  return ["drizzle", "rain", "heavy_rain", "thunderstorm", "snow", "sleet"].includes(condition);
}

/**
 * Check if condition is "dry"
 */
export function isDryCondition(condition: WeatherCondition): boolean {
  return ["sunny", "partly_cloudy", "cloudy", "overcast", "fog"].includes(condition);
}

/**
 * Format confidence level for display in narrative
 */
export function formatConfidenceLevel(level: ConfidenceLevelName): string {
  return level.toUpperCase();
}

/**
 * Format model name for display
 */
export function formatModelName(model: ModelName): string {
  switch (model) {
    case "ecmwf":
      return "ECMWF";
    case "gfs":
      return "GFS";
    case "icon":
      return "ICON";
    case "meteofrance":
      return "ARPEGE";
    case "ukmo":
      return "UK Met Office";
    case "jma":
      return "JMA";
    case "gem":
      return "GEM";
  }
}

/**
 * Format a list of model names with proper grammar
 */
export function formatModelList(models: readonly ModelName[]): string {
  if (models.length === 0) return "";
  if (models.length === 1) return formatModelName(models[0]);
  if (models.length === 2) {
    return `${formatModelName(models[0])} and ${formatModelName(models[1])}`;
  }
  const formatted = models.map(formatModelName);
  const last = formatted.pop();
  return `${formatted.join(", ")}, and ${last}`;
}

/**
 * Format temperature for display
 */
export function formatTemperature(temp: number): string {
  return `${Math.round(temp)}\u00B0C`;
}

/**
 * Format precipitation amount for display
 */
export function formatPrecipitation(mm: number): string {
  if (mm < 1) return "trace amounts";
  if (mm < 5) return `${mm.toFixed(0)}mm`;
  return `${mm.toFixed(0)}mm`;
}

/**
 * Format day name from date
 */
export function formatDayName(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

/**
 * Format date with relative description (today, tomorrow, day name)
 */
export function formatRelativeDay(date: Date, referenceDate: Date = new Date()): string {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const refOnly = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const diffDays = Math.round((dateOnly.getTime() - refOnly.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays >= 2 && diffDays <= 6) return formatDayName(date);

  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/**
 * Get time period description (morning, afternoon, evening, etc.)
 */
export function formatTimePeriod(hour: number): string {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "overnight";
}

// ============================================================================
// Narrative Templates
// ============================================================================

/**
 * Agreement templates when models agree
 */
export const AGREEMENT_TEMPLATES = {
  strong: [
    "Models agree on {condition} conditions through {endDay}.",
    "All models are in agreement: {condition} through {endDay}.",
    "Strong model consensus shows {condition} conditions through {endDay}.",
  ],
  moderate: [
    "Most models agree on {condition} conditions through {endDay}.",
    "Models generally show {condition} through {endDay}.",
    "There's good agreement on {condition} conditions through {endDay}.",
  ],
} as const;

/**
 * Disagreement templates when models diverge
 */
export const DISAGREEMENT_TEMPLATES = {
  temperature: [
    "Models disagree significantly on {day} temperatures. {highModel} predicts {highTemp} while {lowModel} shows only {lowTemp}.",
    "Temperature uncertainty for {day}: {highModel} shows {highTemp}, {lowModel} only {lowTemp}.",
  ],
  precipitation: [
    "Models show different precipitation amounts for {day}. {highModel} predicts {highAmount} while {lowModel} shows {lowAmount}.",
    "Precipitation uncertainty: {highModel} ({highAmount}) vs {lowModel} ({lowAmount}) for {day}.",
  ],
} as const;

/**
 * Transition templates when weather is changing
 */
export const TRANSITION_TEMPLATES = {
  dryToWet: [
    "{condition} arriving {day} {period}.",
    "Expect {condition} to move in {day} {period}.",
    "{condition} expected {day} {period}.",
  ],
  wetToDry: [
    "{condition} clearing by {day}.",
    "Drier conditions returning {day}.",
    "Expect clearing skies by {day}.",
  ],
} as const;

/**
 * Uncertainty templates for extended forecasts
 */
export const UNCERTAINTY_TEMPLATES = [
  "This uncertainty is common at {days}+ days out. Check back {checkDay} for a clearer picture.",
  "Extended range forecasts beyond {days} days carry increased uncertainty.",
  "Consider this a general trend - details may change as we get closer.",
] as const;

/**
 * Confidence explanation templates
 */
export const CONFIDENCE_TEMPLATES = {
  high: "Confidence is HIGH for {period}.",
  medium: "Confidence is MEDIUM for {period}.",
  low: "Confidence is LOW for {period} - significant model disagreement.",
} as const;

/**
 * Select a random template from an array
 */
export function selectTemplate<T>(templates: readonly T[]): T {
  return templates[0]; // Use first template for deterministic output
}

/**
 * Fill template placeholders
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}
