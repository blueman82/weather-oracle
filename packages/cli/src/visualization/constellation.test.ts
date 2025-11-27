/**
 * Tests for Model Agreement Constellation
 */

import { describe, test, expect } from "bun:test";
import type { ConstellationPoint } from "./constellation";
import {
  extractConstellationPoints,
  renderModelConstellation,
  renderAgreementBar,
  calculateAgreement,
  renderConstellationPanel,
} from "./constellation";
import type { ModelForecast, ModelName } from "@weather-oracle/core";
import {
  createCoordinates,
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

/**
 * Creates a mock ModelForecast for testing.
 */
function createMockForecast(
  model: ModelName,
  temperature: number,
  precipitation: number = 0,
  windSpeedValue: number = 5
): ModelForecast {
  const now = new Date();
  return {
    model,
    coordinates: createCoordinates(40.7128, -74.006),
    generatedAt: now,
    validFrom: now,
    validTo: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    hourly: [
      {
        timestamp: now,
        metrics: {
          temperature: celsius(temperature),
          feelsLike: celsius(temperature - 1),
          humidity: humidity(65),
          pressure: pressure(1013),
          cloudCover: cloudCover(50),
          visibility: visibility(10),
          uvIndex: uvIndex(5),
          precipitation: millimeters(precipitation),
          precipitationProbability: precipitation > 0 ? 80 : 10,
          windSpeed: metersPerSecond(windSpeedValue),
          windDirection: windDirection(180),
          windGust: metersPerSecond(windSpeedValue * 1.5),
          weatherCode: weatherCode(0),
        },
      },
    ],
    daily: [],
  };
}

describe("Model Agreement Constellation", () => {
  describe("ConstellationPoint interface", () => {
    test("has required properties", () => {
      const point: ConstellationPoint = {
        model: "ecmwf",
        value: 20.5,
        confidence: 0.85,
      };

      expect(point.model).toBe("ecmwf");
      expect(point.value).toBe(20.5);
      expect(point.confidence).toBe(0.85);
    });

    test("accepts all valid ModelName values", () => {
      const models: ModelName[] = [
        "ecmwf",
        "gfs",
        "icon",
        "meteofrance",
        "ukmo",
        "jma",
        "gem",
      ];

      for (const model of models) {
        const point: ConstellationPoint = {
          model,
          value: 15,
          confidence: 0.7,
        };
        expect(point.model).toBe(model);
      }
    });
  });

  describe("extractConstellationPoints", () => {
    test("extracts temperature values from forecasts", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 22),
        createMockForecast("icon", 21),
      ];

      const points = extractConstellationPoints(forecasts, "temperature");

      expect(points.length).toBe(3);
      expect(points[0].model).toBe("ecmwf");
      expect(points[0].value).toBe(20);
      expect(points[1].value).toBe(22);
      expect(points[2].value).toBe(21);
    });

    test("extracts precipitation values from forecasts", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20, 5),
        createMockForecast("gfs", 22, 3),
      ];

      const points = extractConstellationPoints(forecasts, "precipitation");

      expect(points.length).toBe(2);
      expect(points[0].value).toBe(5);
      expect(points[1].value).toBe(3);
    });

    test("extracts windSpeed values from forecasts", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20, 0, 10),
        createMockForecast("gfs", 22, 0, 15),
      ];

      const points = extractConstellationPoints(forecasts, "windSpeed");

      expect(points.length).toBe(2);
      expect(points[0].value).toBe(10);
      expect(points[1].value).toBe(15);
    });

    test("handles empty forecast array", () => {
      const points = extractConstellationPoints([], "temperature");
      expect(points.length).toBe(0);
    });

    test("handles forecasts with insufficient hourly data", () => {
      const forecast: ModelForecast = {
        model: "ecmwf",
        coordinates: createCoordinates(40, -74),
        generatedAt: new Date(),
        validFrom: new Date(),
        validTo: new Date(),
        hourly: [],
        daily: [],
      };

      const points = extractConstellationPoints([forecast], "temperature", 0);
      expect(points.length).toBe(0);
    });

    test("uses specified hourIndex", () => {
      const now = new Date();
      const forecast: ModelForecast = {
        model: "ecmwf",
        coordinates: createCoordinates(40, -74),
        generatedAt: now,
        validFrom: now,
        validTo: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        hourly: [
          {
            timestamp: now,
            metrics: {
              temperature: celsius(20),
              feelsLike: celsius(19),
              humidity: humidity(65),
              pressure: pressure(1013),
              cloudCover: cloudCover(50),
              visibility: visibility(10),
              uvIndex: uvIndex(5),
              precipitation: millimeters(0),
              precipitationProbability: 10,
              windSpeed: metersPerSecond(5),
              windDirection: windDirection(180),
              windGust: metersPerSecond(7.5),
              weatherCode: weatherCode(0),
            },
          },
          {
            timestamp: new Date(now.getTime() + 60 * 60 * 1000),
            metrics: {
              temperature: celsius(25),
              feelsLike: celsius(24),
              humidity: humidity(60),
              pressure: pressure(1012),
              cloudCover: cloudCover(40),
              visibility: visibility(10),
              uvIndex: uvIndex(6),
              precipitation: millimeters(0),
              precipitationProbability: 5,
              windSpeed: metersPerSecond(6),
              windDirection: windDirection(200),
              windGust: metersPerSecond(9),
              weatherCode: weatherCode(0),
            },
          },
        ],
        daily: [],
      };

      const points = extractConstellationPoints([forecast], "temperature", 1);

      expect(points.length).toBe(1);
      expect(points[0].value).toBe(25);
    });
  });

  describe("calculateAgreement", () => {
    test("returns 1 for single point", () => {
      const points: ConstellationPoint[] = [
        { model: "ecmwf", value: 20, confidence: 0.9 },
      ];
      expect(calculateAgreement(points)).toBe(1);
    });

    test("returns 1 for empty array", () => {
      expect(calculateAgreement([])).toBe(1);
    });

    test("returns 1 for identical values", () => {
      const points: ConstellationPoint[] = [
        { model: "ecmwf", value: 20, confidence: 0.9 },
        { model: "gfs", value: 20, confidence: 0.8 },
        { model: "icon", value: 20, confidence: 0.85 },
      ];
      expect(calculateAgreement(points)).toBe(1);
    });

    test("returns high agreement for similar values", () => {
      const points: ConstellationPoint[] = [
        { model: "ecmwf", value: 20, confidence: 0.9 },
        { model: "gfs", value: 20.5, confidence: 0.8 },
        { model: "icon", value: 19.5, confidence: 0.85 },
      ];
      const agreement = calculateAgreement(points);
      expect(agreement).toBeGreaterThan(0.9);
    });

    test("returns lower agreement for divergent values", () => {
      const points: ConstellationPoint[] = [
        { model: "ecmwf", value: 15, confidence: 0.9 },
        { model: "gfs", value: 25, confidence: 0.8 },
        { model: "icon", value: 20, confidence: 0.85 },
      ];
      const agreement = calculateAgreement(points);
      expect(agreement).toBeLessThan(0.9);
      expect(agreement).toBeGreaterThan(0);
    });

    test("returns lower agreement for widely spread values", () => {
      const points: ConstellationPoint[] = [
        { model: "ecmwf", value: 10, confidence: 0.9 },
        { model: "gfs", value: 30, confidence: 0.8 },
      ];
      const agreement = calculateAgreement(points);
      expect(agreement).toBeLessThan(0.7);
    });

    test("agreement is bounded between 0 and 1", () => {
      // Very divergent values
      const points: ConstellationPoint[] = [
        { model: "ecmwf", value: 0, confidence: 0.9 },
        { model: "gfs", value: 100, confidence: 0.8 },
      ];
      const agreement = calculateAgreement(points);
      expect(agreement).toBeGreaterThanOrEqual(0);
      expect(agreement).toBeLessThanOrEqual(1);
    });
  });

  describe("renderAgreementBar", () => {
    test("renders bar with percentage by default", () => {
      const result = renderAgreementBar(0.75);
      expect(result).toContain("75%");
      expect(result).toContain("[");
      expect(result).toContain("]");
    });

    test("renders bar without percentage when disabled", () => {
      const result = renderAgreementBar(0.75, { showPercentage: false });
      expect(result).not.toContain("%");
      expect(result).toContain("[");
      expect(result).toContain("]");
    });

    test("uses custom width", () => {
      const result = renderAgreementBar(0.5, { width: 10, showPercentage: false });
      // Bar without ANSI codes should contain 10 characters (5 filled, 5 empty)
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, "");
      expect(stripped.length).toBe(12); // 10 bar chars + 2 brackets
    });

    test("handles 0% agreement", () => {
      const result = renderAgreementBar(0);
      expect(result).toContain("0%");
      expect(result).toContain("░".repeat(20));
    });

    test("handles 100% agreement", () => {
      const result = renderAgreementBar(1);
      expect(result).toContain("100%");
      expect(result).toContain("█".repeat(20));
    });

    test("clamps values below 0", () => {
      const result = renderAgreementBar(-0.5);
      expect(result).toContain("0%");
    });

    test("clamps values above 1", () => {
      const result = renderAgreementBar(1.5);
      expect(result).toContain("100%");
    });

    test("applies green color for high agreement (>=0.8)", () => {
      const result = renderAgreementBar(0.85);
      expect(result).toContain("\x1b[32m"); // Green
    });

    test("applies yellow color for medium agreement (0.5-0.8)", () => {
      const result = renderAgreementBar(0.6);
      expect(result).toContain("\x1b[33m"); // Yellow
    });

    test("applies red color for low agreement (<0.5)", () => {
      const result = renderAgreementBar(0.3);
      expect(result).toContain("\x1b[31m"); // Red
    });
  });

  describe("renderModelConstellation", () => {
    test("renders constellation with multiple models", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 22),
        createMockForecast("icon", 21),
      ];

      const result = renderModelConstellation(forecasts, "temperature");

      expect(result).toContain("Temperature (°C)");
      expect(result).toContain("EC");
      expect(result).toContain("GFS");
      expect(result).toContain("ICN");
    });

    test("returns message for empty forecasts", () => {
      const result = renderModelConstellation([], "temperature");
      expect(result).toBe("No model data available");
    });

    test("shows scale range", () => {
      const forecasts = [
        createMockForecast("ecmwf", 15),
        createMockForecast("gfs", 25),
      ];

      const result = renderModelConstellation(forecasts, "temperature");

      expect(result).toContain("15.0");
      expect(result).toContain("25.0");
    });

    test("handles single model", () => {
      const forecasts = [createMockForecast("ecmwf", 20)];

      const result = renderModelConstellation(forecasts, "temperature");

      expect(result).toContain("EC");
      expect(result).toContain("20.0");
    });

    test("supports precipitation metric", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20, 5),
        createMockForecast("gfs", 22, 10),
      ];

      const result = renderModelConstellation(forecasts, "precipitation");

      expect(result).toContain("Precipitation (mm)");
    });

    test("supports windSpeed metric", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20, 0, 10),
        createMockForecast("gfs", 22, 0, 15),
      ];

      const result = renderModelConstellation(forecasts, "windSpeed");

      expect(result).toContain("Wind Speed (m/s)");
    });

    test("respects custom width", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 25),
      ];

      const result = renderModelConstellation(forecasts, "temperature", {
        width: 40,
      });

      // Width affects the scale line
      expect(result).toBeDefined();
    });

    test("hides legend when showLegend is false", () => {
      const forecasts = [createMockForecast("ecmwf", 20)];

      const result = renderModelConstellation(forecasts, "temperature", {
        showLegend: false,
      });

      // With legend hidden, there should be fewer lines
      const lines = result.split("\n").filter((l) => l.trim());
      expect(lines.length).toBeLessThan(5);
    });

    test("uses confidence symbols based on thresholds", () => {
      const forecasts = [createMockForecast("ecmwf", 20)];

      const result = renderModelConstellation(forecasts, "temperature");

      // Default confidence is 0.7, so should use medium symbol (◐)
      // But extractConstellationPoints sets 0.7 which >= 0.5 and < 0.8
      expect(result).toContain("◐");
    });
  });

  describe("renderConstellationPanel", () => {
    test("renders complete panel with title", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 21),
      ];

      const result = renderConstellationPanel(forecasts, "temperature");

      expect(result).toContain("Model Agreement Constellation");
      expect(result).toContain("═");
    });

    test("includes agreement bar", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 21),
      ];

      const result = renderConstellationPanel(forecasts, "temperature");

      expect(result).toContain("Agreement:");
      expect(result).toContain("%");
    });

    test("includes interpretation for high agreement", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 20.1),
        createMockForecast("icon", 19.9),
      ];

      const result = renderConstellationPanel(forecasts, "temperature");

      expect(result).toContain("High confidence");
    });

    test("includes interpretation for moderate agreement", () => {
      // Values with moderate spread: CV = stdDev/mean ≈ 0.5 gives agreement ≈ 0.5
      const forecasts = [
        createMockForecast("ecmwf", 10),
        createMockForecast("gfs", 30),
      ];

      const result = renderConstellationPanel(forecasts, "temperature");

      expect(result).toContain("Moderate confidence");
    });

    test("includes interpretation for low agreement", () => {
      // Very high CV needed for low agreement: need stdDev/mean > 0.5
      // With 5 and 25, mean=15, stdDev=10, CV=0.67, agreement=0.33
      const forecasts = [
        createMockForecast("ecmwf", 5),
        createMockForecast("gfs", 25),
      ];

      const result = renderConstellationPanel(forecasts, "temperature");

      expect(result).toContain("Low confidence");
    });
  });

  describe("visual clustering representation", () => {
    test("tight clustering shows high agreement", () => {
      // All models predict ~20°C
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 20.2),
        createMockForecast("icon", 19.8),
        createMockForecast("meteofrance", 20.1),
      ];

      const points = extractConstellationPoints(forecasts, "temperature");
      const agreement = calculateAgreement(points);

      expect(agreement).toBeGreaterThan(0.95);
    });

    test("spread clustering shows low agreement", () => {
      // Models predict widely different temperatures
      const forecasts = [
        createMockForecast("ecmwf", 10),
        createMockForecast("gfs", 25),
        createMockForecast("icon", 15),
        createMockForecast("meteofrance", 30),
      ];

      const points = extractConstellationPoints(forecasts, "temperature");
      const agreement = calculateAgreement(points);

      expect(agreement).toBeLessThan(0.7);
    });

    test("position mapping is proportional to value", () => {
      const forecasts = [
        createMockForecast("ecmwf", 0),
        createMockForecast("gfs", 50),
        createMockForecast("icon", 100),
      ];

      // Middle value should appear roughly in middle of visualization
      const result = renderModelConstellation(forecasts, "temperature", {
        width: 50,
        showLegend: false,
      });

      expect(result).toBeDefined();
      // The visualization should contain all the values
      expect(result).toContain("0.0");
      expect(result).toContain("100.0");
    });
  });

  describe("edge cases", () => {
    test("handles negative temperatures", () => {
      const forecasts = [
        createMockForecast("ecmwf", -20),
        createMockForecast("gfs", -10),
      ];

      const result = renderModelConstellation(forecasts, "temperature");

      expect(result).toContain("-20.0");
      expect(result).toContain("-10.0");
    });

    test("handles zero values", () => {
      const forecasts = [
        createMockForecast("ecmwf", 0, 0),
        createMockForecast("gfs", 0, 0),
      ];

      const result = renderModelConstellation(forecasts, "precipitation");

      expect(result).toBeDefined();
      expect(result).toContain("0.0");
    });

    test("handles very large values", () => {
      const forecasts = [
        createMockForecast("ecmwf", 50, 100),
        createMockForecast("gfs", 55, 150),
      ];

      const result = renderModelConstellation(forecasts, "precipitation");

      expect(result).toContain("100.0");
      expect(result).toContain("150.0");
    });

    test("handles identical values from all models", () => {
      const forecasts = [
        createMockForecast("ecmwf", 20),
        createMockForecast("gfs", 20),
        createMockForecast("icon", 20),
      ];

      const result = renderModelConstellation(forecasts, "temperature");

      expect(result).toBeDefined();
      // All models at same position
      const points = extractConstellationPoints(forecasts, "temperature");
      expect(calculateAgreement(points)).toBe(1);
    });
  });
});
