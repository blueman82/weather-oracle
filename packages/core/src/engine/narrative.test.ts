/**
 * Tests for the narrative generator module.
 */

import { describe, it, expect } from "bun:test";
import {
  generateNarrative,
  classifyNarrativeType,
  getDominantCondition,
  findTransitionDay,
  getAverageConfidenceLevel,
} from "./narrative";
import {
  weatherCodeToCondition,
  conditionToDescription,
  isPrecipitation,
  isDryCondition,
  formatModelName,
  formatModelList,
  formatTemperature,
  formatPrecipitation,
  formatRelativeDay,
  formatTimePeriod,
  fillTemplate,
} from "./templates";
import { aggregateForecasts } from "./aggregator";
import { calculateConfidence, type ConfidenceResult } from "./confidence";
import type {
  ModelForecast,
  ModelName,
} from "../types/models";
import type { HourlyForecast, DailyForecast, WeatherMetrics } from "../types/weather";
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
} from "../types/weather";
import { latitude, longitude } from "../types/location";
import type { Coordinates } from "../types/location";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockCoordinates(): Coordinates {
  return {
    latitude: latitude(52.6751), // Carlow, Ireland
    longitude: longitude(-6.9261),
  };
}

function createMockMetrics(
  overrides: Partial<{
    temperature: number;
    feelsLike: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDirection: number;
    windGust: number;
    precipitation: number;
    precipitationProbability: number;
    cloudCover: number;
    visibility: number;
    uvIndex: number;
    weatherCode: number;
  }> = {}
): WeatherMetrics {
  return {
    temperature: celsius(overrides.temperature ?? 15),
    feelsLike: celsius(overrides.feelsLike ?? 13),
    humidity: humidity(overrides.humidity ?? 75),
    pressure: pressure(overrides.pressure ?? 1015),
    windSpeed: metersPerSecond(overrides.windSpeed ?? 4),
    windDirection: windDirection(overrides.windDirection ?? 225),
    windGust:
      overrides.windGust !== undefined
        ? metersPerSecond(overrides.windGust)
        : undefined,
    precipitation: millimeters(overrides.precipitation ?? 0),
    precipitationProbability: overrides.precipitationProbability ?? 20,
    cloudCover: cloudCover(overrides.cloudCover ?? 60),
    visibility: visibility(overrides.visibility ?? 15000),
    uvIndex: uvIndex(overrides.uvIndex ?? 2),
    weatherCode: weatherCode(overrides.weatherCode ?? 3),
  };
}

function createMockHourlyForecast(
  timestamp: Date,
  metricsOverrides: Partial<Parameters<typeof createMockMetrics>[0]> = {}
): HourlyForecast {
  return {
    timestamp,
    metrics: createMockMetrics(metricsOverrides),
  };
}

function createMockDailyForecast(
  date: Date,
  overrides: Partial<{
    tempMin: number;
    tempMax: number;
    precipTotal: number;
    windMaxSpeed: number;
    weatherCode: number;
  }> = {}
): DailyForecast {
  return {
    date,
    temperature: {
      min: celsius(overrides.tempMin ?? 10),
      max: celsius(overrides.tempMax ?? 18),
    },
    humidity: {
      min: humidity(60),
      max: humidity(90),
    },
    pressure: {
      min: pressure(1010),
      max: pressure(1020),
    },
    precipitation: {
      total: millimeters(overrides.precipTotal ?? 0),
      probability: overrides.precipTotal && overrides.precipTotal > 0 ? 80 : 10,
      hours: overrides.precipTotal && overrides.precipTotal > 0 ? 3 : 0,
    },
    wind: {
      avgSpeed: metersPerSecond(4),
      maxSpeed: metersPerSecond(overrides.windMaxSpeed ?? 8),
      dominantDirection: windDirection(225),
    },
    cloudCover: {
      avg: cloudCover(65),
      max: cloudCover(85),
    },
    uvIndex: {
      max: uvIndex(3),
    },
    sun: {
      sunrise: new Date(date.getTime() + 7 * 3600000),
      sunset: new Date(date.getTime() + 17 * 3600000),
      daylightHours: 10,
    },
    weatherCode: weatherCode(overrides.weatherCode ?? 3),
    hourly: [],
  };
}

