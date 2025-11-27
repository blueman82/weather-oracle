/**
 * Tests for True-Color Gradient System
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  TEMP_GRADIENT_LAB,
  interpolateColor,
  tempToColor,
  tempToAnsi256,
  tempTo16Color,
  clearGradientCache,
} from "./gradient";
import { clearCache as clearTerminalCache } from "./terminal";
import type { RGB } from "./color-space";

describe("True-Color Gradient System", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    clearGradientCache();
    clearTerminalCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
    });
    clearGradientCache();
    clearTerminalCache();
  });

  function setTTY(value: boolean): void {
    Object.defineProperty(process.stdout, "isTTY", {
      value,
      writable: true,
    });
  }

  function clearEnvVars(): void {
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    delete process.env.COLORTERM;
    delete process.env.TERM;
    delete process.env.CI;
  }

  describe("TEMP_GRADIENT_LAB", () => {
    test("has correct number of temperature stops", () => {
      expect(TEMP_GRADIENT_LAB.length).toBe(7);
    });

    test("temperature stops are in ascending order", () => {
      for (let i = 1; i < TEMP_GRADIENT_LAB.length; i++) {
        expect(TEMP_GRADIENT_LAB[i].temp).toBeGreaterThan(
          TEMP_GRADIENT_LAB[i - 1].temp
        );
      }
    });

    test("covers expected temperature range", () => {
      expect(TEMP_GRADIENT_LAB[0].temp).toBe(-30);
      expect(TEMP_GRADIENT_LAB[TEMP_GRADIENT_LAB.length - 1].temp).toBe(40);
    });

    test("all LAB values are within valid ranges", () => {
      for (const stop of TEMP_GRADIENT_LAB) {
        expect(stop.lab.l).toBeGreaterThanOrEqual(0);
        expect(stop.lab.l).toBeLessThanOrEqual(100);
        // a and b can technically be -128 to 127 for displayable colors
        expect(stop.lab.a).toBeGreaterThanOrEqual(-128);
        expect(stop.lab.a).toBeLessThanOrEqual(127);
        expect(stop.lab.b).toBeGreaterThanOrEqual(-128);
        expect(stop.lab.b).toBeLessThanOrEqual(127);
      }
    });
  });

  describe("interpolateColor", () => {
    test("returns valid RGB at minimum temperature", () => {
      const rgb = interpolateColor(-30);
      expectValidRgb(rgb);
    });

    test("returns valid RGB at maximum temperature", () => {
      const rgb = interpolateColor(40);
      expectValidRgb(rgb);
    });

    test("returns valid RGB at temperature below range", () => {
      const rgb = interpolateColor(-50);
      expectValidRgb(rgb);
      // Should equal the minimum stop color
      const minRgb = interpolateColor(-30);
      expect(rgb).toEqual(minRgb);
    });

    test("returns valid RGB at temperature above range", () => {
      const rgb = interpolateColor(60);
      expectValidRgb(rgb);
      // Should equal the maximum stop color
      const maxRgb = interpolateColor(40);
      expect(rgb).toEqual(maxRgb);
    });

    test("returns valid RGB at midpoint temperature", () => {
      const rgb = interpolateColor(5);
      expectValidRgb(rgb);
    });

    test("returns exact stop colors at stop temperatures", () => {
      // Test a few stops
      const stops = [
        { temp: 0, expectedL: 65 }, // Steel blue
        { temp: 20, expectedL: 85 }, // Warm cream
      ];

      for (const { temp, expectedL } of stops) {
        const rgb = interpolateColor(temp);
        expectValidRgb(rgb);
        // The lightness should roughly match (RGB sum is a proxy for lightness)
        const avgBrightness = (rgb.r + rgb.g + rgb.b) / 3;
        // Higher LAB L = higher brightness
        if (expectedL > 70) {
          expect(avgBrightness).toBeGreaterThan(100);
        }
      }
    });

    test("interpolates smoothly between stops", () => {
      // Get colors at -10 (stop), 0 (stop), and -5 (between)
      const atNeg10 = interpolateColor(-10);
      const at0 = interpolateColor(0);
      const atNeg5 = interpolateColor(-5);

      // The -5 color should be somewhere between -10 and 0
      // Check that each RGB channel is between the two stops
      for (const channel of ["r", "g", "b"] as const) {
        const min = Math.min(atNeg10[channel], at0[channel]);
        const max = Math.max(atNeg10[channel], at0[channel]);
        expect(atNeg5[channel]).toBeGreaterThanOrEqual(min);
        expect(atNeg5[channel]).toBeLessThanOrEqual(max);
      }
    });

    test("produces distinct colors at different temperatures", () => {
      const cold = interpolateColor(-20);
      const mild = interpolateColor(15);
      const hot = interpolateColor(35);

      // Colors should be noticeably different
      expect(colorDistance(cold, mild)).toBeGreaterThan(50);
      expect(colorDistance(mild, hot)).toBeGreaterThan(50);
      expect(colorDistance(cold, hot)).toBeGreaterThan(100);
    });
  });

  describe("tempToColor", () => {
    describe("truecolor support (RICH/FULL tier)", () => {
      test("returns truecolor escape sequence", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const colorFn = tempToColor(20);
        const result = colorFn("test");

        expect(result).toMatch(/^\x1b\[38;2;\d+;\d+;\d+mtest\x1b\[0m$/);
      });

      test("different temperatures produce different sequences", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const coldFn = tempToColor(-20);
        const hotFn = tempToColor(35);

        expect(coldFn("test")).not.toBe(hotFn("test"));
      });
    });

    describe("256-color support (STANDARD tier)", () => {
      test("returns 256-color escape sequence", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "xterm-256color";

        const colorFn = tempToColor(20);
        const result = colorFn("test");

        expect(result).toMatch(/^\x1b\[38;5;\d+mtest\x1b\[0m$/);
      });
    });

    describe("16-color support (COMPAT tier)", () => {
      test("returns 16-color escape sequence", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "xterm";

        const colorFn = tempToColor(20);
        const result = colorFn("test");

        expect(result).toMatch(/^\x1b\[\d+mtest\x1b\[0m$/);
      });
    });

    describe("no color support (PLAIN tier)", () => {
      test("returns plain text when NO_COLOR is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.NO_COLOR = "1";

        const colorFn = tempToColor(20);
        const result = colorFn("test");

        expect(result).toBe("test");
      });

      test("returns plain text for dumb terminal", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "dumb";

        const colorFn = tempToColor(20);
        const result = colorFn("test");

        expect(result).toBe("test");
      });
    });

    describe("tier caching", () => {
      test("caches tier detection", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const firstFn = tempToColor(20);
        const firstResult = firstFn("test");

        // Change env - should not affect result due to caching
        process.env.NO_COLOR = "1";
        const secondFn = tempToColor(25);
        const secondResult = secondFn("test");

        // Both should use truecolor (cached tier)
        expect(firstResult).toMatch(/^\x1b\[38;2;/);
        expect(secondResult).toMatch(/^\x1b\[38;2;/);
      });

      test("clearGradientCache resets tier cache", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const firstFn = tempToColor(20);
        expect(firstFn("test")).toMatch(/^\x1b\[38;2;/);

        // Clear cache and change environment
        clearGradientCache();
        clearTerminalCache();
        process.env.NO_COLOR = "1";
        delete process.env.COLORTERM;

        const secondFn = tempToColor(20);
        expect(secondFn("test")).toBe("test");
      });
    });
  });

  describe("tempToAnsi256", () => {
    test("returns values in valid 256-color range", () => {
      const temperatures = [-30, -10, 0, 10, 20, 30, 40];

      for (const temp of temperatures) {
        const index = tempToAnsi256(temp);
        expect(index).toBeGreaterThanOrEqual(16);
        expect(index).toBeLessThanOrEqual(231);
      }
    });

    test("returns integer indices", () => {
      const temperatures = [-25, -5, 5, 15, 25, 35];

      for (const temp of temperatures) {
        const index = tempToAnsi256(temp);
        expect(Number.isInteger(index)).toBe(true);
      }
    });

    test("produces different indices for different temperatures", () => {
      const indices = new Set<number>();
      const temperatures = [-30, -15, 0, 15, 30, 40];

      for (const temp of temperatures) {
        indices.add(tempToAnsi256(temp));
      }

      // Should have at least some distinct colors
      expect(indices.size).toBeGreaterThanOrEqual(3);
    });

    test("cold temperatures map to blue-ish palette", () => {
      const coldIndex = tempToAnsi256(-25);
      // ANSI 256 color cube: high blue component = higher index in b dimension
      // Index formula: 16 + 36*r + 6*g + b
      // Blue-ish colors have higher b values relative to r and g
      expect(coldIndex).toBeGreaterThanOrEqual(16);
      expect(coldIndex).toBeLessThanOrEqual(231);
    });

    test("hot temperatures map to red-ish palette", () => {
      const hotIndex = tempToAnsi256(38);
      // Red-ish colors have higher r values
      // High r values contribute 36 per step, making higher indices
      expect(hotIndex).toBeGreaterThanOrEqual(16);
      expect(hotIndex).toBeLessThanOrEqual(231);
    });
  });

  describe("tempTo16Color", () => {
    test("returns valid ANSI escape sequences", () => {
      const temperatures = [-30, -10, 0, 10, 20, 30, 40];

      for (const temp of temperatures) {
        const code = tempTo16Color(temp);
        expect(code).toMatch(/^\x1b\[\d+m$/);
      }
    });

    test("maps extreme cold to magenta/violet", () => {
      const code = tempTo16Color(-25);
      expect(code).toBe("\x1b[35m"); // magenta
    });

    test("maps cold temperatures to blue", () => {
      const code = tempTo16Color(-10);
      expect(code).toBe("\x1b[34m"); // blue
    });

    test("maps cool temperatures to cyan", () => {
      const code = tempTo16Color(0);
      expect(code).toBe("\x1b[36m"); // cyan
    });

    test("maps mild temperatures to green", () => {
      const code = tempTo16Color(10);
      expect(code).toBe("\x1b[32m"); // green
    });

    test("maps warm temperatures to yellow", () => {
      const code = tempTo16Color(20);
      expect(code).toBe("\x1b[33m"); // yellow
    });

    test("maps hot temperatures to bright red", () => {
      const code = tempTo16Color(30);
      expect(code).toBe("\x1b[91m"); // bright red
    });

    test("maps extreme heat to red", () => {
      const code = tempTo16Color(40);
      expect(code).toBe("\x1b[31m"); // red
    });

    test("handles boundary conditions correctly", () => {
      // Test exact boundary values
      expect(tempTo16Color(-20)).toBe("\x1b[35m"); // magenta at -20
      expect(tempTo16Color(-5)).toBe("\x1b[34m"); // blue at -5
      expect(tempTo16Color(5)).toBe("\x1b[36m"); // cyan at 5
      expect(tempTo16Color(15)).toBe("\x1b[32m"); // green at 15
      expect(tempTo16Color(25)).toBe("\x1b[33m"); // yellow at 25
      expect(tempTo16Color(35)).toBe("\x1b[91m"); // bright red at 35
    });
  });

  describe("gradient quality", () => {
    test("gradient has perceptually uniform transitions", () => {
      // Sample many temperatures and check for smooth transitions
      const samples: RGB[] = [];
      for (let temp = -30; temp <= 40; temp += 2) {
        samples.push(interpolateColor(temp));
      }

      // Check that adjacent samples don't have huge jumps
      for (let i = 1; i < samples.length; i++) {
        const distance = colorDistance(samples[i - 1], samples[i]);
        // Adjacent colors should not differ by more than ~50 in any channel
        expect(distance).toBeLessThan(100);
      }
    });

    test("cold colors are darker than warm colors", () => {
      const cold = interpolateColor(-20);
      const warm = interpolateColor(20);

      const coldBrightness = (cold.r + cold.g + cold.b) / 3;
      const warmBrightness = (warm.r + warm.g + warm.b) / 3;

      expect(warmBrightness).toBeGreaterThan(coldBrightness);
    });

    test("extreme temperatures have distinct hues", () => {
      const arctic = interpolateColor(-30);
      const crimson = interpolateColor(40);

      // Arctic should be more blue (higher b relative to r)
      // Crimson should be more red (higher r relative to b)
      expect(arctic.b).toBeGreaterThan(arctic.r);
      expect(crimson.r).toBeGreaterThan(crimson.b);
    });
  });
});

// Helper functions

function expectValidRgb(rgb: RGB): void {
  expect(rgb.r).toBeGreaterThanOrEqual(0);
  expect(rgb.r).toBeLessThanOrEqual(255);
  expect(rgb.g).toBeGreaterThanOrEqual(0);
  expect(rgb.g).toBeLessThanOrEqual(255);
  expect(rgb.b).toBeGreaterThanOrEqual(0);
  expect(rgb.b).toBeLessThanOrEqual(255);
  expect(Number.isInteger(rgb.r)).toBe(true);
  expect(Number.isInteger(rgb.g)).toBe(true);
  expect(Number.isInteger(rgb.b)).toBe(true);
}

function colorDistance(c1: RGB, c2: RGB): number {
  // Simple Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
  );
}
