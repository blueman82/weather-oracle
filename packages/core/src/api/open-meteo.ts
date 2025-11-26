/**
 * Open-Meteo API client for fetching weather forecasts from multiple models.
 *
 * This client handles:
 * - Building requests with proper query parameters
 * - Mapping API responses to internal types
 * - Retry logic for transient failures
 * - Timeout handling
 */

import type { ModelName, ModelForecast } from "../types/models";
import type { Location, Coordinates } from "../types/location";
import type {
  HourlyForecast,
  DailyForecast,
  WeatherMetrics,
  TemperatureRange,
  PrecipitationSummary,
  WindSummary,
  SunTimes,
} from "../types/weather";
import {
  celsius,
  millimeters,
  metersPerSecond,
  windDirection,
  humidity,
  pressure,
  cloudCover,
  uvIndex,
  visibility,
  weatherCode,
} from "../types/weather";
import { ApiError } from "../errors/api";
import { getModelEndpoint, HOURLY_VARIABLES, DAILY_VARIABLES, MODEL_QUERY_PARAMS } from "./endpoints";

/**
 * Options for fetching a forecast
 */
export interface ForecastOptions {
  /**
   * Number of forecast days (1-16, default 7)
   */
  forecastDays?: number;

  /**
   * Timezone for the response (default "auto")
   */
  timezone?: string;

  /**
   * Request timeout in milliseconds (default 30000)
   */
  timeout?: number;

  /**
   * Number of retry attempts for transient failures (default 2)
   */
  retries?: number;
}

/**
 * Raw hourly data from Open-Meteo API
 */
interface OpenMeteoHourlyResponse {
  time: string[];
  temperature_2m?: (number | null)[];
  apparent_temperature?: (number | null)[];
  relative_humidity_2m?: (number | null)[];
  surface_pressure?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  precipitation?: (number | null)[];
  precipitation_probability?: (number | null)[];
  cloud_cover?: (number | null)[];
  visibility?: (number | null)[];
  uv_index?: (number | null)[];
  weather_code?: (number | null)[];
}

/**
 * Raw daily data from Open-Meteo API
 */
interface OpenMeteoDailyResponse {
  time: string[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  apparent_temperature_max?: (number | null)[];
  apparent_temperature_min?: (number | null)[];
  precipitation_sum?: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  precipitation_hours?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  wind_gusts_10m_max?: (number | null)[];
  wind_direction_10m_dominant?: (number | null)[];
  sunrise?: string[];
  sunset?: string[];
  daylight_duration?: (number | null)[];
  uv_index_max?: (number | null)[];
  weather_code?: (number | null)[];
}

/**
 * Full Open-Meteo API response structure
 */
interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units?: Record<string, string>;
  hourly?: OpenMeteoHourlyResponse;
  daily_units?: Record<string, string>;
  daily?: OpenMeteoDailyResponse;
  error?: boolean;
  reason?: string;
}

/**
 * Default forecast options
 */
const DEFAULT_OPTIONS: Required<ForecastOptions> = {
  forecastDays: 7,
  timezone: "auto",
  timeout: 30000,
  retries: 2,
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  return baseDelay * Math.pow(2, attempt) + Math.random() * 100;
}

/**
 * Build the URL with query parameters for Open-Meteo API
 */
function buildRequestUrl(
  model: ModelName,
  coordinates: Coordinates,
  options: Required<ForecastOptions>
): URL {
  const endpoint = getModelEndpoint(model);
  const url = new URL(endpoint);

  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("hourly", HOURLY_VARIABLES.join(","));
  url.searchParams.set("daily", DAILY_VARIABLES.join(","));
  url.searchParams.set("timezone", options.timezone);
  url.searchParams.set("forecast_days", String(options.forecastDays));

  // Some models require the models= query parameter (e.g., UKMO uses /forecast?models=ukmo_seamless)
  const modelParam = MODEL_QUERY_PARAMS[model];
  if (modelParam) {
    url.searchParams.set("models", modelParam);
  }

  return url;
}

/**
 * Parse hourly data from API response into HourlyForecast array
 */
