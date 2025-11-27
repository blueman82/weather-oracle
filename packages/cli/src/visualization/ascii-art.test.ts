/**
 * Tests for ASCII Weather Art
 */

import { describe, test, expect } from "bun:test";
import {
  WEATHER_ART,
  renderWeatherIcon,
  getCompactIcon,
} from "./ascii-art";
import { getThemeForConditions, type WeatherTheme } from "./themes";

describe("ASCII Weather Art", () => {
  describe("WEATHER_ART constant", () => {
    test("contains all required weather conditions", () => {
      expect(WEATHER_ART.clear).toBeDefined();
      expect(WEATHER_ART.partlyCloudy).toBeDefined();
      expect(WEATHER_ART.cloudy).toBeDefined();
      expect(WEATHER_ART.rain).toBeDefined();
      expect(WEATHER_ART.heavyRain).toBeDefined();
      expect(WEATHER_ART.snow).toBeDefined();
      expect(WEATHER_ART.thunderstorm).toBeDefined();
      expect(WEATHER_ART.fog).toBeDefined();
    });

    test("each art has valid dimensions", () => {
      for (const [_key, art] of Object.entries(WEATHER_ART)) {
        expect(art.lines).toBeInstanceOf(Array);
        expect(art.lines.length).toBe(art.height);
        expect(art.width).toBeGreaterThan(0);
        expect(art.height).toBeGreaterThan(0);
      }
    });

    test("each art has consistent line count", () => {
      for (const [_key, art] of Object.entries(WEATHER_ART)) {
        expect(art.lines.length).toBe(5);
      }
    });

    test("clear sky has sun rays", () => {
      const clear = WEATHER_ART.clear;
      const combined = clear.lines.join("");
      expect(combined).toContain("\\");
      expect(combined).toContain("/");
      expect(combined).toContain("|");
    });

    test("cloudy has block density characters", () => {
      const cloudy = WEATHER_ART.cloudy;
      const combined = cloudy.lines.join("");
      expect(combined).toMatch(/[▁▂▃▄▅▆▇█]/);
    });

    test("rain has falling rain characters", () => {
      const rain = WEATHER_ART.rain;
      const combined = rain.lines.join("");
      expect(combined).toContain("╱");
    });

    test("snow has snowflake characters", () => {
      const snow = WEATHER_ART.snow;
      const combined = snow.lines.join("");
      expect(combined).toMatch(/[❄❅❆]/);
    });

    test("thunderstorm has lightning bolt", () => {
      const storm = WEATHER_ART.thunderstorm;
      const combined = storm.lines.join("");
      expect(combined).toContain("⚡");
    });

    test("fog has horizontal line patterns", () => {
      const fog = WEATHER_ART.fog;
      const combined = fog.lines.join("");
      expect(combined).toMatch(/[═─]/);
    });

    test("heavyRain has thicker rain lines", () => {
      const heavy = WEATHER_ART.heavyRain;
      const combined = heavy.lines.join("");
      expect(combined).toContain("┃");
    });

    test("partlyCloudy has both sun and cloud elements", () => {
      const partly = WEATHER_ART.partlyCloudy;
      const combined = partly.lines.join("");
      expect(combined).toMatch(/[▄▅▆▇█]/);
      expect(combined).toContain("\\");
    });
  });

  describe("renderWeatherIcon", () => {
    const mockTheme: WeatherTheme = {
      primary: { r: 100, g: 150, b: 200 },
      secondary: { r: 80, g: 120, b: 160 },
      accent: { r: 255, g: 220, b: 100 },
      borderStyle: "soft",
    };

    test("returns multi-line string for clear weather", () => {
      const icon = renderWeatherIcon(0, mockTheme);
      expect(icon).toContain("\n");
      expect(icon.split("\n").length).toBe(5);
    });

    test("applies ANSI color codes", () => {
      const icon = renderWeatherIcon(0, mockTheme);
      expect(icon).toContain("\x1b[38;2;");
      expect(icon).toContain("\x1b[0m");
    });

    test("uses primary color from theme", () => {
      const icon = renderWeatherIcon(0, mockTheme);
      expect(icon).toContain(`\x1b[38;2;${mockTheme.primary.r};${mockTheme.primary.g};${mockTheme.primary.b}m`);
    });

    test("uses accent color for highlights", () => {
      const icon = renderWeatherIcon(0, mockTheme);
      expect(icon).toContain(`\x1b[38;2;${mockTheme.accent.r};${mockTheme.accent.g};${mockTheme.accent.b}m`);
    });

    describe("WMO code mapping", () => {
      test("code 0 renders clear sky", () => {
        const icon = renderWeatherIcon(0, mockTheme);
        expect(icon).toContain("\\");
        expect(icon).toContain("/");
      });

      test("codes 1-2 render partly cloudy", () => {
        for (const code of [1, 2]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toContain("▆");
        }
      });

      test("code 3 renders cloudy", () => {
        const icon = renderWeatherIcon(3, mockTheme);
        expect(icon).toContain("█");
        expect(icon).not.toContain("\\");
      });

      test("codes 45-48 render fog", () => {
        for (const code of [45, 46, 47, 48]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toContain("═");
        }
      });

      test("codes 51-57 render drizzle (light rain)", () => {
        for (const code of [51, 53, 55, 56, 57]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toContain("╱");
        }
      });

      test("codes 61-63 render normal rain", () => {
        for (const code of [61, 62, 63]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toContain("╱");
        }
      });

      test("codes 64-67 render heavy rain", () => {
        for (const code of [64, 65, 66, 67]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toContain("┃");
        }
      });

      test("codes 71-77 render snow", () => {
        for (const code of [71, 73, 75, 77]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toMatch(/[❄❅❆]/);
        }
      });

      test("codes 80-81 render rain showers", () => {
        for (const code of [80, 81]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toContain("╱");
        }
      });

      test("code 82 renders heavy rain shower", () => {
        const icon = renderWeatherIcon(82, mockTheme);
        expect(icon).toContain("┃");
      });

      test("codes 85-86 render snow showers", () => {
        for (const code of [85, 86]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toMatch(/[❄❅❆]/);
        }
      });

      test("codes 95-99 render thunderstorm", () => {
        for (const code of [95, 96, 99]) {
          const icon = renderWeatherIcon(code, mockTheme);
          expect(icon).toContain("⚡");
        }
      });

      test("unknown code renders partly cloudy fallback", () => {
        const icon = renderWeatherIcon(999, mockTheme);
        expect(icon).toContain("▆");
      });
    });

    test("integrates with getThemeForConditions", () => {
      const theme = getThemeForConditions(0, 12);
      const icon = renderWeatherIcon(0, theme);
      expect(icon).toContain("\x1b[38;2;");
      expect(icon.split("\n").length).toBe(5);
    });

    test("renders all weather types without error", () => {
      const codes = [0, 1, 2, 3, 45, 48, 51, 55, 61, 65, 71, 75, 80, 82, 85, 95, 99];
      for (const code of codes) {
        const theme = getThemeForConditions(code, 12);
        const icon = renderWeatherIcon(code, theme);
        expect(icon.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getCompactIcon", () => {
    test("returns sun for clear (code 0)", () => {
      expect(getCompactIcon(0)).toBe("☀");
    });

    test("returns partly cloudy for codes 1-2", () => {
      expect(getCompactIcon(1)).toBe("⛅");
      expect(getCompactIcon(2)).toBe("⛅");
    });

    test("returns cloud for code 3", () => {
      expect(getCompactIcon(3)).toBe("☁");
    });

    test("returns fog icon for codes 45-48", () => {
      expect(getCompactIcon(45)).toBe("🌫");
      expect(getCompactIcon(48)).toBe("🌫");
    });

    test("returns rain icon for drizzle codes", () => {
      expect(getCompactIcon(51)).toBe("🌧");
      expect(getCompactIcon(55)).toBe("🌧");
    });

    test("returns rain icon for rain codes", () => {
      expect(getCompactIcon(61)).toBe("🌧");
      expect(getCompactIcon(63)).toBe("🌧");
    });

    test("returns heavy rain icon for intense rain", () => {
      expect(getCompactIcon(65)).toBe("⛈");
      expect(getCompactIcon(82)).toBe("⛈");
    });

    test("returns snowflake for snow codes", () => {
      expect(getCompactIcon(71)).toBe("❄");
      expect(getCompactIcon(75)).toBe("❄");
      expect(getCompactIcon(85)).toBe("❄");
    });

    test("returns lightning for thunderstorm codes", () => {
      expect(getCompactIcon(95)).toBe("⚡");
      expect(getCompactIcon(99)).toBe("⚡");
    });

    test("returns cloud fallback for unknown codes", () => {
      expect(getCompactIcon(999)).toBe("⛅");
    });

    test("returns single character/emoji", () => {
      const codes = [0, 1, 3, 45, 51, 61, 65, 71, 85, 95];
      for (const code of codes) {
        const icon = getCompactIcon(code);
        expect([...icon].length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe("visual depth techniques", () => {
    test("uses line weight variation in rain", () => {
      const rain = WEATHER_ART.rain;
      const heavy = WEATHER_ART.heavyRain;
      const rainCombined = rain.lines.join("");
      const heavyCombined = heavy.lines.join("");
      expect(rainCombined).toContain("╱");
      expect(heavyCombined).toContain("┃");
    });

    test("uses block density progression in clouds", () => {
      const cloudy = WEATHER_ART.cloudy;
      const combined = cloudy.lines.join("");
      const densityChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
      let foundMultiple = 0;
      for (const char of densityChars) {
        if (combined.includes(char)) foundMultiple++;
      }
      expect(foundMultiple).toBeGreaterThan(3);
    });

    test("thunderstorm has dense cloud blocks with bright lightning", () => {
      const storm = WEATHER_ART.thunderstorm;
      const combined = storm.lines.join("");
      expect(combined).toContain("█");
      expect(combined).toContain("⚡");
    });

    test("sun has layered ray patterns", () => {
      const clear = WEATHER_ART.clear;
      const combined = clear.lines.join("");
      expect(combined).toContain("\\");
      expect(combined).toContain("|");
      expect(combined).toContain("/");
    });
  });

  describe("theme integration", () => {
    test("sunny theme colors work with clear icon", () => {
      const theme = getThemeForConditions(0, 12);
      const icon = renderWeatherIcon(0, theme);
      expect(icon).toContain("255");
    });

    test("stormy theme colors work with thunderstorm icon", () => {
      const theme = getThemeForConditions(95, 12);
      const icon = renderWeatherIcon(95, theme);
      expect(icon).toContain("\x1b[38;2;");
    });

    test("snowy theme colors work with snow icon", () => {
      const theme = getThemeForConditions(71, 12);
      const icon = renderWeatherIcon(71, theme);
      expect(icon).toContain("\x1b[38;2;");
    });

    test("rainy theme colors work with rain icon", () => {
      const theme = getThemeForConditions(61, 12);
      const icon = renderWeatherIcon(61, theme);
      expect(icon).toContain("\x1b[38;2;");
    });
  });

  describe("edge cases", () => {
    test("handles negative weather codes", () => {
      const theme: WeatherTheme = {
        primary: { r: 100, g: 100, b: 100 },
        secondary: { r: 100, g: 100, b: 100 },
        accent: { r: 200, g: 200, b: 200 },
        borderStyle: "standard",
      };
      const icon = renderWeatherIcon(-1, theme);
      expect(icon.length).toBeGreaterThan(0);
    });

    test("handles very large weather codes", () => {
      const theme: WeatherTheme = {
        primary: { r: 100, g: 100, b: 100 },
        secondary: { r: 100, g: 100, b: 100 },
        accent: { r: 200, g: 200, b: 200 },
        borderStyle: "standard",
      };
      const icon = renderWeatherIcon(1000, theme);
      expect(icon.length).toBeGreaterThan(0);
    });

    test("compact icon handles all boundary codes", () => {
      const boundaryCodes = [0, 1, 2, 3, 45, 48, 51, 57, 61, 67, 71, 77, 80, 86, 95, 99];
      for (const code of boundaryCodes) {
        const icon = getCompactIcon(code);
        expect(icon.length).toBeGreaterThan(0);
      }
    });
  });
});
