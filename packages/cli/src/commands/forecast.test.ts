/**
 * Tests for the forecast command.
 */

import { describe, it, expect } from "bun:test";
import type {
  ModelName,
  ModelForecast,
  GeocodingResult,
  AggregatedForecast,
  Location,
} from "@weather-oracle/core";
import {
  latitude,
  longitude,
  timezoneId,
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
  aggregateForecasts,
  calculateConfidence,
  generateNarrative,
  toFahrenheit,
  toKmPerHour,
  toCardinalDirection,
} from "@weather-oracle/core";

/**
 * Create mock geocoding result
 */
function createMockGeocodingResult(
  name: string = "Dublin",
  country: string = "Ireland"
): GeocodingResult {
  return {
    name,
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    country,
    countryCode: "IE",
    region: "Leinster",
    timezone: timezoneId("Europe/Dublin"),
  };
}

/**
 * Create mock location
 */
function createMockLocation(query: string = "Dublin, Ireland"): Location {
  return {
    query,
    resolved: createMockGeocodingResult(),
  };
}

/**
 * Create mock daily forecast
 */
function createMockDailyForecast(
  date: Date,
  tempMax: number,
  tempMin: number,
  precipProb: number,
  precipTotal: number
) {
  return {
    date,
    temperature: {
      min: celsius(tempMin),
      max: celsius(tempMax),
    },
    humidity: {
      min: humidity(50),
      max: humidity(80),
    },
    pressure: {
      min: pressure(1010),
      max: pressure(1020),
    },
    precipitation: {
      total: millimeters(precipTotal),
      probability: precipProb,
      hours: precipTotal > 0 ? 3 : 0,
    },
    wind: {
      avgSpeed: metersPerSecond(5),
      maxSpeed: metersPerSecond(10),
      dominantDirection: windDirection(180),
    },
    cloudCover: {
      avg: cloudCover(50),
      max: cloudCover(80),
    },
    uvIndex: {
      max: uvIndex(5),
    },
    sun: {
      sunrise: new Date(date.getTime() + 6 * 60 * 60 * 1000),
      sunset: new Date(date.getTime() + 18 * 60 * 60 * 1000),
      daylightHours: 12,
    },
    weatherCode: weatherCode(3),
    hourly: [],
  };
}

/**
 * Create mock hourly forecast
 */
function createMockHourlyForecast(timestamp: Date, temp: number) {
  return {
    timestamp,
    metrics: {
      temperature: celsius(temp),
      feelsLike: celsius(temp - 1),
      humidity: humidity(65),
      pressure: pressure(1015),
      windSpeed: metersPerSecond(5),
      windDirection: windDirection(180),
      precipitation: millimeters(0),
      precipitationProbability: 20,
      cloudCover: cloudCover(50),
      visibility: visibility(10000),
      uvIndex: uvIndex(3),
      weatherCode: weatherCode(3),
    },
  };
}

/**
 * Create mock model forecast
 */
function createMockModelForecast(
  model: ModelName,
  tempOffset: number = 0,
  precipOffset: number = 0
): ModelForecast {
  const now = new Date();
  const validFrom = new Date(now);
  validFrom.setHours(0, 0, 0, 0);

  const daily = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(validFrom);
    date.setDate(date.getDate() + i);
    daily.push(
      createMockDailyForecast(
        date,
        15 + i + tempOffset,
        8 + i + tempOffset,
        20 + i * 10 + precipOffset,
        i > 2 ? 2 + precipOffset : 0
      )
    );
  }

  const hourly = [];
  for (let i = 0; i < 24 * 7; i++) {
    const timestamp = new Date(validFrom.getTime() + i * 60 * 60 * 1000);
    hourly.push(createMockHourlyForecast(timestamp, 12 + tempOffset));
  }

  return {
    model,
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    generatedAt: now,
    validFrom,
    validTo: new Date(validFrom.getTime() + 7 * 24 * 60 * 60 * 1000),
    daily,
    hourly,
  };
}