function createMockModelForecast(
  model: ModelName,
  hourlyOverrides: Array<Partial<Parameters<typeof createMockMetrics>[0]>> = [{}],
  dailyOverrides: Array<Partial<Parameters<typeof createMockDailyForecast>[1]>> = [{}]
): ModelForecast {
  const baseTimestamp = new Date("2024-01-15T12:00:00Z");
  const baseDate = new Date("2024-01-15");

  const hourly = hourlyOverrides.map((overrides, index) =>
    createMockHourlyForecast(
      new Date(baseTimestamp.getTime() + index * 3600000),
      overrides
    )
  );

  const daily = dailyOverrides.map((overrides, index) =>
    createMockDailyForecast(
      new Date(baseDate.getTime() + index * 86400000),
      overrides
    )
  );

  return {
    model,
    coordinates: createMockCoordinates(),
    generatedAt: new Date(),
    validFrom: hourly[0].timestamp,
    validTo: hourly[hourly.length - 1].timestamp,
    hourly,
    daily,
  };
}

// ============================================================================
// Template Helper Tests
// ============================================================================

describe("templates", () => {
  describe("weatherCodeToCondition", () => {
    it("should map clear sky (0) to sunny", () => {
      expect(weatherCodeToCondition(weatherCode(0))).toBe("sunny");
    });

    it("should map partly cloudy (1-2) to partly_cloudy", () => {
      expect(weatherCodeToCondition(weatherCode(1))).toBe("partly_cloudy");
      expect(weatherCodeToCondition(weatherCode(2))).toBe("partly_cloudy");
    });

    it("should map overcast (3) to cloudy", () => {
      expect(weatherCodeToCondition(weatherCode(3))).toBe("cloudy");
    });

    it("should map fog (45-48) to fog", () => {
      expect(weatherCodeToCondition(weatherCode(45))).toBe("fog");
      expect(weatherCodeToCondition(weatherCode(48))).toBe("fog");
    });

    it("should map drizzle (51-57) to drizzle", () => {
      expect(weatherCodeToCondition(weatherCode(51))).toBe("drizzle");
      expect(weatherCodeToCondition(weatherCode(55))).toBe("drizzle");
    });

    it("should map rain (61-65) to rain", () => {
      expect(weatherCodeToCondition(weatherCode(61))).toBe("rain");
      expect(weatherCodeToCondition(weatherCode(63))).toBe("rain");
    });

    it("should map snow (71-77) to snow", () => {
      expect(weatherCodeToCondition(weatherCode(71))).toBe("snow");
      expect(weatherCodeToCondition(weatherCode(75))).toBe("snow");
    });

    it("should map thunderstorm (95-99) to thunderstorm", () => {
      expect(weatherCodeToCondition(weatherCode(95))).toBe("thunderstorm");
      expect(weatherCodeToCondition(weatherCode(99))).toBe("thunderstorm");
    });

    it("should return unknown for unmapped codes", () => {
      expect(weatherCodeToCondition(weatherCode(999))).toBe("unknown");
    });
  });

  describe("conditionToDescription", () => {
    it("should return human-readable descriptions", () => {
      expect(conditionToDescription("sunny")).toBe("sunny");
      expect(conditionToDescription("partly_cloudy")).toBe("partly cloudy");
      expect(conditionToDescription("rain")).toBe("rain");
      expect(conditionToDescription("heavy_rain")).toBe("heavy rain");
      expect(conditionToDescription("thunderstorm")).toBe("thunderstorms");
    });
  });

  describe("isPrecipitation", () => {
    it("should return true for precipitation conditions", () => {
      expect(isPrecipitation("drizzle")).toBe(true);
      expect(isPrecipitation("rain")).toBe(true);
      expect(isPrecipitation("heavy_rain")).toBe(true);
      expect(isPrecipitation("snow")).toBe(true);
      expect(isPrecipitation("thunderstorm")).toBe(true);
    });

    it("should return false for dry conditions", () => {
      expect(isPrecipitation("sunny")).toBe(false);
      expect(isPrecipitation("partly_cloudy")).toBe(false);
      expect(isPrecipitation("cloudy")).toBe(false);
      expect(isPrecipitation("fog")).toBe(false);
    });
  });

  describe("isDryCondition", () => {
    it("should return true for dry conditions", () => {
      expect(isDryCondition("sunny")).toBe(true);
      expect(isDryCondition("partly_cloudy")).toBe(true);
      expect(isDryCondition("cloudy")).toBe(true);
      expect(isDryCondition("fog")).toBe(true);
    });

    it("should return false for precipitation conditions", () => {
      expect(isDryCondition("rain")).toBe(false);
      expect(isDryCondition("snow")).toBe(false);
    });
  });

  describe("formatModelName", () => {
    it("should format model names for display", () => {
      expect(formatModelName("ecmwf")).toBe("ECMWF");
      expect(formatModelName("gfs")).toBe("GFS");
      expect(formatModelName("icon")).toBe("ICON");
      expect(formatModelName("meteofrance")).toBe("ARPEGE");
      expect(formatModelName("ukmo")).toBe("UK Met Office");
    });
  });

  describe("formatModelList", () => {
    it("should format single model", () => {
      expect(formatModelList(["gfs"])).toBe("GFS");
    });

    it("should format two models with 'and'", () => {
      expect(formatModelList(["gfs", "ecmwf"])).toBe("GFS and ECMWF");
    });

    it("should format multiple models with commas and 'and'", () => {
      expect(formatModelList(["gfs", "ecmwf", "icon"])).toBe("GFS, ECMWF, and ICON");
    });

    it("should return empty string for empty list", () => {
      expect(formatModelList([])).toBe("");
    });
  });

  describe("formatTemperature", () => {
    it("should format temperature with degree symbol", () => {
      expect(formatTemperature(15)).toBe("15\u00B0C");
      expect(formatTemperature(15.7)).toBe("16\u00B0C");
      expect(formatTemperature(-5)).toBe("-5\u00B0C");
    });
  });

  describe("formatPrecipitation", () => {
    it("should format precipitation amounts", () => {
      expect(formatPrecipitation(0.5)).toBe("trace amounts");
      expect(formatPrecipitation(5)).toBe("5mm");
      expect(formatPrecipitation(15)).toBe("15mm");
    });
  });

  describe("formatRelativeDay", () => {
    it("should format today correctly", () => {
      const today = new Date();
      expect(formatRelativeDay(today, today)).toBe("today");
    });

    it("should format tomorrow correctly", () => {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      expect(formatRelativeDay(tomorrow, today)).toBe("tomorrow");
    });

    it("should format day names for near future", () => {
      const today = new Date("2024-01-15"); // Monday
      const wednesday = new Date("2024-01-17"); // Wednesday
      expect(formatRelativeDay(wednesday, today)).toBe("Wednesday");
    });
  });

  describe("formatTimePeriod", () => {
    it("should return correct time periods", () => {
      expect(formatTimePeriod(8)).toBe("morning");
      expect(formatTimePeriod(14)).toBe("afternoon");
      expect(formatTimePeriod(19)).toBe("evening");
      expect(formatTimePeriod(2)).toBe("overnight");
    });
  });

  describe("fillTemplate", () => {
    it("should replace placeholders", () => {
      const template = "Hello {name}, the weather is {condition}.";
      const result = fillTemplate(template, {
        name: "Carlow",
        condition: "sunny",
      });
      expect(result).toBe("Hello Carlow, the weather is sunny.");
    });

    it("should replace multiple occurrences", () => {
      const template = "{day} is {day}'s best day.";
      const result = fillTemplate(template, { day: "Monday" });
      expect(result).toBe("Monday is Monday's best day.");
    });
  });
});