function parseHourlyData(hourly: OpenMeteoHourlyResponse): HourlyForecast[] {
  const forecasts: HourlyForecast[] = [];
  const times = hourly.time ?? [];

  for (let i = 0; i < times.length; i++) {
    const timestamp = new Date(times[i]);

    const metrics: WeatherMetrics = {
      temperature: celsius(hourly.temperature_2m?.[i] ?? 0),
      feelsLike: celsius(hourly.apparent_temperature?.[i] ?? hourly.temperature_2m?.[i] ?? 0),
      humidity: humidity(hourly.relative_humidity_2m?.[i] ?? 0),
      pressure: pressure(hourly.surface_pressure?.[i] ?? 1013),
      windSpeed: metersPerSecond(
        hourly.wind_speed_10m?.[i] != null
          ? hourly.wind_speed_10m[i]! / 3.6 // Convert km/h to m/s
          : 0
      ),
      windDirection: windDirection(hourly.wind_direction_10m?.[i] ?? 0),
      windGust:
        hourly.wind_gusts_10m?.[i] != null
          ? metersPerSecond(hourly.wind_gusts_10m[i]! / 3.6) // Convert km/h to m/s
          : undefined,
      precipitation: millimeters(hourly.precipitation?.[i] ?? 0),
      precipitationProbability: hourly.precipitation_probability?.[i] ?? 0,
      cloudCover: cloudCover(hourly.cloud_cover?.[i] ?? 0),
      visibility: visibility(hourly.visibility?.[i] ?? 10000),
      uvIndex: uvIndex(hourly.uv_index?.[i] ?? 0),
      weatherCode: weatherCode(hourly.weather_code?.[i] ?? 0),
    };

    forecasts.push({ timestamp, metrics });
  }

  return forecasts;
}

/**
 * Get hourly forecasts for a specific day
 */
function getHourlyForDay(
  hourlyForecasts: HourlyForecast[],
  date: Date
): HourlyForecast[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return hourlyForecasts.filter(
    (f) => f.timestamp >= dayStart && f.timestamp <= dayEnd
  );
}

/**
 * Parse daily data from API response into DailyForecast array
 */
function parseDailyData(
  daily: OpenMeteoDailyResponse,
  hourlyForecasts: HourlyForecast[]
): DailyForecast[] {
  const forecasts: DailyForecast[] = [];
  const times = daily.time ?? [];

  for (let i = 0; i < times.length; i++) {
    const date = new Date(times[i]);
    const dayHourly = getHourlyForDay(hourlyForecasts, date);

    const temperature: TemperatureRange = {
      min: celsius(daily.temperature_2m_min?.[i] ?? 0),
      max: celsius(daily.temperature_2m_max?.[i] ?? 0),
    };

    const precipitation: PrecipitationSummary = {
      total: millimeters(daily.precipitation_sum?.[i] ?? 0),
      probability: daily.precipitation_probability_max?.[i] ?? 0,
      hours: daily.precipitation_hours?.[i] ?? 0,
    };

    const wind: WindSummary = {
      avgSpeed: metersPerSecond(
        daily.wind_speed_10m_max?.[i] != null
          ? daily.wind_speed_10m_max[i]! / 3.6 / 2 // Rough average estimate
          : 0
      ),
      maxSpeed: metersPerSecond(
        daily.wind_speed_10m_max?.[i] != null
          ? daily.wind_speed_10m_max[i]! / 3.6 // Convert km/h to m/s
          : 0
      ),
      dominantDirection: windDirection(daily.wind_direction_10m_dominant?.[i] ?? 0),
    };

    const sun: SunTimes = {
      sunrise: daily.sunrise?.[i] ? new Date(daily.sunrise[i]) : new Date(date.setHours(6, 0, 0, 0)),
      sunset: daily.sunset?.[i] ? new Date(daily.sunset[i]) : new Date(date.setHours(18, 0, 0, 0)),
      daylightHours: (daily.daylight_duration?.[i] ?? 43200) / 3600, // Convert seconds to hours
    };

    // Calculate min/max humidity and pressure from hourly data
    const humidityValues = dayHourly.map((h) => h.metrics.humidity as number);
    const pressureValues = dayHourly.map((h) => h.metrics.pressure as number);
    const cloudCoverValues = dayHourly.map((h) => h.metrics.cloudCover as number);

    forecasts.push({
      date,
      temperature,
      humidity: {
        min: humidity(humidityValues.length > 0 ? Math.min(...humidityValues) : 0),
        max: humidity(humidityValues.length > 0 ? Math.max(...humidityValues) : 100),
      },
      pressure: {
        min: pressure(pressureValues.length > 0 ? Math.min(...pressureValues) : 1013),
        max: pressure(pressureValues.length > 0 ? Math.max(...pressureValues) : 1013),
      },
      precipitation,
      wind,
      cloudCover: {
        avg: cloudCover(
          cloudCoverValues.length > 0
            ? cloudCoverValues.reduce((a, b) => a + b, 0) / cloudCoverValues.length
            : 0
        ),
        max: cloudCover(cloudCoverValues.length > 0 ? Math.max(...cloudCoverValues) : 0),
      },
      uvIndex: {
        max: uvIndex(daily.uv_index_max?.[i] ?? 0),
      },
      sun,
      weatherCode: weatherCode(daily.weather_code?.[i] ?? 0),
      hourly: dayHourly,
    });
  }

  return forecasts;
}

