/**
 * Tests for the multi-model aggregation engine.
 */

import { describe, it, expect } from "bun:test";
import {
  aggregateForecasts,
  identifyOutliers,
  calculateSpread,
} from "./aggregator";
import {
  mean,
  median,
  stdDev,
  trimmedMean,
  findOutlierIndices,
  ensembleProbability,
  confidenceFromStdDev,
  confidenceFromRange,
} from "./statistics";
import type { ModelForecast, ModelName } from "../types/models";
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
    latitude: latitude(40.7128),
    longitude: longitude(-74.006),
  };
}

/**
 * Create mock weather metrics for testing
 */
function createMockMetrics(overrides: Partial<{
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
}> = {}): WeatherMetrics {
  return {
    temperature: celsius(overrides.temperature ?? 20),
    feelsLike: celsius(overrides.feelsLike ?? 18),
    humidity: humidity(overrides.humidity ?? 65),
    pressure: pressure(overrides.pressure ?? 1013),
    windSpeed: metersPerSecond(overrides.windSpeed ?? 5),
    windDirection: windDirection(overrides.windDirection ?? 180),
    windGust: overrides.windGust !== undefined
      ? metersPerSecond(overrides.windGust)
      : undefined,
    precipitation: millimeters(overrides.precipitation ?? 0),
    precipitationProbability: overrides.precipitationProbability ?? 10,
    cloudCover: cloudCover(overrides.cloudCover ?? 50),
    visibility: visibility(overrides.visibility ?? 10000),
    uvIndex: uvIndex(overrides.uvIndex ?? 3),
    weatherCode: weatherCode(overrides.weatherCode ?? 1),
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
      min: celsius(overrides.tempMin ?? 15),
      max: celsius(overrides.tempMax ?? 25),
    },
    humidity: {
      min: humidity(50),
      max: humidity(80),
    },
    pressure: {
      min: pressure(1010),
      max: pressure(1015),
    },
    precipitation: {
      total: millimeters(overrides.precipTotal ?? 0),
      probability: 20,
      hours: 0,
    },
    wind: {
      avgSpeed: metersPerSecond(5),
      maxSpeed: metersPerSecond(overrides.windMaxSpeed ?? 10),
      dominantDirection: windDirection(180),
    },
    cloudCover: {
      avg: cloudCover(50),
      max: cloudCover(70),
    },
    uvIndex: {
      max: uvIndex(5),
    },
    sun: {
      sunrise: new Date(date.getTime() + 6 * 3600000),
      sunset: new Date(date.getTime() + 18 * 3600000),
      daylightHours: 12,
    },
    weatherCode: weatherCode(1),
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
  const baseTimestamp = new Date("2024-01-15T00:00:00Z");
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
// Statistics Tests
// ============================================================================

describe("statistics", () => {
  describe("mean", () => {
    it("should calculate arithmetic mean", () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10, 20, 30])).toBe(20);
    });

    it("should return 0 for empty array", () => {
      expect(mean([])).toBe(0);
    });

    it("should handle single value", () => {
      expect(mean([42])).toBe(42);
    });

    it("should handle negative numbers", () => {
      expect(mean([-5, 0, 5])).toBe(0);
    });
  });

  describe("median", () => {
    it("should calculate median for odd-length array", () => {
      expect(median([1, 2, 3, 4, 5])).toBe(3);
      expect(median([5, 1, 3])).toBe(3);
    });

    it("should calculate median for even-length array", () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
      expect(median([10, 20, 30, 40])).toBe(25);
    });

    it("should return 0 for empty array", () => {
      expect(median([])).toBe(0);
    });

    it("should handle single value", () => {
      expect(median([42])).toBe(42);
    });
  });

  describe("stdDev", () => {
    it("should calculate standard deviation", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      expect(stdDev(values)).toBeCloseTo(2, 1);
    });

    it("should return 0 for empty or single-value array", () => {
      expect(stdDev([])).toBe(0);
      expect(stdDev([42])).toBe(0);
    });

    it("should return 0 for identical values", () => {
      expect(stdDev([5, 5, 5, 5])).toBe(0);
    });
  });

  describe("trimmedMean", () => {
    it("should calculate trimmed mean excluding extremes", () => {
      // With 10% trim, should exclude highest and lowest
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // 100 is outlier
      const result = trimmedMean(values, 0.1);
      // After trimming, we get [2, 3, 4, 5, 6, 7, 8, 9]
      expect(result).toBeCloseTo(5.5, 1);
    });

    it("should handle small arrays", () => {
      expect(trimmedMean([1, 2])).toBe(1.5);
      expect(trimmedMean([42])).toBe(42);
      expect(trimmedMean([])).toBe(0);
    });

    it("should be robust to outliers", () => {
      // With 6 values and 15% trim, we trim 1 from each end
      const valuesWithOutlier = [20, 21, 22, 23, 24, 100];
      const valuesWithoutOutlier = [20, 21, 22, 23, 24, 25];

      const trimmedWithOutlier = trimmedMean(valuesWithOutlier, 0.15);
      const trimmedWithoutOutlier = trimmedMean(valuesWithoutOutlier, 0.15);

      // After trimming: [21, 22, 23, 24] for both, so means should be equal
      expect(trimmedWithOutlier).toBeCloseTo(22.5, 1);
      expect(trimmedWithoutOutlier).toBeCloseTo(22.5, 1);
    });
  });

  describe("calculateSpread", () => {
    it("should calculate all spread metrics", () => {
      const values = [10, 20, 30, 40, 50];
      const spread = calculateSpread(values);

      expect(spread.mean).toBe(30);
      expect(spread.median).toBe(30);
      expect(spread.min).toBe(10);
      expect(spread.max).toBe(50);
      expect(spread.range).toBe(40);
      expect(spread.stdDev).toBeGreaterThan(0);
    });

    it("should handle empty array", () => {
      const spread = calculateSpread([]);

      expect(spread.mean).toBe(0);
      expect(spread.median).toBe(0);
      expect(spread.min).toBe(0);
      expect(spread.max).toBe(0);
      expect(spread.range).toBe(0);
      expect(spread.stdDev).toBe(0);
    });
  });

  describe("findOutlierIndices", () => {
    it("should identify outliers using z-score", () => {
      // Values where 100 is clearly an outlier
      const values = [10, 11, 12, 13, 14, 100];
      const outliers = findOutlierIndices(values, 2.0);

      expect(outliers).toContain(5); // Index of 100
    });

    it("should return empty array for small datasets", () => {
      expect(findOutlierIndices([1, 2])).toEqual([]);
      expect(findOutlierIndices([1])).toEqual([]);
    });

    it("should return empty array for identical values", () => {
      expect(findOutlierIndices([5, 5, 5, 5, 5])).toEqual([]);
    });

    it("should respect threshold parameter", () => {
      const values = [10, 11, 12, 13, 20];

      // With high threshold, no outliers
      const highThreshold = findOutlierIndices(values, 3.0);

      // With low threshold, 20 might be outlier
      const lowThreshold = findOutlierIndices(values, 1.5);

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  describe("ensembleProbability", () => {
    it("should calculate percentage of values exceeding threshold", () => {
      const values = [0, 0, 0.5, 1.0, 2.0]; // 3 out of 5 > 0.1
      const probability = ensembleProbability(values, 0.1, "gt");

      expect(probability).toBe(60);
    });

    it("should handle all values meeting condition", () => {
      const values = [1, 2, 3, 4, 5];
      expect(ensembleProbability(values, 0, "gt")).toBe(100);
    });

    it("should handle no values meeting condition", () => {
      const values = [1, 2, 3, 4, 5];
      expect(ensembleProbability(values, 10, "gt")).toBe(0);
    });

    it("should support different comparison operators", () => {
      const values = [1, 2, 3, 4, 5];

      expect(ensembleProbability(values, 3, "gt")).toBe(40); // 4, 5
      expect(ensembleProbability(values, 3, "gte")).toBe(60); // 3, 4, 5
      expect(ensembleProbability(values, 3, "lt")).toBe(40); // 1, 2
      expect(ensembleProbability(values, 3, "lte")).toBe(60); // 1, 2, 3
    });

    it("should return 0 for empty array", () => {
      expect(ensembleProbability([], 0.1, "gt")).toBe(0);
    });
  });

  describe("confidenceFromStdDev", () => {
    it("should return 1.0 for low stdDev", () => {
      expect(confidenceFromStdDev(1.0, 1.5, 4.0)).toBe(1.0);
    });

    it("should return 0.3 for high stdDev", () => {
      expect(confidenceFromStdDev(5.0, 1.5, 4.0)).toBe(0.3);
    });

    it("should interpolate for middle values", () => {
      const confidence = confidenceFromStdDev(2.75, 1.5, 4.0);
      expect(confidence).toBeGreaterThan(0.3);
      expect(confidence).toBeLessThan(1.0);
    });
  });

  describe("confidenceFromRange", () => {
    it("should return 1.0 for small range", () => {
      expect(confidenceFromRange(5, 10, 25)).toBe(1.0);
    });

    it("should return 0.3 for large range", () => {
      expect(confidenceFromRange(30, 10, 25)).toBe(0.3);
    });

    it("should interpolate for middle values", () => {
      const confidence = confidenceFromRange(17.5, 10, 25);
      expect(confidence).toBeGreaterThan(0.3);
      expect(confidence).toBeLessThan(1.0);
    });
  });
});

// ============================================================================
// Aggregator Tests
// ============================================================================

describe("aggregateForecasts", () => {
  it("should aggregate multiple model forecasts", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }], [{ tempMax: 25 }]),
      createMockModelForecast("ecmwf", [{ temperature: 21 }], [{ tempMax: 26 }]),
      createMockModelForecast("icon", [{ temperature: 22 }], [{ tempMax: 24 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);

    expect(aggregated.models).toEqual(["gfs", "ecmwf", "icon"]);
    expect(aggregated.modelForecasts.length).toBe(3);
    expect(aggregated.consensus.hourly.length).toBeGreaterThan(0);
    expect(aggregated.consensus.daily.length).toBeGreaterThan(0);
  });

  it("should use trimmed mean for temperature", () => {
    // Create forecasts with one outlier - need enough models for trimming to work
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }]),
      createMockModelForecast("ecmwf", [{ temperature: 21 }]),
      createMockModelForecast("icon", [{ temperature: 22 }]),
      createMockModelForecast("jma", [{ temperature: 50 }]), // Outlier
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    // With 4 values [20, 21, 22, 50], trimmed mean removes 1 from each end
    // Remaining: [21, 22], mean = 21.5
    expect(hourly.metrics.temperature).toBeCloseTo(21.5, 1);
  });

  it("should use median for wind speed", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ windSpeed: 5 }]),
      createMockModelForecast("ecmwf", [{ windSpeed: 6 }]),
      createMockModelForecast("icon", [{ windSpeed: 7 }]),
      createMockModelForecast("jma", [{ windSpeed: 20 }]), // Outlier
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    // Median of [5, 6, 7, 20] = 6.5
    expect(hourly.metrics.windSpeed).toBeCloseTo(6.5, 1);
  });

  it("should calculate ensemble probability for precipitation", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ precipitation: 0 }]),
      createMockModelForecast("ecmwf", [{ precipitation: 0.5 }]),
      createMockModelForecast("icon", [{ precipitation: 1.0 }]),
      createMockModelForecast("jma", [{ precipitation: 2.0 }]),
      createMockModelForecast("gem", [{ precipitation: 0 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    // 3 out of 5 models predict > 0.1mm = 60%
    expect(hourly.metrics.precipitationProbability).toBe(60);
  });

  it("should calculate model agreement and identify outliers", () => {
    // Need more extreme outlier to trigger z-score > 2
    // With values [20, 20, 20, 20, 20, 100], stdDev is higher
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20 }]),
      createMockModelForecast("icon", [{ temperature: 20 }]),
      createMockModelForecast("meteofrance", [{ temperature: 20 }]),
      createMockModelForecast("ukmo", [{ temperature: 20 }]),
      createMockModelForecast("jma", [{ temperature: 100 }]), // Clear outlier
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    expect(hourly.modelAgreement.outlierModels).toContain("jma");
    expect(hourly.modelAgreement.modelsInAgreement.length).toBeGreaterThan(0);
  });

  it("should include range information", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 15, windSpeed: 3 }]),
      createMockModelForecast("ecmwf", [{ temperature: 25, windSpeed: 8 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    expect(hourly.range.temperature.min).toBe(15);
    expect(hourly.range.temperature.max).toBe(25);
    expect(hourly.range.windSpeed.min).toBe(3);
    expect(hourly.range.windSpeed.max).toBe(8);
  });

  it("should calculate confidence levels", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20.5 }]),
      createMockModelForecast("icon", [{ temperature: 21 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);

    expect(aggregated.overallConfidence.level).toBeDefined();
    expect(aggregated.overallConfidence.score).toBeGreaterThanOrEqual(0);
    expect(aggregated.overallConfidence.score).toBeLessThanOrEqual(1);
  });

  it("should calculate model weights", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs"),
      createMockModelForecast("ecmwf"),
      createMockModelForecast("icon"),
    ];

    const aggregated = aggregateForecasts(forecasts);

    expect(aggregated.modelWeights.length).toBe(3);
    expect(aggregated.modelWeights[0].weight).toBeCloseTo(1 / 3, 5);
  });

  it("should preserve individual model forecasts", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs"),
      createMockModelForecast("ecmwf"),
    ];

    const aggregated = aggregateForecasts(forecasts);

    expect(aggregated.modelForecasts.length).toBe(2);
    expect(aggregated.modelForecasts[0].model).toBe("gfs");
    expect(aggregated.modelForecasts[1].model).toBe("ecmwf");
  });

  it("should throw error for empty forecast array", () => {
    expect(() => aggregateForecasts([])).toThrow(
      "Cannot aggregate empty forecast array"
    );
  });

  it("should handle single model forecast", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);

    expect(aggregated.models).toEqual(["gfs"]);
    expect(aggregated.consensus.hourly[0].metrics.temperature).toBe(celsius(20));
  });

  it("should aggregate daily forecasts correctly", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{}], [{ tempMax: 25, precipTotal: 0 }]),
      createMockModelForecast("ecmwf", [{}], [{ tempMax: 26, precipTotal: 5 }]),
      createMockModelForecast("icon", [{}], [{ tempMax: 24, precipTotal: 10 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const daily = aggregated.consensus.daily[0];

    expect(daily.forecast.temperature.max).toBeGreaterThan(0);
    expect(daily.modelAgreement.temperatureStats).toBeDefined();
    expect(daily.range.temperatureMax.min).toBe(24);
    expect(daily.range.temperatureMax.max).toBe(26);
  });

  it("should sort hourly and daily forecasts by time", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast(
        "gfs",
        [{ temperature: 20 }, { temperature: 21 }, { temperature: 22 }]
      ),
    ];

    const aggregated = aggregateForecasts(forecasts);

    for (let i = 1; i < aggregated.consensus.hourly.length; i++) {
      const prev = aggregated.consensus.hourly[i - 1].timestamp.getTime();
      const curr = aggregated.consensus.hourly[i].timestamp.getTime();
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

describe("identifyOutliers", () => {
  it("should identify outlier models across forecasts", () => {
    // Need more values for reliable z-score detection
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20 }]),
      createMockModelForecast("icon", [{ temperature: 20 }]),
      createMockModelForecast("meteofrance", [{ temperature: 20 }]),
      createMockModelForecast("ukmo", [{ temperature: 20 }]),
      createMockModelForecast("jma", [{ temperature: 100 }]), // Extreme outlier
    ];

    const outliers = identifyOutliers(forecasts);

    expect(outliers.length).toBeGreaterThan(0);
    expect(outliers.some((o) => o.model === "jma")).toBe(true);
    expect(outliers.some((o) => o.metric === "temperature")).toBe(true);
  });

  it("should return empty array for 2 or fewer models", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }]),
      createMockModelForecast("ecmwf", [{ temperature: 50 }]),
    ];

    const outliers = identifyOutliers(forecasts);
    expect(outliers).toEqual([]);
  });

  it("should include z-score in outlier info", () => {
    // Need more values for z-score > 2
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20 }]),
      createMockModelForecast("icon", [{ temperature: 20 }]),
      createMockModelForecast("meteofrance", [{ temperature: 20 }]),
      createMockModelForecast("ukmo", [{ temperature: 20 }]),
      createMockModelForecast("jma", [{ temperature: 100 }]),
    ];

    const outliers = identifyOutliers(forecasts);
    const jmaOutlier = outliers.find((o) => o.model === "jma");

    expect(jmaOutlier).toBeDefined();
    expect(Math.abs(jmaOutlier!.zScore)).toBeGreaterThan(2);
  });

  it("should detect outliers in multiple metrics", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20, windSpeed: 5 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20, windSpeed: 5 }]),
      createMockModelForecast("icon", [{ temperature: 20, windSpeed: 5 }]),
      createMockModelForecast("meteofrance", [{ temperature: 20, windSpeed: 5 }]),
      createMockModelForecast("ukmo", [{ temperature: 20, windSpeed: 5 }]),
      createMockModelForecast("jma", [{ temperature: 100, windSpeed: 50 }]),
    ];

    const outliers = identifyOutliers(forecasts);

    expect(outliers.some((o) => o.metric === "temperature")).toBe(true);
    expect(outliers.some((o) => o.metric === "windSpeed")).toBe(true);
  });

  it("should detect outliers in daily forecasts", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{}], [{ tempMax: 25 }]),
      createMockModelForecast("ecmwf", [{}], [{ tempMax: 25 }]),
      createMockModelForecast("icon", [{}], [{ tempMax: 25 }]),
      createMockModelForecast("meteofrance", [{}], [{ tempMax: 25 }]),
      createMockModelForecast("ukmo", [{}], [{ tempMax: 25 }]),
      createMockModelForecast("jma", [{}], [{ tempMax: 100 }]),
    ];

    const outliers = identifyOutliers(forecasts);

    expect(outliers.some((o) => o.model === "jma")).toBe(true);
  });
});