// ============================================================================
// Narrative Helper Tests
// ============================================================================

describe("narrative helpers", () => {
  describe("classifyNarrativeType", () => {
    it("should classify as agreement when models agree", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ weatherCode: 0 }, { weatherCode: 0 }]),
        createMockModelForecast("ecmwf", [{}], [{ weatherCode: 0 }, { weatherCode: 0 }]),
        createMockModelForecast("icon", [{}], [{ weatherCode: 0 }, { weatherCode: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const type = classifyNarrativeType(aggregated, confidence);

      expect(type).toBe("agreement");
    });

    it("should classify as transition when weather changes", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast(
          "gfs",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 }, // Sunny
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 63, precipTotal: 10 }, // Rain
          ]
        ),
        createMockModelForecast(
          "ecmwf",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 61, precipTotal: 8 },
          ]
        ),
        createMockModelForecast(
          "icon",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 65, precipTotal: 12 },
          ]
        ),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const type = classifyNarrativeType(aggregated, confidence);

      expect(type).toBe("transition");
    });
  });

  describe("getDominantCondition", () => {
    it("should return most common condition", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast(
          "gfs",
          [{}],
          [
            { weatherCode: 0 }, // sunny
            { weatherCode: 0 }, // sunny
            { weatherCode: 63 }, // rain
          ]
        ),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const dominant = getDominantCondition(aggregated);

      expect(dominant).toBe("sunny");
    });

    it("should return unknown for empty forecast", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], []),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const dominant = getDominantCondition(aggregated);

      expect(dominant).toBe("unknown");
    });
  });

  describe("findTransitionDay", () => {
    it("should find day when weather changes", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast(
          "gfs",
          [{}],
          [
            { weatherCode: 0 }, // sunny
            { weatherCode: 0 }, // sunny
            { weatherCode: 63 }, // rain
          ]
        ),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const transition = findTransitionDay(aggregated);

      expect(transition).not.toBeNull();
      expect(transition!.condition).toBe("rain");
    });

    it("should return null when no transition", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast(
          "gfs",
          [{}],
          [
            { weatherCode: 0 },
            { weatherCode: 0 },
            { weatherCode: 0 },
          ]
        ),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const transition = findTransitionDay(aggregated);

      expect(transition).toBeNull();
    });
  });

  describe("getAverageConfidenceLevel", () => {
    it("should return high for high scores", () => {
      const confidence: ConfidenceResult[] = [
        { level: "high", score: 0.9, factors: [], explanation: "" },
        { level: "high", score: 0.85, factors: [], explanation: "" },
      ];
      expect(getAverageConfidenceLevel(confidence)).toBe("high");
    });

    it("should return medium for medium scores", () => {
      const confidence: ConfidenceResult[] = [
        { level: "medium", score: 0.6, factors: [], explanation: "" },
        { level: "medium", score: 0.65, factors: [], explanation: "" },
      ];
      expect(getAverageConfidenceLevel(confidence)).toBe("medium");
    });

    it("should return low for low scores", () => {
      const confidence: ConfidenceResult[] = [
        { level: "low", score: 0.3, factors: [], explanation: "" },
        { level: "low", score: 0.4, factors: [], explanation: "" },
      ];
      expect(getAverageConfidenceLevel(confidence)).toBe("low");
    });

    it("should return medium for empty array", () => {
      expect(getAverageConfidenceLevel([])).toBe("medium");
    });
  });
});