/**
 * Open-Meteo API client for fetching weather forecasts
 */
export class OpenMeteoClient {
  private readonly defaultOptions: Required<ForecastOptions>;

  constructor(options?: Partial<ForecastOptions>) {
    this.defaultOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Fetch forecast from a specific weather model
   */
  async fetchModelForecast(
    model: ModelName,
    location: Location,
    options?: ForecastOptions
  ): Promise<ModelForecast> {
    const opts: Required<ForecastOptions> = {
      ...this.defaultOptions,
      ...options,
    };

    const coordinates = location.resolved.coordinates;
    const url = buildRequestUrl(model, coordinates, opts);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= opts.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url.toString(), opts.timeout, model);
        return this.parseResponse(response, model, coordinates);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-transient errors (but DO retry 429 rate limits and 5xx)
        if (error instanceof ApiError) {
          if (
            error.code !== "API_TIMEOUT" &&
            error.code !== "API_UNAVAILABLE" &&
            error.statusCode !== undefined &&
            error.statusCode < 500 &&
            error.statusCode !== 429 // 429 Too Many Requests is transient
          ) {
            throw error;
          }
        }

        // Wait before retry (with exponential backoff)
        if (attempt < opts.retries) {
          await sleep(getBackoffDelay(attempt));
        }
      }
    }

    // All retries exhausted
    throw ApiError.unavailable(model, lastError);
  }

  /**
   * Fetch multiple models in parallel
   */
  async fetchMultipleModels(
    models: ModelName[],
    location: Location,
    options?: ForecastOptions
  ): Promise<Map<ModelName, ModelForecast | ApiError>> {
    const results = new Map<ModelName, ModelForecast | ApiError>();

    const promises = models.map(async (model) => {
      try {
        const forecast = await this.fetchModelForecast(model, location, options);
        results.set(model, forecast);
      } catch (error) {
        if (error instanceof ApiError) {
          results.set(model, error);
        } else {
          results.set(model, ApiError.unavailable(model, error instanceof Error ? error : undefined));
        }
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    timeout: number,
    model: ModelName
  ): Promise<OpenMeteoResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw ApiError.fromResponse(response.status, response.statusText, url, model);
      }

      const data = (await response.json()) as OpenMeteoResponse;

      if (data.error) {
        throw ApiError.invalidResponse(url, data.reason ?? "Unknown API error", model);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw ApiError.timeout(url, timeout, model);
      }

      throw ApiError.unavailable(model, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Parse API response into ModelForecast
   */
  private parseResponse(
    response: OpenMeteoResponse,
    model: ModelName,
    coordinates: Coordinates
  ): ModelForecast {
    const hourly = response.hourly ? parseHourlyData(response.hourly) : [];
    const daily = response.daily ? parseDailyData(response.daily, hourly) : [];

    const now = new Date();
    const validFrom = hourly.length > 0 ? hourly[0].timestamp : now;
    const validTo = hourly.length > 0 ? hourly[hourly.length - 1].timestamp : now;

    return {
      model,
      coordinates,
      generatedAt: now,
      validFrom,
      validTo,
      hourly,
      daily,
    };
  }
}

/**
 * Fetch a forecast from a specific weather model (convenience function)
 */
export async function fetchModelForecast(
  model: ModelName,
  location: Location,
  options?: ForecastOptions
): Promise<ModelForecast> {
  const client = new OpenMeteoClient(options);
  return client.fetchModelForecast(model, location, options);
}