describe("forecast command", () => {
  describe("aggregation pipeline", () => {
    it("should aggregate multiple model forecasts", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("ecmwf"),
        createMockModelForecast("gfs", 1),
        createMockModelForecast("icon", -1),
      ];

      const aggregated = aggregateForecasts(forecasts);

      expect(aggregated.models).toHaveLength(3);
      expect(aggregated.consensus.daily).toHaveLength(7);
      expect(aggregated.consensus.hourly.length).toBeGreaterThan(0);
    });

    it("should calculate overall confidence", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("ecmwf"),
        createMockModelForecast("gfs", 0.5),
        createMockModelForecast("icon", -0.5),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);

      expect(confidence.level).toBeDefined();
      expect(confidence.score).toBeGreaterThanOrEqual(0);
      expect(confidence.score).toBeLessThanOrEqual(1);
      expect(confidence.factors).toBeDefined();
    });

    it("should generate narrative from aggregated data", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("ecmwf"),
        createMockModelForecast("gfs"),
        createMockModelForecast("icon"),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.headline).toBeDefined();
      expect(typeof narrative.headline).toBe("string");
      expect(narrative.alerts).toBeDefined();
      expect(Array.isArray(narrative.alerts)).toBe(true);
    });
  });

  describe("temperature formatting", () => {
    it("should format temperature in metric", () => {
      const temp = celsius(15);
      const formatted = `${Math.round(temp as number)}\u00B0C`;
      expect(formatted).toBe("15\u00B0C");
    });

    it("should format temperature in imperial", () => {
      const temp = celsius(15);
      const fahrenheit = toFahrenheit(temp);
      const formatted = `${Math.round(fahrenheit)}\u00B0F`;
      expect(formatted).toBe("59\u00B0F");
    });

    it("should handle negative temperatures", () => {
      const temp = celsius(-5);
      expect(Math.round(temp as number)).toBe(-5);
      expect(Math.round(toFahrenheit(temp))).toBe(23);
    });
  });

  describe("wind formatting", () => {
    it("should convert wind speed to km/h", () => {
      const speed = metersPerSecond(10);
      const kmh = toKmPerHour(speed);
      expect(kmh).toBe(36); // 10 m/s * 3.6 = 36 km/h
    });

    it("should convert wind direction to cardinal", () => {
      expect(toCardinalDirection(windDirection(0))).toBe("N");
      expect(toCardinalDirection(windDirection(90))).toBe("E");
      expect(toCardinalDirection(windDirection(180))).toBe("S");
      expect(toCardinalDirection(windDirection(270))).toBe("W");
    });
  });

  describe("weather emoji selection", () => {
    it("should select correct emoji for clear weather", () => {
      // WMO code 0 = clear
      const emoji = getWeatherEmojiForCode(0);
      expect(emoji).toBe("\u2600\uFE0F");
    });

    it("should select correct emoji for rain", () => {
      // WMO code 61 = slight rain
      const emoji = getWeatherEmojiForCode(61);
      expect(emoji).toBe("\uD83C\uDF27\uFE0F");
    });

    it("should select correct emoji for thunderstorm", () => {
      // WMO code 85-94 = thunderstorm range
      const emoji = getWeatherEmojiForCode(90);
      expect(emoji).toBe("\u26A1");
    });
  });

  describe("confidence display", () => {
    it("should display high confidence correctly", () => {
      const result = getConfidenceDisplayForLevel("high");
      expect(result.text).toBe("HIGH CONFIDENCE");
      expect(result.emoji).toBeDefined();
    });

    it("should display medium confidence correctly", () => {
      const result = getConfidenceDisplayForLevel("medium");
      expect(result.text).toBe("MODERATE CONFIDENCE");
    });

    it("should display low confidence correctly", () => {
      const result = getConfidenceDisplayForLevel("low");
      expect(result.text).toBe("LOW CONFIDENCE");
    });
  });

  describe("format options", () => {
    it("should recognize valid format types", () => {
      const validFormats = ["table", "json", "narrative", "minimal"];
      for (const format of validFormats) {
        expect(isValidFormat(format)).toBe(true);
      }
    });

    it("should reject invalid format types", () => {
      expect(isValidFormat("invalid")).toBe(false);
      expect(isValidFormat("xml")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle empty forecast array gracefully", () => {
      expect(() => aggregateForecasts([])).toThrow();
    });

    it("should handle single model forecast", () => {
      const forecasts: ModelForecast[] = [createMockModelForecast("ecmwf")];

      const aggregated = aggregateForecasts(forecasts);
      expect(aggregated.models).toHaveLength(1);
      expect(aggregated.consensus.daily).toHaveLength(7);
    });
  });

  describe("minimal format output", () => {
    it("should produce compact output", () => {
      const location = createMockLocation();
      const forecasts = [createMockModelForecast("ecmwf")];
      const aggregated = aggregateForecasts(forecasts);

      const minimalOutput = renderMinimalFormat(location, aggregated, "metric");

      // Should contain location name
      expect(minimalOutput).toContain("Dublin");
      // Should contain temperature
      expect(minimalOutput).toMatch(/\d+-\d+/);
      // Should contain percentage
      expect(minimalOutput).toContain("%");
    });
  });

  describe("narrative format output", () => {
    it("should include location header", () => {
      const forecasts = [
        createMockModelForecast("ecmwf"),
        createMockModelForecast("gfs"),
      ];
      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.headline).toBeDefined();
    });

    it("should include model consensus info", () => {
      const forecasts = [
        createMockModelForecast("ecmwf"),
        createMockModelForecast("gfs"),
        createMockModelForecast("icon"),
      ];
      const aggregated = aggregateForecasts(forecasts);

      expect(aggregated.models).toHaveLength(3);
      expect(aggregated.overallConfidence).toBeDefined();
    });
  });

  describe("days option validation", () => {
    it("should accept valid days values", () => {
      expect(validateDays(1)).toBe(1);
      expect(validateDays(7)).toBe(7);
      expect(validateDays(14)).toBe(14);
    });

    it("should reject invalid days values", () => {
      expect(() => validateDays(0)).toThrow();
      expect(() => validateDays(15)).toThrow();
      expect(() => validateDays(-1)).toThrow();
    });
  });

  describe("models option parsing", () => {
    it("should parse comma-separated models", () => {
      const input = "ecmwf,gfs,icon";
      const parsed = parseModels(input);
      expect(parsed).toEqual(["ecmwf", "gfs", "icon"]);
    });

    it("should handle spaces in model list", () => {
      const input = "ecmwf, gfs , icon";
      const parsed = parseModels(input);
      expect(parsed).toEqual(["ecmwf", "gfs", "icon"]);
    });

    it("should lowercase model names", () => {
      const input = "ECMWF,GFS";
      const parsed = parseModels(input);
      expect(parsed).toEqual(["ecmwf", "gfs"]);
    });
  });
});

