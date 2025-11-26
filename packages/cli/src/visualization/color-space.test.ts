/**
 * Tests for LAB Color Space Utilities
 */

import { describe, test, expect } from "bun:test";
import {
  rgbToLab,
  labToRgb,
  interpolateLab,
  type RGB,
  type LAB,
} from "./color-space";

describe("LAB Color Space Utilities", () => {
  describe("rgbToLab", () => {
    test("converts black correctly", () => {
      const rgb: RGB = { r: 0, g: 0, b: 0 };
      const lab = rgbToLab(rgb);

      expect(lab.l).toBeCloseTo(0, 0);
      expect(lab.a).toBeCloseTo(0, 0);
      expect(lab.b).toBeCloseTo(0, 0);
    });

    test("converts white correctly", () => {
      const rgb: RGB = { r: 255, g: 255, b: 255 };
      const lab = rgbToLab(rgb);

      expect(lab.l).toBeCloseTo(100, 0);
      expect(lab.a).toBeCloseTo(0, 0);
      expect(lab.b).toBeCloseTo(0, 0);
    });

    test("converts pure red correctly", () => {
      const rgb: RGB = { r: 255, g: 0, b: 0 };
      const lab = rgbToLab(rgb);

      // Red in LAB: L≈53.2, a≈80.1, b≈67.2
      expect(lab.l).toBeCloseTo(53.2, 0);
      expect(lab.a).toBeGreaterThan(50);
      expect(lab.b).toBeGreaterThan(50);
    });

    test("converts pure green correctly", () => {
      const rgb: RGB = { r: 0, g: 255, b: 0 };
      const lab = rgbToLab(rgb);

      // Green in LAB: L≈87.7, a≈-86.2, b≈83.2
      expect(lab.l).toBeCloseTo(87.7, 0);
      expect(lab.a).toBeLessThan(-50);
      expect(lab.b).toBeGreaterThan(50);
    });

    test("converts pure blue correctly", () => {
      const rgb: RGB = { r: 0, g: 0, b: 255 };
      const lab = rgbToLab(rgb);

      // Blue in LAB: L≈32.3, a≈79.2, b≈-107.9
      expect(lab.l).toBeCloseTo(32.3, 0);
      expect(lab.a).toBeGreaterThan(50);
      expect(lab.b).toBeLessThan(-50);
    });

    test("converts gray correctly", () => {
      const rgb: RGB = { r: 128, g: 128, b: 128 };
      const lab = rgbToLab(rgb);

      // Gray should have a≈0 and b≈0 (achromatic)
      expect(lab.l).toBeGreaterThan(0);
      expect(lab.l).toBeLessThan(100);
      expect(Math.abs(lab.a)).toBeLessThan(1);
      expect(Math.abs(lab.b)).toBeLessThan(1);
    });
  });

  describe("labToRgb", () => {
    test("converts LAB black to RGB black", () => {
      const lab: LAB = { l: 0, a: 0, b: 0 };
      const rgb = labToRgb(lab);

      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    test("converts LAB white to RGB white", () => {
      const lab: LAB = { l: 100, a: 0, b: 0 };
      const rgb = labToRgb(lab);

      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(255);
    });

    test("clamps out-of-gamut colors", () => {
      // LAB color outside sRGB gamut
      const lab: LAB = { l: 50, a: 100, b: 100 };
      const rgb = labToRgb(lab);

      // All values should be within [0, 255]
      expect(rgb.r).toBeGreaterThanOrEqual(0);
      expect(rgb.r).toBeLessThanOrEqual(255);
      expect(rgb.g).toBeGreaterThanOrEqual(0);
      expect(rgb.g).toBeLessThanOrEqual(255);
      expect(rgb.b).toBeGreaterThanOrEqual(0);
      expect(rgb.b).toBeLessThanOrEqual(255);
    });

    test("returns integer RGB values", () => {
      const lab: LAB = { l: 50, a: 25, b: -25 };
      const rgb = labToRgb(lab);

      expect(Number.isInteger(rgb.r)).toBe(true);
      expect(Number.isInteger(rgb.g)).toBe(true);
      expect(Number.isInteger(rgb.b)).toBe(true);
    });
  });

  describe("round-trip conversion", () => {
    test("RGB -> LAB -> RGB preserves values for in-gamut colors", () => {
      const original: RGB = { r: 128, g: 64, b: 192 };
      const lab = rgbToLab(original);
      const result = labToRgb(lab);

      // Allow for small rounding differences
      expect(result.r).toBeCloseTo(original.r, 0);
      expect(result.g).toBeCloseTo(original.g, 0);
      expect(result.b).toBeCloseTo(original.b, 0);
    });

    test("preserves primary colors through round-trip", () => {
      const colors: RGB[] = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
      ];

      for (const original of colors) {
        const lab = rgbToLab(original);
        const result = labToRgb(lab);

        expect(result.r).toBeCloseTo(original.r, 0);
        expect(result.g).toBeCloseTo(original.g, 0);
        expect(result.b).toBeCloseTo(original.b, 0);
      }
    });

    test("preserves grayscale through round-trip", () => {
      const grays: RGB[] = [
        { r: 0, g: 0, b: 0 },
        { r: 64, g: 64, b: 64 },
        { r: 128, g: 128, b: 128 },
        { r: 192, g: 192, b: 192 },
        { r: 255, g: 255, b: 255 },
      ];

      for (const original of grays) {
        const lab = rgbToLab(original);
        const result = labToRgb(lab);

        expect(result.r).toBeCloseTo(original.r, 0);
        expect(result.g).toBeCloseTo(original.g, 0);
        expect(result.b).toBeCloseTo(original.b, 0);
      }
    });
  });

  describe("interpolateLab", () => {
    test("returns first color at t=0", () => {
      const lab1: LAB = { l: 0, a: 50, b: -50 };
      const lab2: LAB = { l: 100, a: -50, b: 50 };
      const result = interpolateLab(lab1, lab2, 0);

      expect(result.l).toBe(lab1.l);
      expect(result.a).toBe(lab1.a);
      expect(result.b).toBe(lab1.b);
    });

    test("returns second color at t=1", () => {
      const lab1: LAB = { l: 0, a: 50, b: -50 };
      const lab2: LAB = { l: 100, a: -50, b: 50 };
      const result = interpolateLab(lab1, lab2, 1);

      expect(result.l).toBe(lab2.l);
      expect(result.a).toBe(lab2.a);
      expect(result.b).toBe(lab2.b);
    });

    test("returns midpoint at t=0.5", () => {
      const lab1: LAB = { l: 0, a: 100, b: -100 };
      const lab2: LAB = { l: 100, a: -100, b: 100 };
      const result = interpolateLab(lab1, lab2, 0.5);

      expect(result.l).toBe(50);
      expect(result.a).toBe(0);
      expect(result.b).toBe(0);
    });

    test("interpolates all components linearly", () => {
      const lab1: LAB = { l: 20, a: 40, b: 60 };
      const lab2: LAB = { l: 80, a: -20, b: -40 };
      const result = interpolateLab(lab1, lab2, 0.25);

      expect(result.l).toBeCloseTo(35);
      expect(result.a).toBeCloseTo(25);
      expect(result.b).toBeCloseTo(35);
    });

    test("handles negative t values", () => {
      const lab1: LAB = { l: 50, a: 0, b: 0 };
      const lab2: LAB = { l: 100, a: 50, b: 50 };
      const result = interpolateLab(lab1, lab2, -0.5);

      // Extrapolates below lab1
      expect(result.l).toBe(25);
      expect(result.a).toBe(-25);
      expect(result.b).toBe(-25);
    });

    test("handles t values greater than 1", () => {
      const lab1: LAB = { l: 50, a: 0, b: 0 };
      const lab2: LAB = { l: 100, a: 50, b: 50 };
      const result = interpolateLab(lab1, lab2, 1.5);

      // Extrapolates beyond lab2
      expect(result.l).toBe(125);
      expect(result.a).toBe(75);
      expect(result.b).toBe(75);
    });
  });

  describe("perceptual uniformity", () => {
    test("LAB interpolation avoids muddy greens between red and green", () => {
      const red: RGB = { r: 255, g: 0, b: 0 };
      const green: RGB = { r: 0, g: 255, b: 0 };

      const redLab = rgbToLab(red);
      const greenLab = rgbToLab(green);

      // Get midpoint in LAB
      const midLab = interpolateLab(redLab, greenLab, 0.5);
      const midRgb = labToRgb(midLab);

      // RGB midpoint would be (127, 127, 0) - a muddy olive/brown
      // LAB midpoint should be more vibrant with higher saturation
      // The key difference: LAB preserves perceptual lightness

      // LAB midpoint should have reasonable lightness (not dark muddy)
      expect(midLab.l).toBeGreaterThan(60);

      // The resulting color should not be the muddy olive of RGB interpolation
      // RGB interpolation gives approximately (127, 127, 0)
      // LAB should give a more saturated, less muddy result
      expect(midRgb.r + midRgb.g + midRgb.b).toBeGreaterThan(127 + 127);
    });

    test("generates smooth gradient between colors", () => {
      const blue: RGB = { r: 0, g: 0, b: 255 };
      const yellow: RGB = { r: 255, g: 255, b: 0 };

      const blueLab = rgbToLab(blue);
      const yellowLab = rgbToLab(yellow);

      // Generate 5 steps of gradient
      const steps: LAB[] = [];
      for (let i = 0; i <= 4; i++) {
        steps.push(interpolateLab(blueLab, yellowLab, i / 4));
      }

      // Check that lightness increases monotonically (blue is dark, yellow is light)
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].l).toBeGreaterThan(steps[i - 1].l);
      }
    });
  });
});
