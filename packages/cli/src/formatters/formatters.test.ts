/**
 * Tests for output formatters.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import type { FormatterInput } from "./types";
import type {
  Location,
  AggregatedForecast,
  ModelForecast,
  AggregatedDailyForecast,
  AggregatedHourlyForecast,
  ModelConsensus,
  MetricStatistics,
  WeatherMetrics,
  DailyForecast,
} from "@weather-oracle/core";
import type { ConfidenceResult, NarrativeSummary } from "@weather-oracle/core";
import {
  celsius,
  millimeters,
  metersPerSecond,
  humidity,
  pressure,
  cloudCover,
  uvIndex,
  visibility,
  weatherCode,
  windDirection,
  latitude,
  longitude,
  timezoneId,
} from "@weather-oracle/core";

import { TableFormatter, createTableFormatter } from "./table";
import { NarrativeFormatter, createNarrativeFormatter } from "./narrative";
import { JsonFormatter, createJsonFormatter } from "./json";
import { RichFormatter } from "./rich";
import {
  createFormatter,
  getAvailableFormats,
  isValidFormat,
  format,
} from "./index";
import {
  supportsColors,
  getTempColor,
  getPrecipColor,
  getConfidenceColor,
  colorizeTemp,
  createPlainPalette,
} from "./colors";

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockMetrics(): WeatherMetrics {
  return {
    temperature: celsius(20),
    feelsLike: celsius(19),
    humidity: humidity(65),
    pressure: pressure(1015),
    windSpeed: metersPerSecond(5),
    windDirection: windDirection(180),
    windGust: metersPerSecond(8),
    precipitation: millimeters(2),
    precipitationProbability: 40,
    cloudCover: cloudCover(50),
    visibility: visibility(10000),
    uvIndex: uvIndex(5),
    weatherCode: weatherCode(3),
  };
}

function createMockStatistics(): MetricStatistics {
  return {
    mean: 20,
    median: 20,
    min: 18,
    max: 22,
    stdDev: 1.5,
    range: 4,
  };
}

function createMockConsensus(): ModelConsensus {
  return {
    agreementScore: 0.8,
    modelsInAgreement: ["ecmwf", "gfs", "icon"],
    outlierModels: [],
    temperatureStats: createMockStatistics(),
    precipitationStats: createMockStatistics(),
    windStats: createMockStatistics(),
  };
}

function createMockDailyForecast(date: Date): DailyForecast {
  return {
    date,
    temperature: {
      min: celsius(15),
      max: celsius(25),
    },
    humidity: {
      min: humidity(40),
      max: humidity(80),
    },
    pressure: {
      min: pressure(1010),
      max: pressure(1020),
    },
    precipitation: {
      total: millimeters(5),
      probability: 60,
      hours: 3,
    },
    wind: {
      avgSpeed: metersPerSecond(4),
      maxSpeed: metersPerSecond(8),
      dominantDirection: windDirection(225),
    },
    cloudCover: {
      avg: cloudCover(60),
      max: cloudCover(90),
    },
    uvIndex: {
      max: uvIndex(6),
    },
    sun: {
      sunrise: new Date(date.getTime() + 6 * 60 * 60 * 1000),
      sunset: new Date(date.getTime() + 18 * 60 * 60 * 1000),
      daylightHours: 12,
    },
    weatherCode: weatherCode(61),
    hourly: [],
  };
}

function createMockAggregatedDaily(date: Date): AggregatedDailyForecast {
  return {
    date,
    forecast: createMockDailyForecast(date),
    confidence: { level: "high", score: 0.85 },
    modelAgreement: createMockConsensus(),
    range: {
      temperatureMax: { min: 23, max: 27 },
      temperatureMin: { min: 13, max: 17 },
      precipitation: { min: 3, max: 8 },
    },
  };
}

function createMockAggregatedHourly(timestamp: Date): AggregatedHourlyForecast {
  return {
    timestamp,
    metrics: createMockMetrics(),
    confidence: { level: "high", score: 0.85 },
    modelAgreement: createMockConsensus(),
    range: {
      temperature: { min: 18, max: 22 },
      precipitation: { min: 0, max: 4 },
      windSpeed: { min: 3, max: 7 },
    },
  };
}

function createMockLocation(): Location {
  return {
    query: "Dublin",
    resolved: {
      name: "Dublin",
      coordinates: {
        latitude: latitude(53.3498),
        longitude: longitude(-6.2603),
      },
      country: "Ireland",
      countryCode: "IE",
      region: "Leinster",
      timezone: timezoneId("Europe/Dublin"),
      elevation: undefined,
      population: 1000000,
    },
  };
}

function createMockModelForecast(model: string, date: Date): ModelForecast {
  return {
    model: model as "ecmwf" | "gfs" | "icon",
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    generatedAt: new Date(),
    validFrom: date,
    validTo: new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000),
    hourly: [],
    daily: [createMockDailyForecast(date)],
  };
}

function createMockAggregatedForecast(): AggregatedForecast {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return {
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    generatedAt: now,
    validFrom: now,
    validTo: dayAfter,
    models: ["ecmwf", "gfs", "icon"],
    modelForecasts: [
      createMockModelForecast("ecmwf", now),
      createMockModelForecast("gfs", now),
      createMockModelForecast("icon", now),
    ],
    consensus: {
      hourly: [
        createMockAggregatedHourly(now),
        createMockAggregatedHourly(new Date(now.getTime() + 3600000)),
      ],
      daily: [
        createMockAggregatedDaily(now),
        createMockAggregatedDaily(tomorrow),
        createMockAggregatedDaily(dayAfter),
      ],
    },
    modelWeights: [
      { model: "ecmwf", weight: 0.4, reason: "Best performer" },
      { model: "gfs", weight: 0.35, reason: "Good baseline" },
      { model: "icon", weight: 0.25, reason: "Regional model" },
    ],
    overallConfidence: { level: "high", score: 0.82 },
  };
}

function createMockConfidenceResult(): ConfidenceResult {
  return {
    level: "high",
    score: 0.85,
    factors: [
      {
        name: "spread",
        weight: 0.5,
        score: 0.9,
        contribution: 0.45,
        detail: "Spread: 1.5C",
      },
      {
        name: "agreement",
        weight: 0.3,
        score: 0.8,
        contribution: 0.24,
        detail: "3/3 models agree",
      },
      {
        name: "timeHorizon",
        weight: 0.2,
        score: 0.8,
        contribution: 0.16,
        detail: "0 days ahead",
      },
    ],
    explanation: "High confidence: All 3 models agree on the forecast",
  };
}

function createMockNarrative(): NarrativeSummary {
  return {
    headline: "Models agree on rain conditions through tomorrow.",
    body: "ECMWF and GFS show similar rainfall amounts. Confidence is HIGH for this forecast period.",
    alerts: [],
    modelNotes: ["ICON shows slightly higher temperatures."],
  };
}

function createMockFormatterInput(): FormatterInput {
  return {
    location: createMockLocation(),
    aggregated: createMockAggregatedForecast(),
    confidence: [createMockConfidenceResult()],
    narrative: createMockNarrative(),
    models: createMockAggregatedForecast().modelForecasts,
  };
}

// ============================================================================
// Color Utility Tests
// ============================================================================

describe("Color utilities", () => {
  test("supportsColors returns boolean", () => {
    const result = supportsColors();
    expect(typeof result).toBe("boolean");
  });

  test("createPlainPalette returns functional palette", () => {
    const palette = createPlainPalette();
    expect(palette).toBeDefined();
    expect(palette.temp).toBeDefined();
    expect(palette.precip).toBeDefined();
    expect(palette.confidence).toBeDefined();
    expect(palette.ui).toBeDefined();
  });

  test("getTempColor returns function for different temps", () => {
    const palette = createPlainPalette();

    const hotColor = getTempColor(40, palette);
    const coldColor = getTempColor(-10, palette);

    expect(typeof hotColor).toBe("function");
    expect(typeof coldColor).toBe("function");
    expect(hotColor("test")).toBe("test");
    expect(coldColor("test")).toBe("test");
  });

  test("getPrecipColor returns function for different amounts", () => {
    const palette = createPlainPalette();

    const noneColor = getPrecipColor(0, palette);
    const heavyColor = getPrecipColor(15, palette);

    expect(typeof noneColor).toBe("function");
    expect(typeof heavyColor).toBe("function");
  });

  test("getConfidenceColor returns function for levels", () => {
    const palette = createPlainPalette();

    const highColor = getConfidenceColor("high", palette);
    const lowColor = getConfidenceColor("low", palette);

    expect(typeof highColor).toBe("function");
    expect(typeof lowColor).toBe("function");
  });

  test("colorizeTemp formats temperature correctly", () => {
    const palette = createPlainPalette();

    const metric = colorizeTemp(20, palette, "metric");
    expect(metric).toContain("20");
    expect(metric).toContain("C");

    const imperial = colorizeTemp(20, palette, "imperial");
    expect(imperial).toContain("68");
    expect(imperial).toContain("F");
  });
});

// ============================================================================
// Table Formatter Tests
// ============================================================================

describe("TableFormatter", () => {
  let formatter: TableFormatter;
  let input: FormatterInput;

  beforeEach(() => {
    formatter = new TableFormatter({ useColors: false });
    input = createMockFormatterInput();
  });

  test("creates formatter with default options", () => {
    const f = createTableFormatter();
    expect(f).toBeInstanceOf(TableFormatter);
  });

  test("format returns string output", () => {
    const output = formatter.format(input);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("output contains location name", () => {
    const output = formatter.format(input);
    expect(output).toContain("Dublin");
    expect(output).toContain("Ireland");
  });

  test("output contains table headers", () => {
    const output = formatter.format(input);
    expect(output).toContain("Day");
    expect(output).toContain("High");
    expect(output).toContain("Low");
    expect(output).toContain("Precip");
    expect(output).toContain("Wind");
  });

  test("output contains model count", () => {
    const output = formatter.format(input);
    expect(output).toContain("3");
    expect(output.toLowerCase()).toContain("model");
  });

  test("shows confidence when enabled", () => {
    const formatterWithConf = new TableFormatter({
      useColors: false,
      showConfidence: true,
    });
    const output = formatterWithConf.format(input);
    expect(output.toLowerCase()).toContain("confidence");
  });

  test("shows model details when enabled", () => {
    const formatterWithDetails = new TableFormatter({
      useColors: false,
      showModelDetails: true,
    });
    const output = formatterWithDetails.format(input);
    expect(output).toContain("ECMWF");
    expect(output).toContain("GFS");
  });

  test("handles empty forecast gracefully", () => {
    const emptyInput = {
      ...input,
      aggregated: {
        ...input.aggregated,
        consensus: {
          hourly: [],
          daily: [],
        },
      },
    };
    const output = formatter.format(emptyInput);
    expect(output).toContain("No forecast data available");
  });
});

// ============================================================================
// Narrative Formatter Tests
// ============================================================================

describe("NarrativeFormatter", () => {
  let formatter: NarrativeFormatter;
  let input: FormatterInput;

  beforeEach(() => {
    formatter = new NarrativeFormatter({ useColors: false });
    input = createMockFormatterInput();
  });

  test("creates formatter with default options", () => {
    const f = createNarrativeFormatter();
    expect(f).toBeInstanceOf(NarrativeFormatter);
  });

  test("format returns string output", () => {
    const output = formatter.format(input);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("output contains headline", () => {
    const output = formatter.format(input);
    expect(output).toContain("Models agree on rain conditions");
  });

  test("output contains location", () => {
    const output = formatter.format(input);
    expect(output).toContain("Dublin");
    expect(output).toContain("Ireland");
  });

  test("output contains day-by-day outlook", () => {
    const output = formatter.format(input);
    expect(output.toLowerCase()).toContain("day-by-day");
  });

  test("shows confidence when enabled", () => {
    const formatterWithConf = new NarrativeFormatter({
      useColors: false,
      showConfidence: true,
    });
    const output = formatterWithConf.format(input);
    expect(output.toLowerCase()).toContain("confidence");
  });

  test("shows model notes when enabled and available", () => {
    const formatterWithDetails = new NarrativeFormatter({
      useColors: false,
      showModelDetails: true,
    });
    const output = formatterWithDetails.format(input);
    expect(output).toContain("ICON");
  });

  test("shows alerts when present", () => {
    const inputWithAlerts = {
      ...input,
      narrative: {
        ...input.narrative,
        alerts: ["Significant uncertainty beyond 5 days."],
      },
    };
    const output = formatter.format(inputWithAlerts);
    expect(output).toContain("uncertainty");
  });
});

// ============================================================================
// JSON Formatter Tests
// ============================================================================

describe("JsonFormatter", () => {
  let formatter: JsonFormatter;
  let input: FormatterInput;

  beforeEach(() => {
    formatter = new JsonFormatter({ pretty: false });
    input = createMockFormatterInput();
  });

  test("creates formatter with default options", () => {
    const f = createJsonFormatter();
    expect(f).toBeInstanceOf(JsonFormatter);
  });

  test("format returns valid JSON", () => {
    const output = formatter.format(input);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("output contains location data", () => {
    const output = formatter.format(input);
    const parsed = JSON.parse(output);

    expect(parsed.location).toBeDefined();
    expect(parsed.location.name).toBe("Dublin");
    expect(parsed.location.country).toBe("Ireland");
    expect(parsed.location.coordinates.latitude).toBeCloseTo(53.3498);
  });

  test("output contains confidence data", () => {
    const output = formatter.format(input);
    const parsed = JSON.parse(output);

    expect(parsed.confidence).toBeDefined();
    expect(parsed.confidence.level).toBe("high");
    expect(parsed.confidence.score).toBeGreaterThan(0);
  });

  test("output contains narrative data", () => {
    const output = formatter.format(input);
    const parsed = JSON.parse(output);

    expect(parsed.narrative).toBeDefined();
    expect(parsed.narrative.headline).toContain("Models agree");
    expect(Array.isArray(parsed.narrative.alerts)).toBe(true);
  });

  test("output contains daily forecasts", () => {
    const output = formatter.format(input);
    const parsed = JSON.parse(output);

    expect(parsed.daily).toBeDefined();
    expect(Array.isArray(parsed.daily)).toBe(true);
    expect(parsed.daily.length).toBeGreaterThan(0);
  });

  test("daily forecasts have correct structure", () => {
    const output = formatter.format(input);
    const parsed = JSON.parse(output);

    const daily = parsed.daily[0];
    expect(daily.date).toBeDefined();
    expect(daily.temperature).toBeDefined();
    expect(daily.temperature.high).toBeDefined();
    expect(daily.temperature.low).toBeDefined();
    expect(daily.precipitation).toBeDefined();
    expect(daily.wind).toBeDefined();
    expect(daily.confidence).toBeDefined();
  });

  test("dates are serialized as ISO strings", () => {
    const output = formatter.format(input);
    const parsed = JSON.parse(output);

    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.validTo).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("pretty printing adds indentation", () => {
    const prettyFormatter = new JsonFormatter({ pretty: true, indent: 2 });
    const output = prettyFormatter.format(input);

    expect(output).toContain("\n");
    expect(output).toContain("  ");
  });

  test("includes hourly when requested", () => {
    const hourlyFormatter = new JsonFormatter({ includeHourly: true });
    const output = hourlyFormatter.format(input);
    const parsed = JSON.parse(output);

    expect(parsed.hourly).toBeDefined();
    expect(Array.isArray(parsed.hourly)).toBe(true);
  });

  test("includes ranges when requested", () => {
    const rangesFormatter = new JsonFormatter({ includeRanges: true });
    const output = rangesFormatter.format(input);
    const parsed = JSON.parse(output);

    const daily = parsed.daily[0];
    expect(daily.temperature.range).toBeDefined();
    expect(daily.temperature.range.highMin).toBeDefined();
    expect(daily.temperature.range.highMax).toBeDefined();
  });

  test("excludes hourly by default", () => {
    const output = formatter.format(input);
    const parsed = JSON.parse(output);

    expect(parsed.hourly).toBeUndefined();
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("Formatter factory", () => {
  test("createFormatter creates table formatter", () => {
    const formatter = createFormatter("table");
    expect(formatter).toBeInstanceOf(TableFormatter);
  });

  test("createFormatter creates narrative formatter", () => {
    const formatter = createFormatter("narrative");
    expect(formatter).toBeInstanceOf(NarrativeFormatter);
  });

  test("createFormatter creates json formatter", () => {
    const formatter = createFormatter("json");
    expect(formatter).toBeInstanceOf(JsonFormatter);
  });

  test("createFormatter creates rich formatter", () => {
    const formatter = createFormatter("rich");
    expect(formatter).toBeInstanceOf(RichFormatter);
  });

  test("createFormatter throws for unknown type", () => {
    expect(() => createFormatter("invalid" as any)).toThrow("Unknown formatter type");
  });

  test("createFormatter passes options to formatter", () => {
    const formatter = createFormatter("table", { useColors: false });
    const input = createMockFormatterInput();
    const output = formatter.format(input);

    // Output should not contain ANSI escape codes
    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1B\[[0-9;]*[a-zA-Z]/);
  });

  test("getAvailableFormats returns all formats", () => {
    const formats = getAvailableFormats();

    expect(formats).toContain("table");
    expect(formats).toContain("narrative");
    expect(formats).toContain("json");
    expect(formats).toContain("rich");
    expect(formats.length).toBe(4);
  });

  test("isValidFormat returns true for valid formats", () => {
    expect(isValidFormat("table")).toBe(true);
    expect(isValidFormat("narrative")).toBe(true);
    expect(isValidFormat("json")).toBe(true);
    expect(isValidFormat("rich")).toBe(true);
  });

  test("isValidFormat returns false for invalid formats", () => {
    expect(isValidFormat("invalid")).toBe(false);
    expect(isValidFormat("")).toBe(false);
    expect(isValidFormat("TABLE")).toBe(false);
  });

  test("format convenience function works", () => {
    const input = createMockFormatterInput();
    const output = format("json", input);

    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed.location.name).toBe("Dublin");
  });
});