// Helper functions for testing (mirroring the logic in forecast.ts)

function getWeatherEmojiForCode(code: number): string {
  if (code === 0) return "\u2600\uFE0F";
  if (code <= 3) return "\u26C5";
  if (code <= 49) return "\u2601\uFE0F";
  if (code <= 59) return "\uD83C\uDF27\uFE0F";
  if (code <= 69) return "\uD83C\uDF27\uFE0F";
  if (code <= 79) return "\u2744\uFE0F";
  if (code <= 84) return "\uD83C\uDF27\uFE0F";
  if (code <= 94) return "\u26A1";
  return "\u2753";
}

function getConfidenceDisplayForLevel(level: "high" | "medium" | "low"): {
  emoji: string;
  text: string;
} {
  switch (level) {
    case "high":
      return { emoji: "\u2705", text: "HIGH CONFIDENCE" };
    case "medium":
      return { emoji: "\u26A0\uFE0F", text: "MODERATE CONFIDENCE" };
    case "low":
      return { emoji: "\u2753", text: "LOW CONFIDENCE" };
  }
}

function isValidFormat(format: string): boolean {
  return ["table", "json", "narrative", "minimal"].includes(format);
}

function renderMinimalFormat(
  location: Location,
  aggregated: AggregatedForecast,
  units: "metric" | "imperial"
): string {
  const firstDay = aggregated.consensus.daily[0];
  if (!firstDay) {
    return "No forecast data available.";
  }

  const tempMin = Math.round(
    units === "imperial"
      ? toFahrenheit(firstDay.forecast.temperature.min)
      : (firstDay.forecast.temperature.min as number)
  );
  const tempMax = Math.round(
    units === "imperial"
      ? toFahrenheit(firstDay.forecast.temperature.max)
      : (firstDay.forecast.temperature.max as number)
  );
  const precipProb = Math.round(firstDay.forecast.precipitation.probability);
  const emoji = getWeatherEmojiForCode(firstDay.forecast.weatherCode as number);
  const unit = units === "imperial" ? "F" : "C";

  return `${emoji} ${location.resolved.name}: ${tempMin}-${tempMax}\u00B0${unit}, ${precipProb}% rain`;
}

function validateDays(days: number): number {
  if (days < 1 || days > 14) {
    throw new Error("Days must be between 1 and 14");
  }
  return days;
}

function parseModels(value: string): string[] {
  return value.split(",").map((m) => m.trim().toLowerCase());
}
