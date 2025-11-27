/**
 * Tests for Weather Mood Theming
 */

import { describe, test, expect } from "bun:test";
import {
  MOOD_THEMES,
  getThemeForConditions,
  getBorderChars,
  type WeatherTheme,
  type BorderStyle,
  type BoxChars,
} from "./themes";

describe("Weather Mood Theming", () => {
  describe("MOOD_THEMES", () => {
    test("contains all required themes", () => {
      expect(MOOD_THEMES.sunny).toBeDefined();
      expect(MOOD_THEMES.rainy).toBeDefined();
      expect(MOOD_THEMES.stormy).toBeDefined();
      expect(MOOD_THEMES.snowy).toBeDefined();
      expect(MOOD_THEMES.serene).toBeDefined();
      expect(MOOD_THEMES.sunset).toBeDefined();
    });

    test("each theme has valid RGB colors", () => {
      const themes = Object.values(MOOD_THEMES);
      for (const theme of themes) {
        // Check primary
        expect(theme.primary.r).toBeGreaterThanOrEqual(0);
        expect(theme.primary.r).toBeLessThanOrEqual(255);
        expect(theme.primary.g).toBeGreaterThanOrEqual(0);
        expect(theme.primary.g).toBeLessThanOrEqual(255);
        expect(theme.primary.b).toBeGreaterThanOrEqual(0);
        expect(theme.primary.b).toBeLessThanOrEqual(255);

        // Check secondary
        expect(theme.secondary.r).toBeGreaterThanOrEqual(0);
        expect(theme.secondary.r).toBeLessThanOrEqual(255);
        expect(theme.secondary.g).toBeGreaterThanOrEqual(0);
        expect(theme.secondary.g).toBeLessThanOrEqual(255);
        expect(theme.secondary.b).toBeGreaterThanOrEqual(0);
        expect(theme.secondary.b).toBeLessThanOrEqual(255);

        // Check accent
        expect(theme.accent.r).toBeGreaterThanOrEqual(0);
        expect(theme.accent.r).toBeLessThanOrEqual(255);
        expect(theme.accent.g).toBeGreaterThanOrEqual(0);
        expect(theme.accent.g).toBeLessThanOrEqual(255);
        expect(theme.accent.b).toBeGreaterThanOrEqual(0);
        expect(theme.accent.b).toBeLessThanOrEqual(255);
      }
    });

    test("each theme has a valid border style", () => {
      const validStyles: BorderStyle[] = ["wavy", "jagged", "soft", "standard"];
      const themes = Object.values(MOOD_THEMES);
      for (const theme of themes) {
        expect(validStyles).toContain(theme.borderStyle);
      }
    });

    test("sunny theme has warm amber primary color", () => {
      const sunny = MOOD_THEMES.sunny;
      // #FF6B35 = rgb(255, 107, 53)
      expect(sunny.primary.r).toBe(255);
      expect(sunny.primary.g).toBe(107);
      expect(sunny.primary.b).toBe(53);
      expect(sunny.borderStyle).toBe("wavy");
    });

    test("rainy theme has blue-gray tones", () => {
      const rainy = MOOD_THEMES.rainy;
      // Blue-gray should have more blue than red
      expect(rainy.primary.b).toBeGreaterThan(rainy.primary.r);
      expect(rainy.borderStyle).toBe("soft");
    });

    test("stormy theme has dramatic charcoal with electric accent", () => {
      const stormy = MOOD_THEMES.stormy;
      // Primary should be dark (charcoal)
      expect(stormy.primary.r).toBeLessThan(100);
      expect(stormy.primary.g).toBeLessThan(100);
      expect(stormy.primary.b).toBeLessThan(100);
      // Accent should be bright yellow
      expect(stormy.accent.r).toBeGreaterThan(200);
      expect(stormy.accent.g).toBeGreaterThan(200);
      expect(stormy.borderStyle).toBe("jagged");
    });

    test("snowy theme has cool moonlight blue/lavender", () => {
      const snowy = MOOD_THEMES.snowy;
      // Should be light (high values)
      expect(snowy.primary.r).toBeGreaterThan(150);
      expect(snowy.primary.g).toBeGreaterThan(150);
      expect(snowy.primary.b).toBeGreaterThan(150);
      expect(snowy.borderStyle).toBe("soft");
    });
  });

  describe("getThemeForConditions", () => {
    describe("WMO weather code mapping", () => {
      test("returns sunny theme for clear sky (code 0)", () => {
        const theme = getThemeForConditions(0, 12);
        expect(theme.primary).toEqual(MOOD_THEMES.sunny.primary);
        expect(theme.borderStyle).toBe("wavy");
      });

      test("returns serene theme for partly cloudy (codes 1-3)", () => {
        for (const code of [1, 2, 3]) {
          const theme = getThemeForConditions(code, 12);
          expect(theme.primary).toEqual(MOOD_THEMES.serene.primary);
        }
      });

      test("returns rainy theme for rain codes", () => {
        const rainCodes = [61, 63, 65, 80, 81];
        for (const code of rainCodes) {
          const theme = getThemeForConditions(code, 12);
          expect(theme.primary).toEqual(MOOD_THEMES.rainy.primary);
          expect(theme.borderStyle).toBe("soft");
        }
      });

      test("returns stormy theme for thunderstorm codes", () => {
        const stormCodes = [82, 95, 96, 99];
        for (const code of stormCodes) {
          const theme = getThemeForConditions(code, 12);
          expect(theme.primary).toEqual(MOOD_THEMES.stormy.primary);
          expect(theme.borderStyle).toBe("jagged");
        }
      });

      test("returns snowy theme for snow codes", () => {
        const snowCodes = [71, 73, 75, 77, 85, 86];
        for (const code of snowCodes) {
          const theme = getThemeForConditions(code, 12);
          expect(theme.primary).toEqual(MOOD_THEMES.snowy.primary);
        }
      });

      test("returns rainy theme for fog codes", () => {
        const fogCodes = [45, 48];
        for (const code of fogCodes) {
          const theme = getThemeForConditions(code, 12);
          expect(theme.primary).toEqual(MOOD_THEMES.rainy.primary);
        }
      });

      test("returns rainy theme for drizzle codes", () => {
        const drizzleCodes = [51, 53, 55, 56, 57];
        for (const code of drizzleCodes) {
          const theme = getThemeForConditions(code, 12);
          expect(theme.primary).toEqual(MOOD_THEMES.rainy.primary);
        }
      });
    });

    describe("sunset/sunrise detection", () => {
      test("returns sunset theme during sunrise hours (5-7) for clear weather", () => {
        for (const hour of [5, 6, 7]) {
          const theme = getThemeForConditions(0, hour);
          expect(theme.primary).toEqual(MOOD_THEMES.sunset.primary);
        }
      });

      test("returns sunset theme during sunset hours (17-20) for clear weather", () => {
        for (const hour of [17, 18, 19, 20]) {
          const theme = getThemeForConditions(0, hour);
          expect(theme.primary).toEqual(MOOD_THEMES.sunset.primary);
        }
      });

      test("returns sunset theme during sunrise for serene weather", () => {
        const theme = getThemeForConditions(1, 6);
        expect(theme.primary).toEqual(MOOD_THEMES.sunset.primary);
      });

      test("does not override stormy weather during sunset", () => {
        const theme = getThemeForConditions(95, 18);
        expect(theme.primary).toEqual(MOOD_THEMES.stormy.primary);
      });

      test("does not override rainy weather during sunrise", () => {
        const theme = getThemeForConditions(61, 6);
        expect(theme.primary).toEqual(MOOD_THEMES.rainy.primary);
      });

      test("does not override snowy weather during sunset", () => {
        const theme = getThemeForConditions(71, 19);
        expect(theme.primary).toEqual(MOOD_THEMES.snowy.primary);
      });

      test("returns sunny theme outside sunrise/sunset hours", () => {
        const nonGoldenHours = [0, 4, 8, 12, 16, 21, 23];
        for (const hour of nonGoldenHours) {
          const theme = getThemeForConditions(0, hour);
          expect(theme.primary).toEqual(MOOD_THEMES.sunny.primary);
        }
      });
    });

    describe("edge cases", () => {
      test("returns serene theme for unknown weather codes", () => {
        const theme = getThemeForConditions(999, 12);
        expect(theme.primary).toEqual(MOOD_THEMES.serene.primary);
      });

      test("returns sunset theme for unknown codes during sunset", () => {
        const theme = getThemeForConditions(999, 18);
        expect(theme.primary).toEqual(MOOD_THEMES.sunset.primary);
      });

      test("returns new object instance (not reference)", () => {
        const theme1 = getThemeForConditions(0, 12);
        const theme2 = getThemeForConditions(0, 12);
        expect(theme1).not.toBe(theme2);
        expect(theme1).toEqual(theme2);
      });

      test("handles hour boundary at 0", () => {
        const theme = getThemeForConditions(0, 0);
        expect(theme.primary).toEqual(MOOD_THEMES.sunny.primary);
      });

      test("handles hour boundary at 23", () => {
        const theme = getThemeForConditions(0, 23);
        expect(theme.primary).toEqual(MOOD_THEMES.sunny.primary);
      });
    });
  });

  describe("getBorderChars", () => {
    test("returns valid BoxChars for standard style", () => {
      const chars = getBorderChars("standard");
      expect(chars.topLeft).toBe("┌");
      expect(chars.topRight).toBe("┐");
      expect(chars.bottomLeft).toBe("└");
      expect(chars.bottomRight).toBe("┘");
      expect(chars.horizontal).toBe("─");
      expect(chars.vertical).toBe("│");
    });

    test("returns soft rounded corners for soft style", () => {
      const chars = getBorderChars("soft");
      expect(chars.topLeft).toBe("╭");
      expect(chars.topRight).toBe("╮");
      expect(chars.bottomLeft).toBe("╰");
      expect(chars.bottomRight).toBe("╯");
    });

    test("returns wavy characters for wavy style", () => {
      const chars = getBorderChars("wavy");
      expect(chars.horizontal).toBe("∿");
      expect(chars.vertical).toBe("┊");
      // Wavy uses soft corners
      expect(chars.topLeft).toBe("╭");
    });

    test("returns jagged characters for jagged style", () => {
      const chars = getBorderChars("jagged");
      expect(chars.horizontal).toBe("⌇");
      expect(chars.vertical).toBe("⌇");
      // Jagged uses heavy corners
      expect(chars.topLeft).toBe("┏");
      expect(chars.topRight).toBe("┓");
      expect(chars.bottomLeft).toBe("┗");
      expect(chars.bottomRight).toBe("┛");
    });

    test("returns new object instance (not reference)", () => {
      const chars1 = getBorderChars("standard");
      const chars2 = getBorderChars("standard");
      expect(chars1).not.toBe(chars2);
      expect(chars1).toEqual(chars2);
    });

    test("all styles have complete BoxChars", () => {
      const styles: BorderStyle[] = ["wavy", "jagged", "soft", "standard"];
      for (const style of styles) {
        const chars = getBorderChars(style);
        expect(chars.topLeft).toBeDefined();
        expect(chars.topRight).toBeDefined();
        expect(chars.bottomLeft).toBeDefined();
        expect(chars.bottomRight).toBeDefined();
        expect(chars.horizontal).toBeDefined();
        expect(chars.vertical).toBeDefined();
        // Each should be a non-empty string
        expect(chars.topLeft.length).toBeGreaterThan(0);
        expect(chars.horizontal.length).toBeGreaterThan(0);
      }
    });
  });

  describe("type exports", () => {
    test("WeatherTheme interface is properly typed", () => {
      const theme: WeatherTheme = {
        primary: { r: 0, g: 0, b: 0 },
        secondary: { r: 128, g: 128, b: 128 },
        accent: { r: 255, g: 255, b: 255 },
        borderStyle: "standard",
      };
      expect(theme.primary.r).toBe(0);
      expect(theme.borderStyle).toBe("standard");
    });

    test("BorderStyle accepts all valid values", () => {
      const styles: BorderStyle[] = ["wavy", "jagged", "soft", "standard"];
      expect(styles.length).toBe(4);
    });

    test("BoxChars has all required properties", () => {
      const chars: BoxChars = {
        topLeft: "A",
        topRight: "B",
        bottomLeft: "C",
        bottomRight: "D",
        horizontal: "E",
        vertical: "F",
      };
      expect(Object.keys(chars).length).toBe(6);
    });
  });

  describe("color psychology validation", () => {
    test("sunny theme evokes warmth with red/orange hues", () => {
      const sunny = MOOD_THEMES.sunny;
      // Red component should be dominant in primary
      expect(sunny.primary.r).toBeGreaterThan(sunny.primary.g);
      expect(sunny.primary.r).toBeGreaterThan(sunny.primary.b);
    });

    test("rainy theme uses cooler blue tones", () => {
      const rainy = MOOD_THEMES.rainy;
      // Blue should be significant
      expect(rainy.primary.b).toBeGreaterThan(rainy.primary.r);
    });

    test("stormy theme is dark with high-contrast accent", () => {
      const stormy = MOOD_THEMES.stormy;
      // Primary luminance approximation (dark)
      const primaryLum =
        0.299 * stormy.primary.r +
        0.587 * stormy.primary.g +
        0.114 * stormy.primary.b;
      // Accent luminance (bright)
      const accentLum =
        0.299 * stormy.accent.r +
        0.587 * stormy.accent.g +
        0.114 * stormy.accent.b;

      expect(primaryLum).toBeLessThan(100);
      expect(accentLum).toBeGreaterThan(200);
    });

    test("snowy theme is light and serene", () => {
      const snowy = MOOD_THEMES.snowy;
      // All components should be fairly high (light colors)
      const avgPrimary = (snowy.primary.r + snowy.primary.g + snowy.primary.b) / 3;
      expect(avgPrimary).toBeGreaterThan(180);
    });

    test("sunset theme has warm red/orange gradient feel", () => {
      const sunset = MOOD_THEMES.sunset;
      // Primary should be warm (high red)
      expect(sunset.primary.r).toBeGreaterThan(200);
      // Secondary should also be warm (orange)
      expect(sunset.secondary.r).toBeGreaterThan(200);
      expect(sunset.secondary.g).toBeGreaterThan(100);
    });
  });
});
