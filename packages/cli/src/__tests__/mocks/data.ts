/**
 * Mock data generators for integration tests.
 * Creates realistic Open-Meteo API response structures.
 */

import type { ModelName } from "@weather-oracle/core";

/**
 * Location data for common test locations
 */
const LOCATIONS: Record<string, { lat: number; lon: number; country: string; countryCode: string; region: string; timezone: string }> = {
  dublin: {
    lat: 53.3498,
    lon: -6.2603,
    country: "Ireland",
    countryCode: "IE",
    region: "Leinster",
    timezone: "Europe/Dublin",
  },
  london: {
    lat: 51.5074,
    lon: -0.1278,
    country: "United Kingdom",
    countryCode: "GB",
    region: "Greater London",
    timezone: "Europe/London",
  },
  newyork: {
    lat: 40.7128,
    lon: -74.006,
    country: "United States",
    countryCode: "US",
    region: "New York",
    timezone: "America/New_York",
  },
  tokyo: {
    lat: 35.6762,
    lon: 139.6503,
    country: "Japan",
    countryCode: "JP",
    region: "Tokyo",
    timezone: "Asia/Tokyo",
  },
};

/**
 * Find location data by query
 */
function findLocation(query: string): typeof LOCATIONS["dublin"] | null {
  const normalizedQuery = query.toLowerCase().replace(/[^a-z]/g, "");

  for (const [key, data] of Object.entries(LOCATIONS)) {
    if (normalizedQuery.includes(key)) {
      return data;
    }
  }

  // Default to Dublin if no match
  return LOCATIONS.dublin;
}

/**
 * Create a mock geocoding API response
 */
export function createMockGeocodingResponse(query: string): {
  results: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    country_code: string;
    country: string;
    admin1: string;
    timezone: string;
    population: number;
  }>;
  generationtime_ms: number;
} {
  const location = findLocation(query);

  if (!location) {
    return { results: [], generationtime_ms: 0.5 };
  }

  // Extract city name from query
  const cityName = query.split(",")[0].trim();
  const capitalizedName = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();

  return {
    results: [
      {
        id: 2964574,
        name: capitalizedName,
        latitude: location.lat,
        longitude: location.lon,
        elevation: 10,
        country_code: location.countryCode,
        country: location.country,
        admin1: location.region,
        timezone: location.timezone,
        population: 500000,
      },
    ],
    generationtime_ms: 0.5,
  };
}

/**
 * Generate hourly timestamps for a given number of days
 */
function generateHourlyTimes(days: number): string[] {
  const times: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let day = 0; day < days; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      date.setHours(hour);
      times.push(date.toISOString().replace(":00.000Z", "").replace("T", "T"));
    }
  }

  return times;
}

/**
 * Generate daily timestamps for a given number of days
 */
function generateDailyTimes(days: number): string[] {
  const times: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let day = 0; day < days; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    times.push(date.toISOString().split("T")[0]);
  }

  return times;
}

/**
 * Create small model-specific temperature offsets for realistic variation
 */
function getModelOffset(model: ModelName): number {
  const offsets: Record<ModelName, number> = {
    ecmwf: 0,
    gfs: 0.5,
    icon: -0.3,
    jma: 0.2,
    gem: -0.2,
    meteofrance: 0.1,
    ukmo: -0.1,
  };
  return offsets[model];
}

/**
 * Create a mock Open-Meteo forecast API response
 */
