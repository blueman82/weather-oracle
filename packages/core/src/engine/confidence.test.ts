/**
 * Tests for the confidence calculator module.
 */

import { describe, it, expect } from "bun:test";
import {
  calculateConfidence,
  calculateHourlyConfidence,
  calculateDailyConfidence,
  formatConfidenceSummary,
  getConfidenceEmoji,
  type ConfidenceResult,
} from "./confidence";
import { aggregateForecasts } from "./aggregator";
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

/**
 * Create mock coordinates for testing
 */
function createMockCoordinates(): Coordinates {
  return {
    latitude: latitude(52.6751), // Carlow, Ireland
    longitude: longitude(-6.9261),
  };
}

/**
 * Create mock weather metrics for testing
 */
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

/**
 * Create mock hourly forecast for testing
 */
function createMockHourlyForecast(
  timestamp: Date,
  metricsOverrides: Partial<Parameters<typeof createMockMetrics>[0]> = {}
): HourlyForecast {
  return {
    timestamp,
    metrics: createMockMetrics(metricsOverrides),
  };
}

/**
 * Create mock daily forecast for testing
 */
function createMockDailyForecast(
  date: Date,
  overrides: Partial<{
    tempMin: number;
    tempMax: number;
    precipTotal: number;
    windMaxSpeed: number;
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
      total: millimeters(overrides.precipTotal ?? 2),
      probability: 40,
      hours: 3,
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
    weatherCode: weatherCode(3),
    hourly: [],
  };
}

/**
 * Create mock model forecast for testing
 */
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
// calculateConfidence Tests
// ============================================================================