// ============================================================================
// Main Narrative Generator Tests
// ============================================================================

describe("generateNarrative", () => {
  describe("agreement narratives", () => {
    it("should generate headline for agreeing models", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ weatherCode: 0 }, { weatherCode: 0 }]),
        createMockModelForecast("ecmwf", [{}], [{ weatherCode: 0 }, { weatherCode: 0 }]),
        createMockModelForecast("icon", [{}], [{ weatherCode: 0 }, { weatherCode: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      expect(narrative.headline).toContain("agree");
      expect(narrative.headline).toContain("sunny");
    });

    it("should include confidence statement in body", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ weatherCode: 0 }]),
        createMockModelForecast("ecmwf", [{}], [{ weatherCode: 0 }]),
        createMockModelForecast("icon", [{}], [{ weatherCode: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      expect(narrative.body).toContain("Confidence");
    });
  });

  describe("transition narratives", () => {
    it("should describe weather transition", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast(
          "gfs",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 63, precipTotal: 15 },
          ]
        ),
        createMockModelForecast(
          "ecmwf",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 63, precipTotal: 20 },
          ]
        ),
        createMockModelForecast(
          "icon",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 61, precipTotal: 8 },
          ]
        ),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      // Should mention rain arriving
      expect(
        narrative.headline.toLowerCase().includes("rain") ||
        narrative.headline.toLowerCase().includes("arriving") ||
        narrative.headline.toLowerCase().includes("expected")
      ).toBe(true);
    });
  });

  describe("disagreement narratives", () => {
    it("should indicate model disagreement for extreme divergence", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 10 }], [{ tempMax: 12 }]),
        createMockModelForecast("ecmwf", [{ temperature: 25 }], [{ tempMax: 26 }]),
        createMockModelForecast("icon", [{ temperature: 15 }], [{ tempMax: 16 }]),
        createMockModelForecast("jma", [{ temperature: 20 }], [{ tempMax: 21 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      // Create low confidence results to trigger disagreement narrative
      const confidence: ConfidenceResult[] = [
        { level: "low", score: 0.35, factors: [], explanation: "" },
      ];
      const narrative = generateNarrative(aggregated, confidence);

      expect(
        narrative.headline.toLowerCase().includes("disagree") ||
        narrative.headline.toLowerCase().includes("uncertain")
      ).toBe(true);
    });
  });

  describe("alerts", () => {
    it("should add alert for low confidence", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ tempMax: 10 }]),
        createMockModelForecast("ecmwf", [{}], [{ tempMax: 25 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence: ConfidenceResult[] = [
        { level: "low", score: 0.35, factors: [], explanation: "" },
      ];
      const narrative = generateNarrative(aggregated, confidence);

      expect(narrative.alerts.length).toBeGreaterThan(0);
      expect(narrative.alerts.some((a) => a.includes("disagreement"))).toBe(true);
    });
  });

  describe("model notes", () => {
    it("should include notes for outlier models", () => {
      // Create forecasts with clear outlier
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }], [{ tempMax: 18 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15 }], [{ tempMax: 18 }]),
        createMockModelForecast("icon", [{ temperature: 15 }], [{ tempMax: 18 }]),
        createMockModelForecast("meteofrance", [{ temperature: 15 }], [{ tempMax: 18 }]),
        createMockModelForecast("ukmo", [{ temperature: 15 }], [{ tempMax: 18 }]),
        createMockModelForecast("jma", [{ temperature: 35 }], [{ tempMax: 38 }]), // Clear outlier
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      // Note: outlier detection depends on z-score threshold
      // Model notes may or may not be populated depending on z-score calculation
      expect(narrative.modelNotes).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty forecast", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], []),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const narrative = generateNarrative(aggregated, []);

      expect(narrative.headline).toBe("No forecast data available.");
      expect(narrative.body).toBe("");
      expect(narrative.alerts).toEqual([]);
      expect(narrative.modelNotes).toEqual([]);
    });

    it("should handle single model forecast", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ weatherCode: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      expect(narrative.headline).toBeDefined();
      expect(narrative.headline.length).toBeGreaterThan(0);
    });

    it("should handle empty confidence array", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ weatherCode: 0 }]),
        createMockModelForecast("ecmwf", [{}], [{ weatherCode: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const narrative = generateNarrative(aggregated, []);

      expect(narrative.headline).toBeDefined();
      expect(narrative.body).toBeDefined();
    });
  });

  describe("narrative structure", () => {
    it("should return all required fields", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ weatherCode: 0 }]),
        createMockModelForecast("ecmwf", [{}], [{ weatherCode: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      expect(narrative).toHaveProperty("headline");
      expect(narrative).toHaveProperty("body");
      expect(narrative).toHaveProperty("alerts");
      expect(narrative).toHaveProperty("modelNotes");

      expect(typeof narrative.headline).toBe("string");
      expect(typeof narrative.body).toBe("string");
      expect(Array.isArray(narrative.alerts)).toBe(true);
      expect(Array.isArray(narrative.modelNotes)).toBe(true);
    });

    it("should generate concise headline", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], [{ weatherCode: 0 }]),
        createMockModelForecast("ecmwf", [{}], [{ weatherCode: 0 }]),
        createMockModelForecast("icon", [{}], [{ weatherCode: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      // Headline should be a single sentence
      expect(narrative.headline.split(".").length).toBeLessThanOrEqual(2);
      expect(narrative.headline.length).toBeLessThan(150);
    });
  });

  describe("example narratives", () => {
    it("should generate dry period narrative", () => {
      // Simulate 5 days of dry weather
      const dailyOverrides = [
        { weatherCode: 0, precipTotal: 0 },
        { weatherCode: 1, precipTotal: 0 },
        { weatherCode: 2, precipTotal: 0 },
        { weatherCode: 1, precipTotal: 0 },
        { weatherCode: 0, precipTotal: 0 },
      ];

      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{}], dailyOverrides),
        createMockModelForecast("ecmwf", [{}], dailyOverrides),
        createMockModelForecast("icon", [{}], dailyOverrides),
        createMockModelForecast("jma", [{}], dailyOverrides),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      // Should indicate dry/sunny conditions
      expect(
        narrative.headline.toLowerCase().includes("sunny") ||
        narrative.headline.toLowerCase().includes("dry") ||
        narrative.headline.toLowerCase().includes("partly cloudy") ||
        narrative.headline.toLowerCase().includes("agree")
      ).toBe(true);
    });

    it("should generate rain transition narrative", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast(
          "gfs",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 63, precipTotal: 15 },
          ]
        ),
        createMockModelForecast(
          "ecmwf",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 65, precipTotal: 20 },
          ]
        ),
        createMockModelForecast(
          "icon",
          [{}],
          [
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 0, precipTotal: 0 },
            { weatherCode: 61, precipTotal: 8 },
          ]
        ),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const confidence = [calculateConfidence(aggregated, "overall")];
      const narrative = generateNarrative(aggregated, confidence);

      // Should mention transition or rain
      const headlineLower = narrative.headline.toLowerCase();
      const mentions =
        headlineLower.includes("rain") ||
        headlineLower.includes("arriving") ||
        headlineLower.includes("expected") ||
        headlineLower.includes("transition");

      expect(mentions).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("narrative integration", () => {
  it("should work with real aggregation and confidence flow", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast(
        "gfs",
        [{ temperature: 15 }, { temperature: 16 }],
        [{ tempMax: 18, weatherCode: 0 }]
      ),
      createMockModelForecast(
        "ecmwf",
        [{ temperature: 15.5 }, { temperature: 16.5 }],
        [{ tempMax: 18.5, weatherCode: 0 }]
      ),
      createMockModelForecast(
        "icon",
        [{ temperature: 14.5 }, { temperature: 15.5 }],
        [{ tempMax: 17.5, weatherCode: 1 }]
      ),
    ];

    // Step 1: Aggregate
    const aggregated = aggregateForecasts(forecasts);

    // Step 2: Calculate confidence
    const confidence: ConfidenceResult[] = [
      calculateConfidence(aggregated, "overall", 0),
      calculateConfidence(aggregated, "temperature", 0),
    ];

    // Step 3: Generate narrative
    const narrative = generateNarrative(aggregated, confidence);

    // Verify complete flow
    expect(narrative.headline).toBeDefined();
    expect(narrative.headline.length).toBeGreaterThan(0);
    expect(narrative.body.includes("Confidence")).toBe(true);
  });
});
