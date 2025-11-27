/**
 * Tests for Animation System
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import {
  AnimationConfig,
  LOADING_SPINNERS,
  weatherSpinner,
  revealAnimation,
} from "./animation";
import * as terminal from "./terminal";
import type { WeatherTheme } from "./themes";

describe("Animation System", () => {
  describe("AnimationConfig interface", () => {
    test("can create valid AnimationConfig", () => {
      const config: AnimationConfig = {
        duration: 500,
        frames: ["a", "b", "c"],
        interval: 100,
      };
      expect(config.duration).toBe(500);
      expect(config.frames).toEqual(["a", "b", "c"]);
      expect(config.interval).toBe(100);
    });
  });

  describe("LOADING_SPINNERS", () => {
    test("contains sunny spinner with rotating sun frames", () => {
      const sunny = LOADING_SPINNERS.sunny;
      expect(sunny.frames).toEqual(["◐", "◓", "◑", "◒"]);
      expect(sunny.interval).toBe(100);
      expect(sunny.duration).toBe(500);
    });

    test("contains rainy spinner with dripping frames", () => {
      const rainy = LOADING_SPINNERS.rainy;
      expect(rainy.frames).toContain("⠋");
      expect(rainy.frames).toContain("⠙");
      expect(rainy.interval).toBe(80);
      expect(rainy.duration).toBe(500);
    });

    test("contains windy spinner with flowing frames", () => {
      const windy = LOADING_SPINNERS.windy;
      expect(windy.frames).toContain("〜");
      expect(windy.frames).toContain("〰");
      expect(windy.frames).toContain("～");
      expect(windy.interval).toBe(120);
    });

    test("contains snowy spinner with snowflake frames", () => {
      const snowy = LOADING_SPINNERS.snowy;
      expect(snowy.frames).toContain("❄");
      expect(snowy.frames).toContain("❅");
      expect(snowy.frames).toContain("❆");
      expect(snowy.interval).toBe(150);
    });

    test("contains stormy spinner with lightning frames", () => {
      const stormy = LOADING_SPINNERS.stormy;
      expect(stormy.frames).toContain("⚡");
      expect(stormy.frames).toContain("☁");
      expect(stormy.frames).toContain("⛈");
      expect(stormy.interval).toBe(100);
    });

    test("contains default spinner", () => {
      const defaultSpinner = LOADING_SPINNERS.default;
      expect(defaultSpinner.frames.length).toBeGreaterThan(0);
      expect(defaultSpinner.interval).toBeGreaterThan(0);
      expect(defaultSpinner.duration).toBeGreaterThan(0);
    });

    test("all spinners have required properties", () => {
      const spinnerNames = Object.keys(LOADING_SPINNERS) as Array<
        keyof typeof LOADING_SPINNERS
      >;

      for (const name of spinnerNames) {
        const spinner = LOADING_SPINNERS[name];
        expect(spinner.frames).toBeDefined();
        expect(Array.isArray(spinner.frames)).toBe(true);
        expect(spinner.frames.length).toBeGreaterThan(0);
        expect(typeof spinner.interval).toBe("number");
        expect(spinner.interval).toBeGreaterThan(0);
        expect(typeof spinner.duration).toBe("number");
        expect(spinner.duration).toBeGreaterThan(0);
      }
    });

    test("all spinner durations are brief (under 1s)", () => {
      const spinnerNames = Object.keys(LOADING_SPINNERS) as Array<
        keyof typeof LOADING_SPINNERS
      >;

      for (const name of spinnerNames) {
        const spinner = LOADING_SPINNERS[name];
        expect(spinner.duration).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe("weatherSpinner", () => {
    test("returns sunny spinner for 'sunny' condition", () => {
      const result = weatherSpinner("sunny");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.sunny.frames);
      expect(result.spinner.interval).toBe(LOADING_SPINNERS.sunny.interval);
    });

    test("returns sunny spinner for 'clear' condition", () => {
      const result = weatherSpinner("clear");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.sunny.frames);
    });

    test("returns rainy spinner for 'rain' condition", () => {
      const result = weatherSpinner("rain");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.rainy.frames);
    });

    test("returns rainy spinner for 'drizzle' condition", () => {
      const result = weatherSpinner("drizzle");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.rainy.frames);
    });

    test("returns windy spinner for 'windy' condition", () => {
      const result = weatherSpinner("windy");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.windy.frames);
    });

    test("returns windy spinner for 'breeze' condition", () => {
      const result = weatherSpinner("breeze");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.windy.frames);
    });

    test("returns snowy spinner for 'snow' condition", () => {
      const result = weatherSpinner("snow");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.snowy.frames);
    });

    test("returns snowy spinner for 'sleet' condition", () => {
      const result = weatherSpinner("sleet");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.snowy.frames);
    });

    test("returns stormy spinner for 'storm' condition", () => {
      const result = weatherSpinner("storm");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.stormy.frames);
    });

    test("returns stormy spinner for 'thunderstorm' condition", () => {
      const result = weatherSpinner("thunderstorm");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.stormy.frames);
    });

    test("returns stormy spinner for 'lightning' condition", () => {
      const result = weatherSpinner("lightning");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.stormy.frames);
    });

    test("returns default spinner for unknown condition", () => {
      const result = weatherSpinner("unknown");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.default.frames);
    });

    test("handles case-insensitive conditions", () => {
      const result = weatherSpinner("SUNNY");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.sunny.frames);
    });

    test("handles conditions with whitespace", () => {
      const result = weatherSpinner("  rainy  ");
      expect(result.spinner.frames).toEqual(LOADING_SPINNERS.rainy.frames);
    });

    test("returns ora-compatible options structure", () => {
      const result = weatherSpinner("sunny");
      expect(result).toHaveProperty("spinner");
      expect(result.spinner).toHaveProperty("frames");
      expect(result.spinner).toHaveProperty("interval");
    });
  });

  describe("revealAnimation", () => {
    let originalWrite: typeof process.stdout.write;
    let writtenOutput: string;

    beforeEach(() => {
      originalWrite = process.stdout.write;
      writtenOutput = "";
      process.stdout.write = ((chunk: string) => {
        writtenOutput += chunk;
        return true;
      }) as typeof process.stdout.write;
    });

    afterEach(() => {
      process.stdout.write = originalWrite;
    });

    test("falls back to immediate display when animations not supported", async () => {
      const mockSupportsAnimation = spyOn(terminal, "supportsAnimation").mockReturnValue(false);

      const theme: WeatherTheme = {
        primary: { r: 255, g: 0, b: 0 },
        secondary: { r: 0, g: 255, b: 0 },
        accent: { r: 0, g: 0, b: 255 },
        borderStyle: "soft",
      };

      await revealAnimation("Hello World", theme);

      expect(writtenOutput).toBe("Hello World\n");
      mockSupportsAnimation.mockRestore();
    });

    test("does nothing for empty content", async () => {
      const mockSupportsAnimation = spyOn(terminal, "supportsAnimation").mockReturnValue(true);

      const theme: WeatherTheme = {
        primary: { r: 255, g: 0, b: 0 },
        secondary: { r: 0, g: 255, b: 0 },
        accent: { r: 0, g: 0, b: 255 },
        borderStyle: "soft",
      };

      await revealAnimation("", theme);

      expect(writtenOutput).toBe("");
      mockSupportsAnimation.mockRestore();
    });

    test("writes content when animation is supported", async () => {
      const mockSupportsAnimation = spyOn(terminal, "supportsAnimation").mockReturnValue(true);

      const theme: WeatherTheme = {
        primary: { r: 255, g: 107, b: 53 },
        secondary: { r: 255, g: 200, b: 87 },
        accent: { r: 255, g: 234, b: 167 },
        borderStyle: "wavy",
      };

      await revealAnimation("Test", theme);

      expect(writtenOutput.length).toBeGreaterThan(0);
      expect(writtenOutput).toContain("Test");
      mockSupportsAnimation.mockRestore();
    });

    test("includes hide and show cursor sequences when animating", async () => {
      const mockSupportsAnimation = spyOn(terminal, "supportsAnimation").mockReturnValue(true);

      const theme: WeatherTheme = {
        primary: { r: 255, g: 0, b: 0 },
        secondary: { r: 0, g: 255, b: 0 },
        accent: { r: 0, g: 0, b: 255 },
        borderStyle: "soft",
      };

      await revealAnimation("X", theme);

      expect(writtenOutput).toContain("\x1b[?25l");
      expect(writtenOutput).toContain("\x1b[?25h");
      mockSupportsAnimation.mockRestore();
    });

    test("uses theme colors in output", async () => {
      const mockSupportsAnimation = spyOn(terminal, "supportsAnimation").mockReturnValue(true);

      const theme: WeatherTheme = {
        primary: { r: 100, g: 150, b: 200 },
        secondary: { r: 50, g: 100, b: 150 },
        accent: { r: 200, g: 220, b: 240 },
        borderStyle: "soft",
      };

      await revealAnimation("Colored", theme);

      expect(writtenOutput).toContain("\x1b[38;2;");
      mockSupportsAnimation.mockRestore();
    });

    test("handles multiline content", async () => {
      const mockSupportsAnimation = spyOn(terminal, "supportsAnimation").mockReturnValue(false);

      const theme: WeatherTheme = {
        primary: { r: 255, g: 0, b: 0 },
        secondary: { r: 0, g: 255, b: 0 },
        accent: { r: 0, g: 0, b: 255 },
        borderStyle: "soft",
      };

      await revealAnimation("Line 1\nLine 2\nLine 3", theme);

      expect(writtenOutput).toBe("Line 1\nLine 2\nLine 3\n");
      mockSupportsAnimation.mockRestore();
    });
  });

  describe("integration", () => {
    test("exports all required interfaces and functions", () => {
      expect(typeof weatherSpinner).toBe("function");
      expect(typeof revealAnimation).toBe("function");
      expect(LOADING_SPINNERS).toBeDefined();
      expect(typeof LOADING_SPINNERS).toBe("object");
    });

    test("weatherSpinner returns consistent structure", () => {
      const conditions = [
        "sunny",
        "rainy",
        "windy",
        "snowy",
        "stormy",
        "unknown",
      ];

      for (const condition of conditions) {
        const result = weatherSpinner(condition);
        expect(result).toHaveProperty("spinner");
        expect(result.spinner).toHaveProperty("frames");
        expect(result.spinner).toHaveProperty("interval");
        expect(Array.isArray(result.spinner.frames)).toBe(true);
        expect(typeof result.spinner.interval).toBe("number");
      }
    });
  });
});