describe("calculateConfidence", () => {
  describe("temperature metric", () => {
    it("should return high confidence when models strongly agree", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15.0 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15.2 }]),
        createMockModelForecast("icon", [{ temperature: 15.1 }]),
        createMockModelForecast("jma", [{ temperature: 14.9 }]),
        createMockModelForecast("gem", [{ temperature: 15.3 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "temperature");

      expect(result.level).toBe("high");
      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.explanation).toContain("High confidence");
      expect(result.explanation).toContain("models agree");
    });

    it("should return lower confidence when models disagree significantly", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 10 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15 }]),
        createMockModelForecast("icon", [{ temperature: 20 }]),
        createMockModelForecast("jma", [{ temperature: 25 }]),
        createMockModelForecast("gem", [{ temperature: 30 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "temperature");

      // With high spread (stdDev ~7.07), spread factor should be low (0.3)
      // But agreement and time factors still contribute, keeping overall medium
      expect(result.level).not.toBe("high");
      expect(result.score).toBeLessThan(0.8);
    });

    it("should include spread factor in results", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }]),
        createMockModelForecast("ecmwf", [{ temperature: 16 }]),
        createMockModelForecast("icon", [{ temperature: 17 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "temperature");

      const spreadFactor = result.factors.find((f) => f.name === "spread");
      expect(spreadFactor).toBeDefined();
      expect(spreadFactor!.weight).toBe(0.5);
      expect(spreadFactor!.detail).toContain("Spread:");
    });
  });

  describe("precipitation metric", () => {
    it("should handle precipitation confidence", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ precipitation: 2 }]),
        createMockModelForecast("ecmwf", [{ precipitation: 3 }]),
        createMockModelForecast("icon", [{ precipitation: 2.5 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "precipitation");

      expect(result.level).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe("wind metric", () => {
    it("should handle wind confidence", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ windSpeed: 5 }]),
        createMockModelForecast("ecmwf", [{ windSpeed: 5.5 }]),
        createMockModelForecast("icon", [{ windSpeed: 4.5 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "wind");

      expect(result.level).toBeDefined();
      expect(result.factors.find((f) => f.name === "spread")).toBeDefined();
    });
  });

  describe("overall metric", () => {
    it("should calculate overall confidence from all factors", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15, windSpeed: 5, precipitation: 0 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15, windSpeed: 5, precipitation: 0 }]),
        createMockModelForecast("icon", [{ temperature: 15, windSpeed: 5, precipitation: 0 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "overall");

      expect(result.level).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe("time horizon decay", () => {
    it("should reduce confidence for forecasts further ahead", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15 }]),
        createMockModelForecast("icon", [{ temperature: 15 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);

      const today = calculateConfidence(aggregated, "temperature", 0);
      const tomorrow = calculateConfidence(aggregated, "temperature", 1);
      const weekAhead = calculateConfidence(aggregated, "temperature", 7);

      // Confidence should decrease with time
      expect(today.score).toBeGreaterThan(tomorrow.score);
      expect(tomorrow.score).toBeGreaterThan(weekAhead.score);
    });

    it("should include time horizon factor in results", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "temperature", 3);

      const timeFactor = result.factors.find((f) => f.name === "timeHorizon");
      expect(timeFactor).toBeDefined();
      expect(timeFactor!.detail).toContain("3 days ahead");
    });

    it("should cap time decay at maximum days", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);

      const tenDays = calculateConfidence(aggregated, "temperature", 10);
      const twentyDays = calculateConfidence(aggregated, "temperature", 20);

      // Time factor should be the same after max days
      const tenDaysTimeFactor = tenDays.factors.find((f) => f.name === "timeHorizon");
      const twentyDaysTimeFactor = twentyDays.factors.find((f) => f.name === "timeHorizon");

      expect(tenDaysTimeFactor!.score).toBe(twentyDaysTimeFactor!.score);
    });
  });

  describe("factor weights", () => {
    it("should apply correct weights to factors", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }]),
        createMockModelForecast("ecmwf", [{ temperature: 16 }]),
        createMockModelForecast("icon", [{ temperature: 17 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "temperature");

      const spreadFactor = result.factors.find((f) => f.name === "spread");
      const agreementFactor = result.factors.find((f) => f.name === "agreement");
      const timeFactor = result.factors.find((f) => f.name === "timeHorizon");

      // Check weights sum to 1.0
      const totalWeight =
        (spreadFactor?.weight ?? 0) +
        (agreementFactor?.weight ?? 0) +
        (timeFactor?.weight ?? 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);

      // Check individual weights
      expect(spreadFactor!.weight).toBe(0.5);
      expect(agreementFactor!.weight).toBe(0.3);
      expect(timeFactor!.weight).toBe(0.2);
    });

    it("should calculate total score from contributions", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15 }]),
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "temperature");

      const totalContribution = result.factors.reduce(
        (sum, f) => sum + f.contribution,
        0
      );
      expect(result.score).toBeCloseTo(totalContribution, 5);
    });
  });

  describe("model agreement", () => {
    it("should track models in agreement", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("gfs", [{ temperature: 15 }]),
        createMockModelForecast("ecmwf", [{ temperature: 15 }]),
        createMockModelForecast("icon", [{ temperature: 15 }]),
        createMockModelForecast("jma", [{ temperature: 15 }]),
        createMockModelForecast("gem", [{ temperature: 50 }]), // Outlier
      ];

      const aggregated = aggregateForecasts(forecasts);
      const result = calculateConfidence(aggregated, "temperature");

      const agreementFactor = result.factors.find((f) => f.name === "agreement");
      expect(agreementFactor).toBeDefined();
      expect(agreementFactor!.detail).toContain("/5 models agree");
    });
  });
});

// ============================================================================
// calculateHourlyConfidence Tests
// ============================================================================

