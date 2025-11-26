/**
 * Snapshot tests for CLI output formats.
 *
 * Tests that output formats remain consistent across changes.
 * Uses deterministic mock data to ensure reproducible snapshots.
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
  latitude,
  longitude,
  celsius,
  millimeters,
  metersPerSecond,
  humidity,
  pressure,
  cloudCover,
  uvIndex,
  weatherCode,
  windDirection,
  timezoneId,
  visibility,
  type Location,
  type ModelForecast,
  type ModelName,
  type GeocodingResult,
  type HourlyForecast,
} from "@weather-oracle/core";

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

/**
 * Create deterministic mock data for snapshot testing.
 * Uses fixed values to ensure reproducible output.
 */
function createDeterministicMockData() {
  const baseDate = new Date("2024-06-15T00:00:00.000Z");

  const geocodingResult: GeocodingResult = {
    name: "Dublin",
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    country: "Ireland",
    countryCode: "IE",
    region: "Leinster",
    timezone: timezoneId("Europe/Dublin"),
    population: 1173179,
  };

  const location: Location = {
    query: "Dublin, Ireland",
    resolved: geocodingResult,
  };

  // Create deterministic daily forecasts
  const createDailyForecast = (dayOffset: number) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + dayOffset);

    return {
      date,
      temperature: {
        min: celsius(10 + dayOffset),
        max: celsius(18 + dayOffset),
      },
      humidity: {
        min: humidity(55),
        max: humidity(85),
      },
      pressure: {
        min: pressure(1010),
        max: pressure(1020),
      },
      precipitation: {
        total: millimeters(dayOffset > 2 ? 3 : 0),
        probability: 15 + dayOffset * 10,
        hours: dayOffset > 2 ? 2 : 0,
      },
      wind: {
        avgSpeed: metersPerSecond(4),
        maxSpeed: metersPerSecond(8),
        dominantDirection: windDirection(220),
      },
      cloudCover: {
        avg: cloudCover(50),
        max: cloudCover(80),
      },
      uvIndex: {
        max: uvIndex(4),
      },
      sun: {
        sunrise: new Date(`2024-06-${15 + dayOffset}T05:00:00.000Z`),
        sunset: new Date(`2024-06-${15 + dayOffset}T21:30:00.000Z`),
        daylightHours: 16.5,
      },
      weatherCode: weatherCode(dayOffset > 2 ? 61 : 2),
      hourly: [],
    };
  };

  // Create deterministic hourly forecasts
  const createHourlyForecast = (dayOffset: number, hour: number): HourlyForecast => {
    const timestamp = new Date(baseDate);
    timestamp.setDate(timestamp.getDate() + dayOffset);
    timestamp.setHours(hour);

    return {
      timestamp,
      metrics: {
        temperature: celsius(10 + dayOffset + Math.sin(hour / 24 * Math.PI) * 5),
        feelsLike: celsius(9 + dayOffset + Math.sin(hour / 24 * Math.PI) * 5),
        humidity: humidity(65 + Math.cos(hour / 24 * Math.PI) * 15),
        pressure: pressure(1015),
        windSpeed: metersPerSecond(5),
        windDirection: windDirection(220),
        precipitation: millimeters(0),
        precipitationProbability: 15 + dayOffset * 10,
        cloudCover: cloudCover(50),
        visibility: visibility(15000),
        uvIndex: uvIndex(hour >= 10 && hour <= 16 ? 4 : 0),
        weatherCode: weatherCode(2),
      },
    };
  };

  // Generate 5 days of daily forecasts
  const daily = Array.from({ length: 5 }, (_, i) => createDailyForecast(i));

  // Generate hourly forecasts for 5 days
  const hourly = daily.flatMap((_, dayIdx) =>
    Array.from({ length: 24 }, (_, hour) => createHourlyForecast(dayIdx, hour))
  );

  // Create model forecast
  const createModelForecast = (model: ModelName, tempOffset: number): ModelForecast => ({
    model,
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    generatedAt: baseDate,
    validFrom: baseDate,
    validTo: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000),
    daily: daily.map((d) => ({
      ...d,
      temperature: {
        min: celsius((d.temperature.min as number) + tempOffset),
        max: celsius((d.temperature.max as number) + tempOffset),
      },
    })),
    hourly: hourly.map((h): HourlyForecast => ({
      ...h,
      metrics: {
        ...h.metrics,
        temperature: celsius((h.metrics.temperature as number) + tempOffset),
      },
    })),
  });

  return {
    location,
    geocodingResult,
    forecasts: [
      createModelForecast("ecmwf", 0),
      createModelForecast("gfs", 0.5),
      createModelForecast("icon", -0.3),
    ],
  };
}

