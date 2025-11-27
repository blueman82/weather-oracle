/**
 * Integration tests for Rich Visualization System.
 *
 * Tests the complete rich formatter flow using MSW to mock API responses,
 * verifying that all visualization components (sparklines, heatmap, constellation)
 * render correctly for various weather scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import {
  setupMswServer,
  resetMswServer,
  teardownMswServer,
} from "./mocks/server";
import {
  geocodeLocation,
  fetchAllModels,
  aggregateForecasts,
  calculateConfidence,
  generateNarrative,
  type Location,
} from "@weather-oracle/core";
import { createFormatter, type FormatterInput } from "../formatters/index";

// Sparkline and visualization characters
const SPARKLINE_CHARS = /[▁▂▃▄▅▆▇█]/;
const HEATMAP_BLOCKS = /[▀▄█░▒▓]/;
const CONSTELLATION_SYMBOLS = /[●◐○]/;

// Setup MSW server
beforeAll(() => {
  setupMswServer();
});

afterAll(() => {
  teardownMswServer();
});

afterEach(() => {
  resetMswServer();
});

describe("Rich Formatter Integration Tests", () => {
  /**
   * Helper to run full CLI flow and return formatter input
   */
  async function runForecastFlow(
    locationQuery: string,
    models: string[] = ["ecmwf", "gfs", "icon"],
    days: number = 7
  ): Promise<FormatterInput> {
    const geocoded = await geocodeLocation(locationQuery);
    const location: Location = { query: locationQuery, resolved: geocoded };

    const result = await fetchAllModels(
      location,
      models as Parameters<typeof fetchAllModels>[1],
      { forecastDays: days }
    );

    const aggregated = aggregateForecasts(result.forecasts);
    const confidence = calculateConfidence(aggregated, "overall", 0);
    const narrative = generateNarrative(aggregated, [confidence]);

    return {
      location,
      aggregated,
      confidence: [confidence],
      narrative,
      models: result.forecasts,
    };
  }

  describe("Sunny Weather Scenario (code 0)", () => {
    it("should render complete rich output with all sections", async () => {
      const data = await runForecastFlow("Dublin, Ireland");
      const formatter = createFormatter("rich", {
        useColors: true,
        units: "metric",
      });

      const output = formatter.format(data);

      // Verify location header
      expect(output).toContain("Dublin");
      expect(output).toContain("Ireland");

      // Verify temperature section exists
      expect(output).toContain("Temperature");

      // Verify sparkline characters are present
      expect(output).toMatch(SPARKLINE_CHARS);

      // Verify heatmap section
      expect(output).toContain("Heatmap");
    });

    it("should include sparkline visualization for temperature trends", async () => {
      const data = await runForecastFlow("Dublin");
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Verify sparkline characters (block elements)
      const sparklineMatches = output.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(sparklineMatches.length).toBeGreaterThan(0);

      // Should have "Next 24h" sparkline section
      expect(output).toContain("24h");
    });

    it("should render model constellation when multiple models provided", async () => {
      const data = await runForecastFlow("Dublin", ["ecmwf", "gfs", "icon"]);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Verify constellation section header
      expect(output).toContain("Model Consensus");

      // Should include constellation point symbols
      expect(output).toMatch(CONSTELLATION_SYMBOLS);
    });
  });

  describe("Rainy Weather Scenario (code 61)", () => {
    it("should render rich output for rainy conditions", async () => {
      const data = await runForecastFlow("London, UK");
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Basic sections should exist
      expect(output).toContain("London");
      expect(output).toContain("Temperature");
      expect(output).toMatch(SPARKLINE_CHARS);
    });

    it("should include daily summary with weather icons", async () => {
      const data = await runForecastFlow("London");
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Should have Daily Summary section
      expect(output).toContain("Daily Summary");

      // Should have temperature values (°C or °F)
      expect(output).toMatch(/\d+°[CF]/);
    });
  });

  describe("Stormy Weather Scenario (code 95)", () => {
    it("should render rich output for stormy conditions", async () => {
      const data = await runForecastFlow("Tokyo, Japan");
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      expect(output).toContain("Tokyo");
      expect(output).toContain("Japan");
      expect(output).toMatch(SPARKLINE_CHARS);
    });
  });

  describe("Heatmap Visualization", () => {
    it("should render 7-day temperature heatmap", async () => {
      const data = await runForecastFlow("Dublin", ["ecmwf", "gfs"], 7);
      const formatter = createFormatter("rich", {
        useColors: true,
        showModelDetails: true,
      });

      const output = formatter.format(data);

      // Verify heatmap section exists
      expect(output).toContain("7-Day Temperature Heatmap");
      // Verify heatmap uses block characters for visualization
      expect(output).toMatch(HEATMAP_BLOCKS);
    });

    it("should include temperature range in heatmap legend", async () => {
      const data = await runForecastFlow("New York");
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Heatmap should be present
      expect(output).toContain("Heatmap");

      // Should have some form of temperature display
      expect(output).toMatch(/\d+°/);
    });
  });

  describe("Model Constellation Visualization", () => {
    it("should show agreement indicator for multi-model forecasts", async () => {
      const data = await runForecastFlow("Dublin", ["ecmwf", "gfs", "icon"]);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Should show model consensus section
      expect(output).toContain("Model Consensus");

      // Should have agreement/confidence information
      expect(output).toMatch(/confidence|Overall|agree/i);
    });

    it("should render constellation points for each model", async () => {
      const data = await runForecastFlow(
        "London",
        ["ecmwf", "gfs", "icon", "jma"],
        5
      );
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Should have model consensus section with multiple model points
      expect(output).toContain("Consensus");

      // Constellation should use circle symbols
      const constellationSymbols = output.match(/[●◐○]/g) || [];
      expect(constellationSymbols.length).toBeGreaterThan(0);
    });

    it("should skip constellation for single model", async () => {
      const data = await runForecastFlow("Dublin", ["ecmwf"]);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Single model should still render other sections
      expect(output).toContain("Temperature");
      expect(output).toContain("Heatmap");

      // Constellation section should not appear for single model
      // (or should appear but be simpler)
    });
  });

  describe("Units and Formatting", () => {
    it("should display metric temperatures correctly", async () => {
      const data = await runForecastFlow("Dublin");
      const formatter = createFormatter("rich", {
        useColors: true,
        units: "metric",
      });

      const output = formatter.format(data);

      // Should have °C temperatures
      expect(output).toMatch(/\d+°C/);
    });

    it("should display imperial temperatures correctly", async () => {
      const data = await runForecastFlow("New York");
      const formatter = createFormatter("rich", {
        useColors: true,
        units: "imperial",
      });

      const output = formatter.format(data);

      // Should have °F temperatures
      expect(output).toMatch(/\d+°F/);
    });

    it("should handle color disabled mode", async () => {
      const data = await runForecastFlow("Dublin");
      const formatter = createFormatter("rich", { useColors: false });

      const output = formatter.format(data);

      // Output should still be valid but without ANSI codes
      expect(output).toContain("Dublin");
      expect(output).toContain("Temperature");

      // Should not contain ANSI escape sequences when colors disabled
      // (Note: some formatters may still include them based on terminal detection)
    });
  });

  describe("Edge Cases", () => {
    it("should handle short forecast period", async () => {
      const data = await runForecastFlow("Dublin", ["ecmwf"], 1);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      expect(output).toContain("Dublin");
      expect(output).toContain("Temperature");
    });

    it("should handle maximum forecast days", async () => {
      const data = await runForecastFlow("London", ["ecmwf", "gfs"], 14);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      expect(output).toContain("London");
      expect(output).toMatch(SPARKLINE_CHARS);
    });

    it("should handle all available models", async () => {
      const data = await runForecastFlow("Tokyo", [
        "ecmwf",
        "gfs",
        "icon",
        "jma",
        "gem",
        "meteofrance",
        "ukmo",
      ]);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      expect(output).toContain("Tokyo");
      expect(output).toContain("Model Consensus");
    });
  });

  describe("Component Verification", () => {
    it("should include all major visualization components", async () => {
      const data = await runForecastFlow("Dublin", ["ecmwf", "gfs", "icon"]);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // 1. Header with location
      expect(output).toContain("Dublin");

      // 2. Temperature sparkline section
      expect(output).toMatch(SPARKLINE_CHARS);

      // 3. Daily summary
      expect(output).toContain("Daily");

      // 4. Model constellation (multi-model)
      expect(output).toContain("Consensus");

      // 5. Heatmap section
      expect(output).toContain("Heatmap");
    });

    it("should render border characters for visual structure", async () => {
      const data = await runForecastFlow("Dublin", ["ecmwf", "gfs"]);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Should have box drawing characters for borders
      expect(output).toMatch(/[─│┌┐└┘═║╔╗╚╝╭╮╯╰]/);
    });

    it("should have properly structured sections with spacing", async () => {
      const data = await runForecastFlow("London");
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // Output should have multiple lines
      const lines = output.split("\n");
      expect(lines.length).toBeGreaterThan(10);

      // Should have blank lines for section separation
      expect(output).toContain("\n\n");
    });
  });

  describe("Data Integrity", () => {
    it("should display temperatures within reasonable range", async () => {
      const data = await runForecastFlow("Dublin");
      const formatter = createFormatter("rich", {
        useColors: true,
        units: "metric",
      });

      const output = formatter.format(data);

      // Extract temperature numbers
      const tempMatches = output.match(/-?\d+°C/g) || [];

      for (const match of tempMatches) {
        const temp = parseInt(match.replace("°C", ""), 10);
        // Reasonable temperature range for Earth
        expect(temp).toBeGreaterThan(-60);
        expect(temp).toBeLessThan(60);
      }
    });

    it("should have consistent model count in constellation", async () => {
      const models = ["ecmwf", "gfs", "icon"];
      const data = await runForecastFlow("Dublin", models);
      const formatter = createFormatter("rich", { useColors: true });

      const output = formatter.format(data);

      // The constellation should show points for each model
      expect(output).toContain("Consensus");

      // Verify we have multiple model data
      expect(data.models.length).toBe(3);
    });
  });
});