describe("calculateHourlyConfidence", () => {
  it("should calculate confidence for hourly forecast", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15, windSpeed: 5 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15.2, windSpeed: 5.1 }]),
      createMockModelForecast("icon", [{ temperature: 14.8, windSpeed: 4.9 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];
    const result = calculateHourlyConfidence(hourly, 3, 0);

    expect(result.level).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.explanation).toBeDefined();
  });

  it("should include multiple spread factors", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15, windSpeed: 5, precipitation: 2 }]),
      createMockModelForecast("ecmwf", [{ temperature: 16, windSpeed: 6, precipitation: 3 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];
    const result = calculateHourlyConfidence(hourly, 2);

    const tempSpread = result.factors.find((f) => f.name === "temperatureSpread");
    const precipSpread = result.factors.find((f) => f.name === "precipitationSpread");
    const windSpread = result.factors.find((f) => f.name === "windSpread");

    expect(tempSpread).toBeDefined();
    expect(precipSpread).toBeDefined();
    expect(windSpread).toBeDefined();
  });

  it("should apply time decay", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    const today = calculateHourlyConfidence(hourly, 2, 0);
    const inFiveDays = calculateHourlyConfidence(hourly, 2, 5);

    expect(today.score).toBeGreaterThan(inFiveDays.score);
  });
});

// ============================================================================
// calculateDailyConfidence Tests
// ============================================================================

describe("calculateDailyConfidence", () => {
  it("should calculate confidence for daily forecast", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{}], [{ tempMax: 18 }]),
      createMockModelForecast("ecmwf", [{}], [{ tempMax: 18.5 }]),
      createMockModelForecast("icon", [{}], [{ tempMax: 17.5 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const daily = aggregated.consensus.daily[0];
    const result = calculateDailyConfidence(daily, 3, 0);

    expect(result.level).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("should apply time decay for days ahead", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{}], [{ tempMax: 18 }]),
      createMockModelForecast("ecmwf", [{}], [{ tempMax: 18 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const daily = aggregated.consensus.daily[0];

    const dayOne = calculateDailyConfidence(daily, 2, 1);
    const dayFive = calculateDailyConfidence(daily, 2, 5);

    expect(dayOne.score).toBeGreaterThan(dayFive.score);
  });
});

// ============================================================================
// formatConfidenceSummary Tests
// ============================================================================

describe("formatConfidenceSummary", () => {
  it("should format high confidence correctly", () => {
    const result: ConfidenceResult = {
      level: "high",
      score: 0.85,
      factors: [],
      explanation: "Test",
    };

    const summary = formatConfidenceSummary(result);
    expect(summary).toBe("High (85%)");
  });

  it("should format medium confidence correctly", () => {
    const result: ConfidenceResult = {
      level: "medium",
      score: 0.65,
      factors: [],
      explanation: "Test",
    };

    const summary = formatConfidenceSummary(result);
    expect(summary).toBe("Medium (65%)");
  });

  it("should format low confidence correctly", () => {
    const result: ConfidenceResult = {
      level: "low",
      score: 0.35,
      factors: [],
      explanation: "Test",
    };

    const summary = formatConfidenceSummary(result);
    expect(summary).toBe("Low (35%)");
  });

  it("should round percentages correctly", () => {
    const result: ConfidenceResult = {
      level: "high",
      score: 0.876,
      factors: [],
      explanation: "Test",
    };

    const summary = formatConfidenceSummary(result);
    expect(summary).toBe("High (88%)");
  });
});

// ============================================================================
// getConfidenceEmoji Tests
// ============================================================================

describe("getConfidenceEmoji", () => {
  it("should return check mark for high confidence", () => {
    const emoji = getConfidenceEmoji("high");
    expect(emoji).toBe("\u2705");
  });

  it("should return warning for medium confidence", () => {
    const emoji = getConfidenceEmoji("medium");
    expect(emoji).toBe("\u26A0\uFE0F");
  });

  it("should return question mark for low confidence", () => {
    const emoji = getConfidenceEmoji("low");
    expect(emoji).toBe("\u2753");
  });
});

// ============================================================================
// Confidence Level Boundaries Tests
// ============================================================================

describe("confidence level boundaries", () => {
  it("should classify scores >= 0.8 as high", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15.0 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15.0 }]),
      createMockModelForecast("icon", [{ temperature: 15.0 }]),
      createMockModelForecast("jma", [{ temperature: 15.0 }]),
      createMockModelForecast("gem", [{ temperature: 15.0 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature", 0);

    // With zero spread and full agreement, should be high confidence
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.level).toBe("high");
  });

  it("should classify scores >= 0.5 and < 0.8 as medium", () => {
    // Create moderate disagreement with time decay
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 10 }]),
      createMockModelForecast("ecmwf", [{ temperature: 18 }]),
      createMockModelForecast("icon", [{ temperature: 26 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    // Use more days ahead to reduce time factor
    const result = calculateConfidence(aggregated, "temperature", 5);

    expect(result.level).toBe("medium");
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThan(0.8);
  });

  it("should have lower scores when all factors are poor", () => {
    // Create extreme disagreement with maximum time decay
    // Low confidence requires: low spread score + low agreement + high time decay
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: -10 }]),
      createMockModelForecast("ecmwf", [{ temperature: 10 }]),
      createMockModelForecast("icon", [{ temperature: 30 }]),
      createMockModelForecast("jma", [{ temperature: 50 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    // With max time decay (10 days), time factor = 0.5
    // Spread factor will be 0.3 (low) due to high stddev
    // Agreement factor depends on outlier detection
    const result = calculateConfidence(aggregated, "temperature", 10);

    // With these factors, expect medium or low (not high)
    expect(result.level).not.toBe("high");
    // Score should be below the high threshold
    expect(result.score).toBeLessThan(0.8);
    // Spread factor should be low
    const spreadFactor = result.factors.find((f) => f.name === "spread");
    expect(spreadFactor!.score).toBeLessThanOrEqual(0.5);
  });
});

