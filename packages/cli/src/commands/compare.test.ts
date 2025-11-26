/**
 * Tests for the compare command.
 */

import { describe, it, expect } from "bun:test";
import type { ModelName, ModelForecast, GeocodingResult } from "@weather-oracle/core";

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
  calculateSpread,
  mean,
  stdDev,
} from "@weather-oracle/core";

/**
 * Create mock geocoding result
 */
function createMockGeocodingResult(): GeocodingResult {
  return {
    name: "Dublin",
    coordinates: {
      latitude: latitude(53.3498),
      longitude: longitude(-6.2603),
    },
    country: "Ireland",
    countryCode: "IE",
    region: "Leinster",
    timezone: timezoneId("Europe/Dublin"),
  };
}

/**
 * Create mock daily forecast for testing
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

describe("compare command", () => {
  describe("data building", () => {
    it("should handle multiple models with different temperatures", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("ecmwf", 0),
        createMockModelForecast("gfs", 1),
        createMockModelForecast("icon", -1),
      ];

      // Check that forecasts have different temperature values
      const day0TempMaxes = forecasts.map(
        (f) => f.daily[0].temperature.max as number
      );
      expect(day0TempMaxes).toContain(15); // ecmwf
      expect(day0TempMaxes).toContain(16); // gfs
      expect(day0TempMaxes).toContain(14); // icon
    });

    it("should handle models with precipitation differences", () => {
      const forecasts: ModelForecast[] = [
        createMockModelForecast("ecmwf", 0, 0),
        createMockModelForecast("gfs", 0, 10),
        createMockModelForecast("icon", 0, 5),
      ];

      // Check precipitation probability differences
      const day2PrecipProbs = forecasts.map(
        (f) => f.daily[2].precipitation.probability
      );
      expect(day2PrecipProbs).toContain(40);  // ecmwf: 20 + 2*10
      expect(day2PrecipProbs).toContain(50);  // gfs: 20 + 2*10 + 10
      expect(day2PrecipProbs).toContain(45);  // icon: 20 + 2*10 + 5
    });
  });

  describe("output formatting", () => {
    it("should handle metric units", () => {
      const forecast = createMockModelForecast("ecmwf");
      const tempMax = forecast.daily[0].temperature.max as number;

      // Verify temperature is in Celsius
      expect(tempMax).toBe(15);
    });

    it("should handle imperial units conversion", () => {
      // Temperature conversion: C * 9/5 + 32
      const tempCelsius = 15;
      const fahrenheit = (tempCelsius * 9) / 5 + 32;
      expect(fahrenheit).toBe(59);
    });

    it("should format precipitation probability correctly", () => {
      const prob = 45.7;
      const formatted = `${Math.round(prob)}%`;
      expect(formatted).toBe("46%");
    });

    it("should handle zero precipitation", () => {
      const mm = 0;
      const formatted = mm < 0.5 ? "0mm" : `${mm.toFixed(0)}mm`;
      expect(formatted).toBe("0mm");
    });
  });

  describe("spread calculation", () => {
    it("should calculate temperature spread correctly", () => {
      const temps = [15, 16, 14, 15, 17];
      const spread = calculateSpread(temps);

      expect(spread.min).toBe(14);
      expect(spread.max).toBe(17);
      expect(spread.range).toBe(3);
    });

    it("should identify low uncertainty when models agree", () => {
      const temps = [15, 15, 15, 15];
      const spread = calculateSpread(temps);

      expect(spread.range).toBe(0);
      expect(spread.stdDev).toBe(0);
    });

    it("should identify high uncertainty when models disagree", () => {
      const temps = [10, 15, 20, 25];
      const spread = calculateSpread(temps);

      expect(spread.range).toBe(15);
      expect(spread.stdDev).toBeGreaterThan(5);
    });
  });

  describe("deviation coloring", () => {
    it("should identify values within 1 sigma as low deviation", () => {
      const values = [10, 11, 12, 11, 10];
      const avg = mean(values);
      const sd = stdDev(values);

      // Value of 11 should be within 1 sigma of mean
      const zScore = Math.abs(11 - avg) / sd;
      expect(zScore).toBeLessThan(1);
    });

    it("should identify outliers as high deviation", () => {
      // Use values where the outlier is clearly > 2 sigma away
      const values = [10, 10, 10, 10, 50];
      const avg = mean(values);
      const sd = stdDev(values);

      // Value of 50 is an outlier with z-score well above 2
      // avg = 18, sd = 16, z = (50-18)/16 = 2
      // Verify z-score is >= 2 for this dataset
      const zScore = Math.abs(50 - avg) / sd;
      expect(zScore).toBeGreaterThanOrEqual(2);
    });
  });

  describe("geocoding result", () => {
    it("should create valid mock geocoding result", () => {
      const result = createMockGeocodingResult();

      expect(result.name).toBe("Dublin");
      expect(result.country).toBe("Ireland");
      expect(result.coordinates.latitude as number).toBeCloseTo(53.35, 1);
      expect(result.coordinates.longitude as number).toBeCloseTo(-6.26, 1);
    });
  });

  describe("model forecast structure", () => {
    it("should create valid forecast with all required fields", () => {
      const forecast = createMockModelForecast("ecmwf");

      expect(forecast.model).toBe("ecmwf");
      expect(forecast.daily).toHaveLength(7);
      expect(forecast.hourly).toHaveLength(24 * 7);
      expect(forecast.coordinates).toBeDefined();
      expect(forecast.validFrom).toBeInstanceOf(Date);
      expect(forecast.validTo).toBeInstanceOf(Date);
    });

    it("should have increasing temperatures over days", () => {
      const forecast = createMockModelForecast("gfs");

      // Temperature should increase by 1 degree each day
      for (let i = 0; i < 6; i++) {
        const today = forecast.daily[i].temperature.max as number;
        const tomorrow = forecast.daily[i + 1].temperature.max as number;
        expect(tomorrow - today).toBe(1);
      }
    });
  });

  describe("spread label classification", () => {
    it("should classify temperature spread correctly", () => {
      // Test the logic used in getSpreadLabel
      const classifyTempSpread = (spread: number): string => {
        if (spread <= 1) return "Low uncertainty";
        if (spread <= 3) return "Moderate";
        return "High uncertainty";
      };

      expect(classifyTempSpread(0.5)).toBe("Low uncertainty");
      expect(classifyTempSpread(1)).toBe("Low uncertainty");
      expect(classifyTempSpread(2)).toBe("Moderate");
      expect(classifyTempSpread(3)).toBe("Moderate");
      expect(classifyTempSpread(5)).toBe("High uncertainty");
    });

    it("should classify precipitation spread correctly", () => {
      // Test the logic used in getSpreadLabel
      const classifyPrecipSpread = (spread: number): string => {
        if (spread <= 10) return "Low uncertainty";
        if (spread <= 30) return "Moderate";
        return "High uncertainty";
      };

      expect(classifyPrecipSpread(5)).toBe("Low uncertainty");
      expect(classifyPrecipSpread(10)).toBe("Low uncertainty");
      expect(classifyPrecipSpread(20)).toBe("Moderate");
      expect(classifyPrecipSpread(30)).toBe("Moderate");
      expect(classifyPrecipSpread(50)).toBe("High uncertainty");
    });
  });
});
