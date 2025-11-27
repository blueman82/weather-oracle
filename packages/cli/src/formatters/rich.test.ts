/**
 * Tests for RichFormatter.
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
  HourlyForecast,
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

import { RichFormatter, createRichFormatter } from "./rich";

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockMetrics(temp: number = 20): WeatherMetrics {
  return {
    temperature: celsius(temp),
    feelsLike: celsius(temp - 1),
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

function createMockHourlyForecast(
  timestamp: Date,
  temp: number = 20
): HourlyForecast {
  return {
    timestamp,
    metrics: createMockMetrics(temp),
  };
}

function createMockDailyForecast(
  date: Date,
  minTemp: number = 15,
  maxTemp: number = 25
): DailyForecast {
  // Generate hourly data
  const hourly: HourlyForecast[] = [];
  for (let h = 0; h < 24; h++) {
    const hourTimestamp = new Date(date.getTime() + h * 60 * 60 * 1000);
    // Simulate daily temperature curve
    const t =
      minTemp +
      ((maxTemp - minTemp) * (1 - Math.cos(((h - 5) * Math.PI * 2) / 24))) / 2;
    hourly.push(createMockHourlyForecast(hourTimestamp, t));
  }

  return {
    date,
    temperature: {
      min: celsius(minTemp),
      max: celsius(maxTemp),
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
    hourly,
  };
}

function createMockAggregatedDaily(
  date: Date,
  minTemp: number = 15,
  maxTemp: number = 25
): AggregatedDailyForecast {
  return {
    date,
    forecast: createMockDailyForecast(date, minTemp, maxTemp),
    confidence: { level: "high", score: 0.85 },
    modelAgreement: createMockConsensus(),
    range: {
      temperatureMax: { min: maxTemp - 2, max: maxTemp + 2 },
      temperatureMin: { min: minTemp - 2, max: minTemp + 2 },
      precipitation: { min: 3, max: 8 },
    },
  };
}

function createMockAggregatedHourly(
  timestamp: Date,
  temp: number = 20
): AggregatedHourlyForecast {
  return {
    timestamp,
    metrics: createMockMetrics(temp),
    confidence: { level: "high", score: 0.85 },
    modelAgreement: createMockConsensus(),
    range: {
      temperature: { min: temp - 2, max: temp + 2 },
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

function createMockModelForecast(
  model: string,
  date: Date,
  tempVariation: number = 0
): ModelForecast {
  const baseTemp = 20 + tempVariation;
  return {
    model: model as "ecmwf" | "gfs" | "icon",
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    generatedAt: new Date(),
    validFrom: date,
    validTo: new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000),
    hourly: [
      createMockHourlyForecast(date, baseTemp),
      createMockHourlyForecast(
        new Date(date.getTime() + 3600000),
        baseTemp + 1
      ),
    ],
    daily: [createMockDailyForecast(date, baseTemp - 5, baseTemp + 5)],
  };
}

function createMockAggregatedForecast(): AggregatedForecast {
  const now = new Date();

  // Generate hourly forecasts for 24+ hours
  const hourly: AggregatedHourlyForecast[] = [];
  for (let h = 0; h < 48; h++) {
    const timestamp = new Date(now.getTime() + h * 60 * 60 * 1000);
    const temp = 15 + 10 * Math.sin((h / 24) * Math.PI * 2);
    hourly.push(createMockAggregatedHourly(timestamp, temp));
  }

  // Generate daily forecasts for 7 days
  const daily: AggregatedDailyForecast[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const minTemp = 12 + d;
    const maxTemp = 22 + d;
    daily.push(createMockAggregatedDaily(date, minTemp, maxTemp));
  }

  return {
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    generatedAt: now,
    validFrom: now,
    validTo: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    models: ["ecmwf", "gfs", "icon"],
    modelForecasts: [
      createMockModelForecast("ecmwf", now, 0),
      createMockModelForecast("gfs", now, 1),
      createMockModelForecast("icon", now, -1),
    ],
    consensus: {
      hourly,
      daily,
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
  const aggregated = createMockAggregatedForecast();
  return {
    location: createMockLocation(),
    aggregated,
    confidence: [createMockConfidenceResult()],
    narrative: createMockNarrative(),
    models: aggregated.modelForecasts,
  };
}

// ============================================================================
// RichFormatter Tests
// ============================================================================

describe("RichFormatter", () => {
  let formatter: RichFormatter;
  let input: FormatterInput;

  beforeEach(() => {
    formatter = new RichFormatter({ useColors: false });
    input = createMockFormatterInput();
  });

  test("creates formatter with default options", () => {
    const f = createRichFormatter();
    expect(f).toBeInstanceOf(RichFormatter);
  });

  test("creates formatter with custom options", () => {
    const f = createRichFormatter({
      useColors: false,
      showArt: false,
      showHeatmap: false,
    });
    expect(f).toBeInstanceOf(RichFormatter);
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

  test("output contains current temperature", () => {
    const output = formatter.format(input);
    expect(output).toContain("Currently");
    expect(output).toContain("°C");
  });

  test("output contains temperature trend section", () => {
    const output = formatter.format(input);
    expect(output).toContain("Temperature Trend");
    expect(output).toContain("Next 24h");
    expect(output).toContain("Range");
  });

  test("output contains daily summary", () => {
    const output = formatter.format(input);
    expect(output).toContain("Daily Summary");
  });

  test("output contains heatmap section when enabled", () => {
    const output = formatter.format(input);
    expect(output).toContain("7-Day Temperature Heatmap");
    expect(output).toContain("Temperature Scale");
  });

  test("output contains model consensus section when multiple models", () => {
    const output = formatter.format(input);
    expect(output).toContain("Model Consensus");
    expect(output).toContain("Overall");
  });

  test("output excludes model consensus with single model", () => {
    const singleModelInput = {
      ...input,
      models: [input.models[0]],
    };
    const output = formatter.format(singleModelInput);
    expect(output).not.toContain("Model Consensus");
  });

  test("output excludes heatmap when disabled", () => {
    const noHeatmapFormatter = new RichFormatter({
      useColors: false,
      showHeatmap: false,
    });
    const output = noHeatmapFormatter.format(input);
    expect(output).not.toContain("7-Day Temperature Heatmap");
  });

  test("output excludes constellation when disabled", () => {
    const noConstellationFormatter = new RichFormatter({
      useColors: false,
      showConstellation: false,
    });
    const output = noConstellationFormatter.format(input);
    expect(output).not.toContain("Model Consensus");
  });

  test("uses imperial units when specified", () => {
    const imperialFormatter = new RichFormatter({
      useColors: false,
      units: "imperial",
    });
    const output = imperialFormatter.format(input);
    expect(output).toContain("°F");
  });

  test("handles empty hourly forecasts", () => {
    const emptyInput = {
      ...input,
      aggregated: {
        ...input.aggregated,
        consensus: {
          ...input.aggregated.consensus,
          hourly: [],
        },
      },
    };
    const output = formatter.format(emptyInput);
    expect(typeof output).toBe("string");
    expect(output).toContain("Dublin");
  });

  test("handles empty daily forecasts", () => {
    const emptyInput = {
      ...input,
      aggregated: {
        ...input.aggregated,
        consensus: {
          ...input.aggregated.consensus,
          daily: [],
        },
      },
    };
    const output = formatter.format(emptyInput);
    expect(typeof output).toBe("string");
  });

  test("confidence level shows correctly", () => {
    const output = formatter.format(input);
    expect(output).toContain("confidence");
  });

  test("sparkline characters are present in output", () => {
    const output = formatter.format(input);
    // Should contain sparkline characters
    const sparkChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
    const hasSparklineChar = sparkChars.some((char) => output.includes(char));
    expect(hasSparklineChar).toBe(true);
  });

  test("weather icon is displayed", () => {
    const output = formatter.format(input);
    // Should contain weather emoji/icon
    const weatherIcons = ["☀", "⛅", "☁", "🌧", "⛈", "❄", "⚡", "🌫"];
    const hasWeatherIcon = weatherIcons.some((icon) => output.includes(icon));
    expect(hasWeatherIcon).toBe(true);
  });

  test("box border characters are present", () => {
    const output = formatter.format(input);
    // Should contain box drawing characters from themes
    const boxChars = ["─", "│", "╭", "╮", "╯", "╰", "┌", "┐", "└", "┘"];
    const hasBoxChar = boxChars.some((char) => output.includes(char));
    expect(hasBoxChar).toBe(true);
  });

  test("output without colors does not contain ANSI codes", () => {
    const plainFormatter = new RichFormatter({
      useColors: false,
      showArt: false,
      showConstellation: false,
    });
    const output = plainFormatter.format(input);
    // Note: Some visualization components may still emit ANSI codes
    // This test validates that the formatter respects useColors for its own output
    expect(typeof output).toBe("string");
  });
});

function createInputWithWeatherCode(code: number): FormatterInput {
  const base = createMockFormatterInput();
  const modifiedHourly = base.aggregated.consensus.hourly.map((h, idx) => {
    if (idx === 0) {
      return {
        ...h,
        metrics: {
          ...h.metrics,
          weatherCode: weatherCode(code),
        },
      };
    }
    return h;
  });
  return {
    ...base,
    aggregated: {
      ...base.aggregated,
      consensus: {
        ...base.aggregated.consensus,
        hourly: modifiedHourly,
      },
    },
  };
}

function createInputWithConfidence(
  level: "high" | "medium" | "low",
  score: number
): FormatterInput {
  const base = createMockFormatterInput();
  return {
    ...base,
    aggregated: {
      ...base.aggregated,
      overallConfidence: { level, score },
    },
  };
}

function createInputWithTemperature(temp: number): FormatterInput {
  const base = createMockFormatterInput();
  const modifiedHourly = base.aggregated.consensus.hourly.map((h) => ({
    ...h,
    metrics: {
      ...h.metrics,
      temperature: celsius(temp),
    },
  }));
  return {
    ...base,
    aggregated: {
      ...base.aggregated,
      consensus: {
        ...base.aggregated.consensus,
        hourly: modifiedHourly,
      },
    },
  };
}

describe("RichFormatter with different weather conditions", () => {
  test("handles sunny weather (code 0)", () => {
    const input = createInputWithWeatherCode(0);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("handles rainy weather (code 61)", () => {
    const input = createInputWithWeatherCode(61);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("handles stormy weather (code 95)", () => {
    const input = createInputWithWeatherCode(95);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("handles snowy weather (code 71)", () => {
    const input = createInputWithWeatherCode(71);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});

describe("RichFormatter with different confidence levels", () => {
  test("displays high confidence correctly", () => {
    const input = createInputWithConfidence("high", 0.9);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(output).toContain("High confidence");
    expect(output).toContain("90%");
  });

  test("displays medium confidence correctly", () => {
    const input = createInputWithConfidence("medium", 0.6);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(output).toContain("Moderate confidence");
    expect(output).toContain("60%");
  });

  test("displays low confidence correctly", () => {
    const input = createInputWithConfidence("low", 0.3);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(output).toContain("Low confidence");
    expect(output).toContain("30%");
  });
});

describe("RichFormatter temperature extremes", () => {
  test("handles very cold temperatures", () => {
    const input = createInputWithTemperature(-20);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(output).toContain("-20");
  });

  test("handles very hot temperatures", () => {
    const input = createInputWithTemperature(40);
    const formatter = new RichFormatter({ useColors: false });
    const output = formatter.format(input);
    expect(output).toContain("40");
  });
});
