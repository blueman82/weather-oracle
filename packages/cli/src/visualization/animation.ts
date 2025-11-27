/**
 * Animation System
 *
 * Provides brief weather-themed reveal animations that settle to static display.
 * Animations enhance UX without distracting - 0.5-1s duration.
 */

import { supportsAnimation } from "./terminal";
import type { WeatherTheme } from "./themes";

/**
 * Configuration for animation sequences.
 */
export interface AnimationConfig {
  duration: number;
  frames: string[];
  interval: number;
}

/**
 * Weather-themed loading spinners with animated frame sequences.
 */
export const LOADING_SPINNERS = {
  sunny: {
    frames: ["◐", "◓", "◑", "◒"],
    interval: 100,
    duration: 500,
  },
  rainy: {
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    interval: 80,
    duration: 500,
  },
  windy: {
    frames: ["〜", "〰", "～", "〰"],
    interval: 120,
    duration: 500,
  },
  snowy: {
    frames: ["❄", "❅", "❆", "❅"],
    interval: 150,
    duration: 600,
  },
  stormy: {
    frames: ["⚡", "☁", "⚡", "☁", "⛈", "☁"],
    interval: 100,
    duration: 600,
  },
  default: {
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    interval: 80,
    duration: 500,
  },
} as const;

/**
 * Maps weather condition strings to spinner types.
 */
const CONDITION_SPINNER_MAP: Record<string, keyof typeof LOADING_SPINNERS> = {
  clear: "sunny",
  sunny: "sunny",
  sun: "sunny",
  rain: "rainy",
  rainy: "rainy",
  drizzle: "rainy",
  shower: "rainy",
  wind: "windy",
  windy: "windy",
  breeze: "windy",
  snow: "snowy",
  snowy: "snowy",
  sleet: "snowy",
  hail: "snowy",
  storm: "stormy",
  stormy: "stormy",
  thunder: "stormy",
  lightning: "stormy",
  thunderstorm: "stormy",
};

/**
 * Ora spinner options interface (simplified for our use case).
 */
interface OraOptions {
  spinner: {
    frames: readonly string[];
    interval: number;
  };
  text?: string;
}

/**
 * Returns ora-compatible spinner options for a weather condition.
 *
 * @param condition - Weather condition string (e.g., "sunny", "rainy", "stormy")
 * @returns Ora spinner options with themed frames and interval
 */
export function weatherSpinner(condition: string): OraOptions {
  const normalizedCondition = condition.toLowerCase().trim();
  const spinnerKey =
    CONDITION_SPINNER_MAP[normalizedCondition] || "default";
  const spinner = LOADING_SPINNERS[spinnerKey];

  return {
    spinner: {
      frames: spinner.frames,
      interval: spinner.interval,
    },
  };
}

/**
 * Delays execution for specified milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converts RGB to ANSI 24-bit color escape sequence.
 */
function rgbToAnsi(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

/**
 * Resets ANSI color.
 */
const RESET = "\x1b[0m";

/**
 * Clears current line and moves cursor to beginning.
 */
const CLEAR_LINE = "\x1b[2K\x1b[0G";

/**
 * Hides cursor.
 */
const HIDE_CURSOR = "\x1b[?25l";

/**
 * Shows cursor.
 */
const SHOW_CURSOR = "\x1b[?25h";

/**
 * Performs a brief reveal animation for content using theme colors.
 * Animation is a quick gradient wipe that settles to the final content.
 *
 * Falls back to immediate display if:
 * - Terminal doesn't support animations
 * - Content is empty
 *
 * @param content - The content to reveal
 * @param theme - Weather theme for color styling
 */
export async function revealAnimation(
  content: string,
  theme: WeatherTheme
): Promise<void> {
  if (!supportsAnimation()) {
    process.stdout.write(content + "\n");
    return;
  }

  if (!content || content.length === 0) {
    return;
  }

  const lines = content.split("\n");
  const totalDuration = 500;
  const frameCount = 8;
  const frameDelay = totalDuration / frameCount;

  process.stdout.write(HIDE_CURSOR);

  try {
    for (let frame = 0; frame <= frameCount; frame++) {
      const revealProgress = frame / frameCount;

      const output = lines
        .map((line, lineIndex) => {
          const lineProgress =
            revealProgress - lineIndex / (lines.length * 2);
          const clampedProgress = Math.max(0, Math.min(1, lineProgress * 2));

          if (clampedProgress === 0) {
            return "";
          }

          const visibleChars = Math.floor(line.length * clampedProgress);
          const visiblePart = line.slice(0, visibleChars);

          if (clampedProgress < 1) {
            const color = interpolateColor(
              theme.primary,
              theme.accent,
              clampedProgress
            );
            return rgbToAnsi(color.r, color.g, color.b) + visiblePart + RESET;
          }

          return visiblePart;
        })
        .join("\n");

      process.stdout.write(CLEAR_LINE);
      const lineCount = lines.length;
      if (frame > 0) {
        process.stdout.write(`\x1b[${lineCount}A`);
      }
      process.stdout.write(output);

      if (frame < frameCount) {
        await delay(frameDelay);
      }
    }

    process.stdout.write("\n");
  } finally {
    process.stdout.write(SHOW_CURSOR);
  }
}

/**
 * Interpolates between two RGB colors.
 */
function interpolateColor(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}