// ============================================================================
// Explanation Generation Tests
// ============================================================================

describe("explanation generation", () => {
  it("should generate explanation with correct model count", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15 }]),
      createMockModelForecast("icon", [{ temperature: 15 }]),
      createMockModelForecast("jma", [{ temperature: 15 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature");

    expect(result.explanation).toContain("4 models");
  });

  it("should mention metric type in explanation", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const tempResult = calculateConfidence(aggregated, "temperature");
    const windResult = calculateConfidence(aggregated, "wind");
    const overallResult = calculateConfidence(aggregated, "overall");

    expect(tempResult.explanation).toContain("temperature");
    expect(windResult.explanation).toContain("wind");
    expect(overallResult.explanation).toContain("forecast");
  });

  it("should indicate when all models agree", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15 }]),
      createMockModelForecast("icon", [{ temperature: 15 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature");

    expect(result.explanation).toMatch(/All 3 models agree|3 of 3 models agree/);
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("edge cases", () => {
  it("should handle single model forecast", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature");

    expect(result.level).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("should handle two model forecasts", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature");

    expect(result.level).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("should handle zero days ahead", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature", 0);

    const timeFactor = result.factors.find((f) => f.name === "timeHorizon");
    expect(timeFactor!.score).toBe(1.0);
    expect(timeFactor!.detail).toContain("0 days");
  });

  it("should handle 1 day ahead with correct grammar", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15 }]),
      createMockModelForecast("ecmwf", [{ temperature: 15 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature", 1);

    const timeFactor = result.factors.find((f) => f.name === "timeHorizon");
    expect(timeFactor!.detail).toBe("1 day ahead");
  });

  it("should handle extreme temperature disagreement", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: -20 }]),
      createMockModelForecast("ecmwf", [{ temperature: 40 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const result = calculateConfidence(aggregated, "temperature");

    // With extreme spread, spread factor will be 0.3 (low)
    // But 2 models with no outliers means full agreement + time=1.0
    // Overall score ~= 0.3*0.5 + 1.0*0.3 + 1.0*0.2 = 0.65 (medium)
    expect(result.level).not.toBe("high");
    expect(result.score).toBeLessThan(0.8);
  });
});