export function createMockForecastResponse(
  lat: number,
  lon: number,
  days: number,
  model: ModelName
): {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units: Record<string, string>;
  hourly: Record<string, (number | string | null)[]>;
  daily_units: Record<string, string>;
  daily: Record<string, (number | string | null)[]>;
} {
  const hourlyTimes = generateHourlyTimes(days);
  const dailyTimes = generateDailyTimes(days);
  const offset = getModelOffset(model);

  // Generate hourly data with slight model variations
  const hourlyTemps = hourlyTimes.map((_, i) => {
    const hour = i % 24;
    const day = Math.floor(i / 24);
    // Base temperature pattern: lower at night, higher midday, slight increase over days
    const base = 12 + day * 0.5 + Math.sin((hour - 6) * Math.PI / 12) * 5;
    return Math.round((base + offset) * 10) / 10;
  });

  const hourlyHumidity = hourlyTimes.map((_, i) => {
    const hour = i % 24;
    // Higher humidity at night
    return Math.round(65 + Math.sin((hour - 12) * Math.PI / 12) * 15);
  });

  const hourlyPrecipProb = hourlyTimes.map((_, i) => {
    const day = Math.floor(i / 24);
    // Increasing precipitation probability over days
    return Math.min(Math.round(10 + day * 8 + Math.random() * 5), 100);
  });

  // Generate daily data
  const dailyTempMax = dailyTimes.map((_, i) => Math.round((17 + i * 0.5 + offset) * 10) / 10);
  const dailyTempMin = dailyTimes.map((_, i) => Math.round((8 + i * 0.3 + offset) * 10) / 10);
  const dailyPrecipSum = dailyTimes.map((_, i) => i > 2 ? Math.round((2 + Math.random() * 3) * 10) / 10 : 0);
  const dailyPrecipProbMax = dailyTimes.map((_, i) => Math.min(Math.round(15 + i * 12), 90));
  const dailyWindMax = dailyTimes.map(() => Math.round((15 + Math.random() * 10) * 10) / 10);

  // Generate sunrise/sunset times
  const sunrises = dailyTimes.map((date) => `${date}T07:15`);
  const sunsets = dailyTimes.map((date) => `${date}T17:30`);

  return {
    latitude: lat,
    longitude: lon,
    generationtime_ms: 0.5,
    utc_offset_seconds: 0,
    timezone: "UTC",
    timezone_abbreviation: "UTC",
    elevation: 10,
    hourly_units: {
      time: "iso8601",
      temperature_2m: "\u00b0C",
      relative_humidity_2m: "%",
      precipitation: "mm",
      precipitation_probability: "%",
      wind_speed_10m: "km/h",
      wind_direction_10m: "\u00b0",
      cloud_cover: "%",
      visibility: "m",
      uv_index: "",
      weather_code: "wmo code",
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTemps,
      apparent_temperature: hourlyTemps.map((t) => t - 2),
      relative_humidity_2m: hourlyHumidity,
      surface_pressure: hourlyTimes.map(() => 1015),
      wind_speed_10m: hourlyTimes.map(() => 12 + Math.random() * 5),
      wind_direction_10m: hourlyTimes.map(() => Math.round(Math.random() * 360)),
      wind_gusts_10m: hourlyTimes.map(() => 20 + Math.random() * 10),
      precipitation: hourlyTimes.map(() => Math.random() * 0.5),
      precipitation_probability: hourlyPrecipProb,
      cloud_cover: hourlyTimes.map(() => Math.round(30 + Math.random() * 40)),
      visibility: hourlyTimes.map(() => 15000),
      uv_index: hourlyTimes.map((_, i) => {
        const hour = i % 24;
        return hour >= 10 && hour <= 16 ? Math.round(Math.random() * 5) : 0;
      }),
      weather_code: hourlyTimes.map(() => Math.round(Math.random() * 3)),
    },
    daily_units: {
      time: "iso8601",
      temperature_2m_max: "\u00b0C",
      temperature_2m_min: "\u00b0C",
      precipitation_sum: "mm",
      precipitation_probability_max: "%",
      wind_speed_10m_max: "km/h",
      sunrise: "iso8601",
      sunset: "iso8601",
    },
    daily: {
      time: dailyTimes,
      temperature_2m_max: dailyTempMax,
      temperature_2m_min: dailyTempMin,
      apparent_temperature_max: dailyTempMax.map((t) => t - 2),
      apparent_temperature_min: dailyTempMin.map((t) => t - 2),
      precipitation_sum: dailyPrecipSum,
      precipitation_probability_max: dailyPrecipProbMax,
      precipitation_hours: dailyTimes.map((_, i) => (i > 2 ? Math.round(1 + Math.random() * 3) : 0)),
      wind_speed_10m_max: dailyWindMax,
      wind_gusts_10m_max: dailyWindMax.map((w) => w * 1.5),
      wind_direction_10m_dominant: dailyTimes.map(() => Math.round(Math.random() * 360)),
      sunrise: sunrises,
      sunset: sunsets,
      daylight_duration: dailyTimes.map(() => 37800), // ~10.5 hours
      uv_index_max: dailyTimes.map(() => Math.round(2 + Math.random() * 3)),
      weather_code: dailyTimes.map(() => Math.round(Math.random() * 3)),
    },
  };
}