describe("calculateSpread (exported)", () => {
  it("should be re-exported from aggregator", () => {
    const spread = calculateSpread([1, 2, 3, 4, 5]);
    expect(spread.mean).toBe(3);
    expect(spread.median).toBe(3);
    expect(spread.range).toBe(4);
  });
});

describe("confidence thresholds", () => {
  it("should have high confidence when models agree closely", () => {
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 20.0, windSpeed: 5.0 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20.2, windSpeed: 5.1 }]),
      createMockModelForecast("icon", [{ temperature: 20.1, windSpeed: 5.2 }]),
      createMockModelForecast("jma", [{ temperature: 19.9, windSpeed: 4.9 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    // With stddev < 1.5C, should have high confidence
    expect(hourly.confidence.level).toBe("high");
  });

  it("should have lower confidence when models disagree", () => {
    // Use extreme disagreement across multiple metrics
    const forecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ temperature: 10, windSpeed: 2, precipitation: 0 }]),
      createMockModelForecast("ecmwf", [{ temperature: 20, windSpeed: 5, precipitation: 5 }]),
      createMockModelForecast("icon", [{ temperature: 30, windSpeed: 10, precipitation: 0 }]),
      createMockModelForecast("jma", [{ temperature: 40, windSpeed: 15, precipitation: 10 }]),
    ];

    const aggregated = aggregateForecasts(forecasts);
    const hourly = aggregated.consensus.hourly[0];

    // Temperature stdDev ~11.18 (> 1.5C threshold)
    // Precipitation: 50% have > 0.1mm (between 20-80%, so low confidence)
    // Wind range: 15-2=13 m/s = 46.8 km/h (> 25 km/h threshold)
    // All factors should contribute to lower confidence
    expect(hourly.confidence.level).not.toBe("high");
  });

  it("should consider precipitation agreement in confidence", () => {
    // All models agree: no precipitation
    const noRainForecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ precipitation: 0 }]),
      createMockModelForecast("ecmwf", [{ precipitation: 0 }]),
      createMockModelForecast("icon", [{ precipitation: 0 }]),
      createMockModelForecast("jma", [{ precipitation: 0 }]),
    ];

    // Models disagree on precipitation
    const mixedForecasts: ModelForecast[] = [
      createMockModelForecast("gfs", [{ precipitation: 0 }]),
      createMockModelForecast("ecmwf", [{ precipitation: 5 }]),
      createMockModelForecast("icon", [{ precipitation: 0 }]),
      createMockModelForecast("jma", [{ precipitation: 3 }]),
    ];

    const noRainAggregated = aggregateForecasts(noRainForecasts);
    const mixedAggregated = aggregateForecasts(mixedForecasts);

    // No rain forecast should have higher confidence than mixed
    expect(noRainAggregated.consensus.hourly[0].confidence.score).toBeGreaterThanOrEqual(
      mixedAggregated.consensus.hourly[0].confidence.score
    );
  });
});
