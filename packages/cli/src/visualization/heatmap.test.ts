/**
 * Tests for 7-Day Heatmap Grid Visualization
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import type { HeatmapCell } from "./heatmap";
import {
  render7DayHeatMap,
  renderHeatmapLegend,
  getTemperatureRange,
} from "./heatmap";
import { clearGradientCache } from "./gradient";
import { clearCache as clearTerminalCache } from "./terminal";
import type { DailyForecast, HourlyForecast } from "@weather-oracle/core";
import {
  celsius,
  millimeters,
  metersPerSecond,
  windDirection,
  humidity,
  pressure,
  cloudCover,
  uvIndex,
  visibility,
  weatherCode,
} from "@weather-oracle/core";

describe("7-Day Heatmap Grid", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    clearGradientCache();
    clearTerminalCache();
    // Set up for truecolor support
    setTTY(true);
    clearEnvVars();
    process.env.COLORTERM = "truecolor";
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

  function createMockHourlyForecast(hour: number, temp: number): HourlyForecast {
    const timestamp = new Date(2024, 0, 1, hour, 0, 0);
    return {
      timestamp,
      metrics: {
        temperature: celsius(temp),
        feelsLike: celsius(temp),
        humidity: humidity(50),
        pressure: pressure(1013),
        windSpeed: metersPerSecond(5),
        windDirection: windDirection(180),
        precipitation: millimeters(0),
        precipitationProbability: 0,
        cloudCover: cloudCover(20),
        visibility: visibility(10000),
        uvIndex: uvIndex(3),
        weatherCode: weatherCode(0),
      },
    };
  }

  function createMockDailyForecast(
    dayOffset: number,
    minTemp: number,
    maxTemp: number,
    includeHourly = false
  ): DailyForecast {
    const date = new Date(2024, 0, 1 + dayOffset);

    let hourly: HourlyForecast[] = [];
    if (includeHourly) {
      for (let h = 0; h < 24; h++) {
        // Create a temperature curve
        const phase = (h - 5) * ((2 * Math.PI) / 24);
        const normalized = (1 - Math.cos(phase)) / 2;
        const temp = minTemp + normalized * (maxTemp - minTemp);
        hourly.push(createMockHourlyForecast(h, temp));
      }
    }

    return {
      date,
      temperature: {
        min: celsius(minTemp),
        max: celsius(maxTemp),
      },
      humidity: {
        min: humidity(40),
        max: humidity(70),
      },
      pressure: {
        min: pressure(1010),
        max: pressure(1015),
      },
      precipitation: {
        total: millimeters(0),
        probability: 0,
        hours: 0,
      },
      wind: {
        avgSpeed: metersPerSecond(5),
        maxSpeed: metersPerSecond(10),
        dominantDirection: windDirection(180),
      },
      cloudCover: {
        avg: cloudCover(30),
        max: cloudCover(60),
      },
      uvIndex: {
        max: uvIndex(5),
      },
      sun: {
        sunrise: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 6, 30),
        sunset: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 30),
        daylightHours: 12,
      },
      weatherCode: weatherCode(0),
      hourly,
    };
  }

  describe("HeatmapCell interface", () => {
    test("cell has required properties", () => {
      const cell: HeatmapCell = {
        temp: 20,
        hour: 12,
        day: 0,
      };

      expect(cell.temp).toBe(20);
      expect(cell.hour).toBe(12);
      expect(cell.day).toBe(0);
    });

    test("cell accepts negative temperatures", () => {
      const cell: HeatmapCell = {
        temp: -15,
        hour: 5,
        day: 2,
      };

      expect(cell.temp).toBe(-15);
    });

    test("cell accepts all valid hour values", () => {
      for (let hour = 0; hour < 24; hour++) {
        const cell: HeatmapCell = {
          temp: 10,
          hour,
          day: 0,
        };
        expect(cell.hour).toBe(hour);
      }
    });
  });

  describe("render7DayHeatMap", () => {
    test("returns message for empty forecasts", () => {
      const result = render7DayHeatMap([]);
      expect(result).toBe("No forecast data available for heatmap.");
    });

    test("renders single day forecast", () => {
      const forecasts = [createMockDailyForecast(0, 10, 25)];
      const result = render7DayHeatMap(forecasts);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("renders 7 day forecast", () => {
      const forecasts = Array.from({ length: 7 }, (_, i) =>
        createMockDailyForecast(i, 5 + i * 2, 15 + i * 3)
      );
      const result = render7DayHeatMap(forecasts);

      expect(result).toBeDefined();
      expect(result.split("\n").length).toBeGreaterThan(1);
    });

    test("truncates forecasts beyond 7 days", () => {
      const forecasts = Array.from({ length: 10 }, (_, i) =>
        createMockDailyForecast(i, 10, 25)
      );
      const result = render7DayHeatMap(forecasts);

      // Should only show 7 days
      expect(result).toBeDefined();
      // Header should have at most 7 day labels
      const headerLine = result.split("\n")[0];
      const dayMatches = headerLine.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g);
      expect(dayMatches?.length).toBeLessThanOrEqual(7);
    });

    test("includes hour labels", () => {
      const forecasts = [createMockDailyForecast(0, 10, 25)];
      const result = render7DayHeatMap(forecasts);

      // Should have hour markers
      expect(result).toContain("00h");
    });

    test("includes day labels in header", () => {
      const forecasts = [
        createMockDailyForecast(0, 10, 25), // Monday Jan 1, 2024
      ];
      const result = render7DayHeatMap(forecasts);
      const headerLine = result.split("\n")[0];

      // Should have a day name
      expect(headerLine).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
    });

    test("produces colored output with truecolor support", () => {
      const forecasts = [createMockDailyForecast(0, -10, 35)];
      const result = render7DayHeatMap(forecasts);

      // Should contain ANSI color codes
      expect(result).toContain("\x1b[38;2;");
      expect(result).toContain("\x1b[0m");
    });

    test("produces plain output when NO_COLOR is set", () => {
      clearEnvVars();
      process.env.NO_COLOR = "1";
      clearGradientCache();
      clearTerminalCache();

      const forecasts = [createMockDailyForecast(0, 10, 25)];
      const result = render7DayHeatMap(forecasts);

      // Should not contain ANSI color codes
      expect(result).not.toContain("\x1b[38;2;");
    });

    test("uses half-block characters for density", () => {
      const forecasts = [createMockDailyForecast(0, 10, 25)];
      const result = render7DayHeatMap(forecasts);

      // Should use half-block characters
      expect(result).toMatch(/[▀▄█]/);
    });

    test("uses hourly data when available", () => {
      const forecasts = [createMockDailyForecast(0, 5, 30, true)];
      const result = render7DayHeatMap(forecasts);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test("interpolates hourly temperatures when not provided", () => {
      const forecastWithHourly = createMockDailyForecast(0, 10, 25, true);
      const forecastWithoutHourly = createMockDailyForecast(0, 10, 25, false);

      const resultWithHourly = render7DayHeatMap([forecastWithHourly]);
      const resultWithoutHourly = render7DayHeatMap([forecastWithoutHourly]);

      // Both should produce valid output
      expect(resultWithHourly.length).toBeGreaterThan(0);
      expect(resultWithoutHourly.length).toBeGreaterThan(0);
    });

    test("handles extreme temperature ranges", () => {
      const forecasts = [createMockDailyForecast(0, -30, 45)];
      const result = render7DayHeatMap(forecasts);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test("handles uniform temperatures", () => {
      const forecasts = [createMockDailyForecast(0, 20, 20)];
      const result = render7DayHeatMap(forecasts);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("renderHeatmapLegend", () => {
    test("renders legend with min and max labels", () => {
      const result = renderHeatmapLegend(0, 30);

      expect(result).toContain("0°");
      expect(result).toContain("30°");
    });

    test("renders legend with temperature scale header", () => {
      const result = renderHeatmapLegend(10, 25);

      expect(result).toContain("Temperature Scale:");
    });

    test("renders colored gradient bar with truecolor support", () => {
      const result = renderHeatmapLegend(-10, 35);

      // Should contain colored blocks
      expect(result).toContain("█");
      // Should contain ANSI color codes
      expect(result).toContain("\x1b[38;2;");
    });

    test("renders plain legend when NO_COLOR is set", () => {
      clearEnvVars();
      process.env.NO_COLOR = "1";
      clearGradientCache();
      clearTerminalCache();

      const result = renderHeatmapLegend(0, 30);

      // Should not contain ANSI color codes
      expect(result).not.toContain("\x1b[38;2;");
      // Should still have the blocks
      expect(result).toContain("█");
    });

    test("handles negative temperature ranges", () => {
      const result = renderHeatmapLegend(-25, 10);

      expect(result).toContain("-25°");
      expect(result).toContain("10°");
    });

    test("handles narrow temperature ranges", () => {
      const result = renderHeatmapLegend(18, 22);

      expect(result).toContain("18°");
      expect(result).toContain("22°");
    });

    test("rounds temperature labels", () => {
      const result = renderHeatmapLegend(10.7, 25.3);

      expect(result).toContain("11°");
      expect(result).toContain("25°");
    });
  });

  describe("getTemperatureRange", () => {
    test("returns default range for empty forecasts", () => {
      const result = getTemperatureRange([]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(30);
    });

    test("extracts min and max from single forecast", () => {
      const forecasts = [createMockDailyForecast(0, 5, 25)];
      const result = getTemperatureRange(forecasts);

      expect(result.min).toBe(5);
      expect(result.max).toBe(25);
    });

    test("extracts global min and max from multiple forecasts", () => {
      const forecasts = [
        createMockDailyForecast(0, 10, 20),
        createMockDailyForecast(1, 5, 18),
        createMockDailyForecast(2, 8, 28),
      ];
      const result = getTemperatureRange(forecasts);

      expect(result.min).toBe(5);
      expect(result.max).toBe(28);
    });

    test("handles negative temperatures", () => {
      const forecasts = [
        createMockDailyForecast(0, -15, 5),
        createMockDailyForecast(1, -10, 10),
      ];
      const result = getTemperatureRange(forecasts);

      expect(result.min).toBe(-15);
      expect(result.max).toBe(10);
    });

    test("handles uniform temperatures", () => {
      const forecasts = [createMockDailyForecast(0, 20, 20)];
      const result = getTemperatureRange(forecasts);

      expect(result.min).toBe(20);
      expect(result.max).toBe(20);
    });
  });

  describe("integration tests", () => {
    test("full week visualization with legend", () => {
      const forecasts = [
        createMockDailyForecast(0, 5, 15),   // Cool day
        createMockDailyForecast(1, 8, 18),   // Mild day
        createMockDailyForecast(2, 12, 25),  // Warm day
        createMockDailyForecast(3, 15, 30),  // Hot day
        createMockDailyForecast(4, 10, 22),  // Moderate day
        createMockDailyForecast(5, 6, 16),   // Cool day
        createMockDailyForecast(6, 4, 14),   // Cooler day
      ];

      const heatmap = render7DayHeatMap(forecasts);
      const { min, max } = getTemperatureRange(forecasts);
      const legend = renderHeatmapLegend(min, max);

      // Heatmap should be valid
      expect(heatmap).toBeDefined();
      expect(heatmap.split("\n").length).toBeGreaterThan(5);

      // Legend should reflect actual temperature range
      expect(legend).toContain("4°");
      expect(legend).toContain("30°");
    });

    test("visual consistency across different terminal tiers", () => {
      const forecasts = [createMockDailyForecast(0, 10, 25)];

      // Truecolor tier
      clearEnvVars();
      setTTY(true);
      process.env.COLORTERM = "truecolor";
      clearGradientCache();
      clearTerminalCache();
      const truecolorResult = render7DayHeatMap(forecasts);

      // 256-color tier
      clearEnvVars();
      setTTY(true);
      process.env.TERM = "xterm-256color";
      clearGradientCache();
      clearTerminalCache();
      const color256Result = render7DayHeatMap(forecasts);

      // Plain tier
      clearEnvVars();
      setTTY(true);
      process.env.NO_COLOR = "1";
      clearGradientCache();
      clearTerminalCache();
      const plainResult = render7DayHeatMap(forecasts);

      // All should produce output
      expect(truecolorResult.length).toBeGreaterThan(0);
      expect(color256Result.length).toBeGreaterThan(0);
      expect(plainResult.length).toBeGreaterThan(0);

      // Truecolor should have 24-bit codes
      expect(truecolorResult).toContain("\x1b[38;2;");

      // 256-color should have 8-bit codes
      expect(color256Result).toContain("\x1b[38;5;");

      // Plain should have no color codes
      expect(plainResult).not.toContain("\x1b[38;");
    });
  });
});
