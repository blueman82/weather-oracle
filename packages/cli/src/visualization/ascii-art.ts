/**
 * ASCII Weather Art
 *
 * Multi-line ASCII/Unicode weather icons with visual depth through
 * shading, layering, and line weight variation.
 */

import type { WeatherTheme } from "./themes";

export interface WeatherArt {
  lines: string[];
  width: number;
  height: number;
}

/**
 * Layered ASCII art for weather conditions.
 * Uses visual depth techniques:
 * - Line weight variation (thin ─ vs thick ━)
 * - Block density for clouds (▂▃▄▅▆▇)
 * - Bright/dim contrast via character selection
 */
export const WEATHER_ART: Record<string, WeatherArt> = {
  clear: {
    lines: [
      "    \\   |   /    ",
      "      .─────.      ",
      "  ── (       ) ──  ",
      "      `─────'      ",
      "    /   |   \\    ",
    ],
    width: 19,
    height: 5,
  },

  partlyCloudy: {
    lines: [
      "   \\  |  /       ",
      "    .───.  ▄▅▆▅▄  ",
      " ──(     )▆█████▆ ",
      "    `───'▅███████▅",
      "        ▃▅▆▅▄▃▂▁  ",
    ],
    width: 19,
    height: 5,
  },

  cloudy: {
    lines: [
      "      ▄▅▆▇▆▅▄     ",
      "    ▆█████████▆   ",
      "  ▅███████████████▅",
      " ▃▆████████████▆▃ ",
      "  ▁▂▃▄▅▄▃▂▁▂▃▂▁   ",
    ],
    width: 19,
    height: 5,
  },

  rain: {
    lines: [
      "     ▄▅▆▇▆▅▄      ",
      "   ▅███████████▅  ",
      "  ▃▆███████████▆▃ ",
      "   ╱ ╱ ╱ ╱ ╱ ╱    ",
      "  ╱ ╱ ╱ ╱ ╱ ╱     ",
    ],
    width: 19,
    height: 5,
  },

  heavyRain: {
    lines: [
      "    ▄▆▇█▇▆▄       ",
      "  ▆███████████▆   ",
      " ▅██████████████▅ ",
      "  ┃╱┃╱┃╱┃╱┃╱┃╱    ",
      " ┃╱┃╱┃╱┃╱┃╱┃╱┃╱   ",
    ],
    width: 19,
    height: 5,
  },

  snow: {
    lines: [
      "     ▄▅▆▇▆▅▄      ",
      "   ▅███████████▅  ",
      "  ▃▆███████████▆▃ ",
      "   ❄  ❅  ❆  ❄     ",
      "  ❅  ❆  ❄  ❅  ❆   ",
    ],
    width: 19,
    height: 5,
  },

  thunderstorm: {
    lines: [
      "   ▄▆▇█████▇▆▄    ",
      " ▆██████████████▆ ",
      "▅████████████████▅",
      "    ⚡  ┃╱  ⚡     ",
      "  ┃╱┃╱ ⚡ ┃╱┃╱    ",
    ],
    width: 19,
    height: 5,
  },

  fog: {
    lines: [
      "  ═══════════════ ",
      " ────────────────  ",
      "  ═══════════════ ",
      " ────────────────  ",
      "  ═══════════════ ",
    ],
    width: 19,
    height: 5,
  },
};

/**
 * Compact single-character icons for inline display.
 */
const COMPACT_ICONS: Record<string, string> = {
  clear: "☀",
  partlyCloudy: "⛅",
  cloudy: "☁",
  rain: "🌧",
  heavyRain: "⛈",
  snow: "❄",
  thunderstorm: "⚡",
  fog: "🌫",
};

/**
 * WMO Weather Code to art key mapping.
 */
function getArtKeyForCode(code: number): string {
  // Clear sky
  if (code === 0) return "clear";

  // Mainly clear, partly cloudy
  if (code >= 1 && code <= 2) return "partlyCloudy";

  // Overcast
  if (code === 3) return "cloudy";

  // Fog
  if (code >= 45 && code <= 48) return "fog";

  // Drizzle (light rain)
  if (code >= 51 && code <= 57) return "rain";

  // Rain
  if (code >= 61 && code <= 63) return "rain";
  if (code >= 64 && code <= 65) return "heavyRain";
  if (code >= 66 && code <= 67) return "heavyRain"; // Freezing rain

  // Snow
  if (code >= 71 && code <= 77) return "snow";

  // Rain showers
  if (code >= 80 && code <= 81) return "rain";
  if (code === 82) return "heavyRain";

  // Snow showers
  if (code >= 85 && code <= 86) return "snow";

  // Thunderstorm
  if (code >= 95 && code <= 99) return "thunderstorm";

  // Default to partly cloudy for unknown codes
  return "partlyCloudy";
}

/**
 * Applies ANSI true-color formatting to a line of art.
 * Uses theme.primary for main elements and theme.accent for highlights.
 */
function applyThemeColors(line: string, theme: WeatherTheme): string {
  const { primary, accent } = theme;

  // ANSI escape codes for true color
  const primaryColor = `\x1b[38;2;${primary.r};${primary.g};${primary.b}m`;
  const accentColor = `\x1b[38;2;${accent.r};${accent.g};${accent.b}m`;
  const reset = "\x1b[0m";

  // Highlight characters that should use accent color
  const highlightChars = new Set(["⚡", "☀", "❄", "❅", "❆", "╲", "│", "╱", "\\", "|", "/"]);

  let result = "";
  let currentColor = "";

  for (const char of line) {
    const targetColor = highlightChars.has(char) ? accentColor : primaryColor;

    if (targetColor !== currentColor && char !== " ") {
      result += targetColor;
      currentColor = targetColor;
    }

    result += char;
  }

  return result + reset;
}

/**
 * Renders a multi-line ASCII weather icon with theme colors applied.
 *
 * @param code - WMO standard weather code
 * @param theme - Weather theme for coloring
 * @returns Multi-line string with ANSI color codes
 */
export function renderWeatherIcon(code: number, theme: WeatherTheme): string {
  const artKey = getArtKeyForCode(code);
  const art = WEATHER_ART[artKey];

  return art.lines.map((line) => applyThemeColors(line, theme)).join("\n");
}

/**
 * Returns a compact single-character weather icon for inline display.
 * Falls back to a cloud emoji for unknown codes.
 *
 * @param code - WMO standard weather code
 * @returns Single character/emoji weather icon
 */
export function getCompactIcon(code: number): string {
  const artKey = getArtKeyForCode(code);
  return COMPACT_ICONS[artKey] ?? "☁";
}