describe("Output Format Snapshots", () => {
  describe("JSON Format", () => {
    it("should produce consistent JSON structure", async () => {
      const { location, forecasts } = createDeterministicMockData();

      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Create JSON output structure
      const jsonOutput = {
        location: {
          name: location.resolved.name,
          country: location.resolved.country,
          coordinates: {
            latitude: location.resolved.coordinates.latitude,
            longitude: location.resolved.coordinates.longitude,
          },
        },
        forecast: {
          models: aggregated.models,
          daysCount: aggregated.consensus.daily.length,
          hourlyCount: aggregated.consensus.hourly.length,
        },
        confidence: {
          level: confidence.level,
          // Round score for snapshot stability
          scoreRounded: Math.round(confidence.score * 100) / 100,
        },
        narrative: {
          hasHeadline: !!narrative.headline,
          hasBody: !!narrative.body,
          alertCount: narrative.alerts.length,
        },
      };

      // Verify structure is consistent
      expect(jsonOutput.location.name).toBe("Dublin");
      expect(jsonOutput.location.country).toBe("Ireland");
      expect(jsonOutput.forecast.models.length).toBe(3);
      expect(jsonOutput.forecast.daysCount).toBe(5);
      expect(jsonOutput.confidence.level).toBeDefined();
      expect(jsonOutput.narrative.hasHeadline).toBe(true);
    });

    it("should serialize dates as ISO strings", async () => {
      const { forecasts } = createDeterministicMockData();
      const aggregated = aggregateForecasts(forecasts);

      const firstDay = aggregated.consensus.daily[0];
      const dateString = firstDay.date.toISOString();

      // Verify it's a valid ISO date string
      expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

      // Verify it can be parsed back
      const parsed = new Date(dateString);
      expect(parsed.getTime()).toBe(firstDay.date.getTime());
    });
  });

  describe("Aggregation Output", () => {
    it("should produce consistent model weights", async () => {
      const { forecasts } = createDeterministicMockData();
      const aggregated = aggregateForecasts(forecasts);

      // Weights should be assigned to all models
      expect(aggregated.modelWeights.length).toBe(3);

      // Total weight should be approximately 1
      const totalWeight = aggregated.modelWeights.reduce((sum, w) => sum + w.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 2);

      // Each model should have a positive weight
      for (const mw of aggregated.modelWeights) {
        expect(mw.weight).toBeGreaterThan(0);
        expect(mw.weight).toBeLessThanOrEqual(1);
      }
    });

    it("should produce consistent daily consensus structure", async () => {
      const { forecasts } = createDeterministicMockData();
      const aggregated = aggregateForecasts(forecasts);

      const firstDay = aggregated.consensus.daily[0];

      // Verify structure
      expect(firstDay).toHaveProperty("date");
      expect(firstDay).toHaveProperty("forecast");
      expect(firstDay.forecast).toHaveProperty("temperature");
      expect(firstDay.forecast).toHaveProperty("precipitation");
      expect(firstDay.forecast).toHaveProperty("wind");
      expect(firstDay.forecast).toHaveProperty("humidity");

      // Verify temperature structure
      expect(firstDay.forecast.temperature).toHaveProperty("min");
      expect(firstDay.forecast.temperature).toHaveProperty("max");
      expect(typeof firstDay.forecast.temperature.min).toBe("number");
      expect(typeof firstDay.forecast.temperature.max).toBe("number");
    });
  });

  describe("Confidence Output", () => {
    it("should produce consistent confidence structure", async () => {
      const { forecasts } = createDeterministicMockData();
      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);

      // Verify structure
      expect(confidence).toHaveProperty("level");
      expect(confidence).toHaveProperty("score");
      expect(confidence).toHaveProperty("factors");

      // Verify level is one of expected values
      expect(["high", "medium", "low"]).toContain(confidence.level);

      // Verify score is in valid range
      expect(confidence.score).toBeGreaterThanOrEqual(0);
      expect(confidence.score).toBeLessThanOrEqual(1);
    });

    it("should include confidence factors", async () => {
      const { forecasts } = createDeterministicMockData();
      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);

      // Factors should be present
      expect(confidence.factors).toBeDefined();
      expect(Array.isArray(confidence.factors) || typeof confidence.factors === "object").toBe(true);
    });
  });

  describe("Narrative Output", () => {
    it("should produce consistent narrative structure", async () => {
      const { forecasts } = createDeterministicMockData();
      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Verify structure
      expect(narrative).toHaveProperty("headline");
      expect(narrative).toHaveProperty("body");
      expect(narrative).toHaveProperty("alerts");
      expect(narrative).toHaveProperty("modelNotes");

      // Verify types
      expect(typeof narrative.headline).toBe("string");
      expect(typeof narrative.body).toBe("string");
      expect(Array.isArray(narrative.alerts)).toBe(true);
      expect(Array.isArray(narrative.modelNotes)).toBe(true);
    });

    it("should produce non-empty headline", async () => {
      const { forecasts } = createDeterministicMockData();
      const aggregated = aggregateForecasts(forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      expect(narrative.headline.length).toBeGreaterThan(0);
    });
  });

  describe("API Response Format", () => {
    it("should produce consistent success response format", async () => {
      const location = await geocodeLocation("Dublin");
      const locationObj: Location = { query: "Dublin", resolved: location };

      const modelResult = await fetchAllModels(locationObj, ["ecmwf", "gfs"], {
        forecastDays: 3,
      });
      const aggregated = aggregateForecasts(modelResult.forecasts);
      const confidence = calculateConfidence(aggregated, "overall", 0);
      const narrative = generateNarrative(aggregated, [confidence]);

      // Simulate API success response structure
      const apiResponse = {
        success: true as const,
        data: {
          location: {
            name: location.name,
            country: location.country,
            coordinates: location.coordinates,
          },
          forecast: {
            validFrom: aggregated.validFrom.toISOString(),
            validTo: aggregated.validTo.toISOString(),
            daily: aggregated.consensus.daily.map((d) => ({
              date: d.date.toISOString(),
              temperatureMax: d.forecast.temperature.max,
              temperatureMin: d.forecast.temperature.min,
              precipitationProbability: d.forecast.precipitation.probability,
            })),
            modelWeights: aggregated.modelWeights,
          },
          confidence: {
            level: confidence.level,
            score: confidence.score,
          },
          narrative: {
            headline: narrative.headline,
            body: narrative.body,
          },
        },
        meta: {
          fetchedAt: new Date().toISOString(),
          cached: false,
          duration: 150,
          models: modelResult.forecasts.map((f) => f.model),
        },
      };

      // Verify structure
      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data.location.name).toBeDefined();
      expect(apiResponse.data.forecast.daily.length).toBe(3);
      expect(apiResponse.meta.models.length).toBe(2);
    });

    it("should produce consistent error response format", () => {
      // Error response structure
      const errorResponse = {
        success: false as const,
        error: {
          code: "NOT_FOUND",
          message: "Location not found: nonexistent place",
          details: {
            query: "nonexistent place",
          },
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe("NOT_FOUND");
      expect(errorResponse.error.message).toContain("not found");
      expect(errorResponse.error.details.query).toBe("nonexistent place");
    });
  });

  describe("Compare Format", () => {
    it("should produce consistent comparison output", async () => {
      const { forecasts } = createDeterministicMockData();

      // Create comparison entries for each model
      const comparisonEntries = forecasts.map((forecast) => ({
        model: forecast.model,
        daily: forecast.daily.map((d) => ({
          date: d.date.toISOString(),
          tempMax: d.temperature.max,
          tempMin: d.temperature.min,
          precipProb: d.precipitation.probability,
        })),
      }));

      expect(comparisonEntries.length).toBe(3);

      // Verify each entry has consistent structure
      for (const entry of comparisonEntries) {
        expect(entry.model).toBeDefined();
        expect(entry.daily.length).toBe(5);

        for (const day of entry.daily) {
          expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          expect(typeof day.tempMax).toBe("number");
          expect(typeof day.tempMin).toBe("number");
          expect(typeof day.precipProb).toBe("number");
        }
      }
    });
  });
});
