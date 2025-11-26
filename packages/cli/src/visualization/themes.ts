/**
 * Weather Mood Theming
 *
 * Provides atmospheric color palettes that shift based on weather conditions
 * and time of day. Themes use semantic color psychology to create immersive
 * terminal experiences.
 */

import type { RGB } from "./color-space";

export type BorderStyle = "wavy" | "jagged" | "soft" | "standard";

export interface BoxChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

export interface WeatherTheme {
  primary: RGB;
  secondary: RGB;
  accent: RGB;
  borderStyle: BorderStyle;
}

/**
 * Mood themes inspired by real weather aesthetics.
 * Each theme uses color psychology to evoke the feeling of the weather condition.
 */
export const MOOD_THEMES = {
  sunny: {
    primary: { r: 255, g: 107, b: 53 }, // Warm amber #FF6B35
    secondary: { r: 255, g: 200, b: 87 }, // Golden yellow #FFC857
    accent: { r: 255, g: 234, b: 167 }, // Soft cream #FFEAA7
    borderStyle: "wavy" as BorderStyle, // Heat shimmer effect
  },
  rainy: {
    primary: { r: 116, g: 140, b: 171 }, // Blue-gray #748CAB
    secondary: { r: 61, g: 90, b: 128 }, // Deeper slate #3D5A80
    accent: { r: 152, g: 193, b: 217 }, // Pale sky #98C1D9
    borderStyle: "soft" as BorderStyle, // Calm, melancholic
  },
  stormy: {
    primary: { r: 54, g: 57, b: 69 }, // Charcoal #363945
    secondary: { r: 69, g: 75, b: 94 }, // Dark slate #454B5E
    accent: { r: 255, g: 230, b: 109 }, // Electric yellow #FFE66D
    borderStyle: "jagged" as BorderStyle, // Dramatic lightning feel
  },
  snowy: {
    primary: { r: 200, g: 215, b: 235 }, // Moonlight blue #C8D7EB
    secondary: { r: 220, g: 208, b: 230 }, // Lavender #DCD0E6
    accent: { r: 240, g: 248, b: 255 }, // Alice blue #F0F8FF
    borderStyle: "soft" as BorderStyle, // Serene, peaceful
  },
  serene: {
    primary: { r: 135, g: 206, b: 235 }, // Sky blue #87CEEB
    secondary: { r: 176, g: 224, b: 230 }, // Powder blue #B0E0E6
    accent: { r: 255, g: 255, b: 240 }, // Ivory #FFFFF0
    borderStyle: "soft" as BorderStyle, // Clear day calm
  },
  sunset: {
    primary: { r: 255, g: 99, b: 71 }, // Tomato red #FF6347
    secondary: { r: 255, g: 165, b: 0 }, // Orange #FFA500
    accent: { r: 255, g: 192, b: 203 }, // Pink #FFC0CB
    borderStyle: "wavy" as BorderStyle, // Warm evening shimmer
  },
} as const;

/**
 * WMO Weather Codes mapping to theme categories.
 * See: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
const WMO_THEME_MAPPING: Record<number, keyof typeof MOOD_THEMES> = {
  // Clear sky
  0: "sunny",
  // Mainly clear, partly cloudy
  1: "serene",
  2: "serene",
  3: "serene",
  // Fog
  45: "rainy",
  48: "rainy",
  // Drizzle
  51: "rainy",
  53: "rainy",
  55: "rainy",
  56: "rainy",
  57: "rainy",
  // Rain
  61: "rainy",
  63: "rainy",
  65: "rainy",
  66: "rainy",
  67: "rainy",
  // Snow
  71: "snowy",
  73: "snowy",
  75: "snowy",
  77: "snowy",
  // Rain showers
  80: "rainy",
  81: "rainy",
  82: "stormy",
  // Snow showers
  85: "snowy",
  86: "snowy",
  // Thunderstorm
  95: "stormy",
  96: "stormy",
  99: "stormy",
};

/**
 * Determines whether the current hour falls within sunset/sunrise window.
 */
function isSunsetOrSunrise(hour: number): boolean {
  const isSunrise = hour >= 5 && hour <= 7;
  const isSunset = hour >= 17 && hour <= 20;
  return isSunrise || isSunset;
}

/**
 * Returns the appropriate weather theme based on weather code and time of day.
 *
 * @param weatherCode - WMO standard weather code
 * @param hour - Hour of day in 24-hour format (0-23)
 * @returns The weather theme matching the conditions
 */
export function getThemeForConditions(
  weatherCode: number,
  hour: number
): WeatherTheme {
  // Sunset/sunrise overrides clear/serene weather
  if (isSunsetOrSunrise(hour)) {
    const baseTheme = WMO_THEME_MAPPING[weatherCode];
    if (baseTheme === "sunny" || baseTheme === "serene" || baseTheme === undefined) {
      return { ...MOOD_THEMES.sunset };
    }
  }

  // Look up theme from WMO code mapping
  const themeKey = WMO_THEME_MAPPING[weatherCode];
  if (themeKey) {
    return { ...MOOD_THEMES[themeKey] };
  }

  // Default to serene for unknown codes
  return { ...MOOD_THEMES.serene };
}

/**
 * Box drawing characters for different border styles.
 */
const BORDER_CHARS: Record<BorderStyle, BoxChars> = {
  standard: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
  },
  soft: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
  },
  wavy: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "∿",
    vertical: "┊",
  },
  jagged: {
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "⌇",
    vertical: "⌇",
  },
};

/**
 * Returns box drawing characters for the specified border style.
 *
 * @param style - The border style
 * @returns Box drawing characters for creating borders
 */
export function getBorderChars(style: BorderStyle): BoxChars {
  return { ...BORDER_CHARS[style] };
}
