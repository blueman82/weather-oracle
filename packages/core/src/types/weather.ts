/**
 * Weather data types for the Weather Oracle system.
 * Defines metrics, hourly and daily forecasts.
 */

/**
 * Temperature in Celsius (can be converted for display)
 */
export type Celsius = number & { readonly __brand: "Celsius" };

/**
 * Create a Celsius temperature value
 */
export function celsius(value: number): Celsius {
  return value as Celsius;
}

/**
 * Convert Celsius to Fahrenheit
 */
export function toFahrenheit(temp: Celsius): number {
  return (temp * 9) / 5 + 32;
}

/**
 * Precipitation amount in millimeters
 */
export type Millimeters = number & { readonly __brand: "Millimeters" };

/**
 * Create a millimeters value
 */
export function millimeters(value: number): Millimeters {
  if (value < 0) {
    throw new RangeError(`Precipitation cannot be negative, got ${value}`);
  }
  return value as Millimeters;
}

/**
 * Wind speed in meters per second
 */
export type MetersPerSecond = number & { readonly __brand: "MetersPerSecond" };

/**
 * Create a wind speed value
 */
export function metersPerSecond(value: number): MetersPerSecond {
  if (value < 0) {
    throw new RangeError(`Wind speed cannot be negative, got ${value}`);
  }
  return value as MetersPerSecond;
}

/**
 * Convert meters per second to km/h
 */
export function toKmPerHour(speed: MetersPerSecond): number {
  return speed * 3.6;
}

/**
 * Convert meters per second to mph
 */
export function toMph(speed: MetersPerSecond): number {
  return speed * 2.237;
}

/**
 * Wind direction in degrees (0-360, where 0 = North)
 */
export type WindDirection = number & { readonly __brand: "WindDirection" };

/**
 * Create a wind direction value
 */
export function windDirection(degrees: number): WindDirection {
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized as WindDirection;
}

/**
 * Get cardinal direction from degrees
 */
export function toCardinalDirection(dir: WindDirection): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(dir / 22.5) % 16;
  return directions[index];
}

/**
 * Relative humidity as percentage (0-100)
 */
export type Humidity = number & { readonly __brand: "Humidity" };

/**
 * Create a humidity value
 */
export function humidity(percent: number): Humidity {
  if (percent < 0 || percent > 100) {
    throw new RangeError(`Humidity must be between 0 and 100, got ${percent}`);
  }
  return percent as Humidity;
}

/**
 * Atmospheric pressure in hectopascals (hPa)
 */
export type Pressure = number & { readonly __brand: "Pressure" };

/**
 * Create a pressure value
 */
export function pressure(hPa: number): Pressure {
  if (hPa < 0) {
    throw new RangeError(`Pressure cannot be negative, got ${hPa}`);
  }
  return hPa as Pressure;
}

/**
 * Cloud cover as percentage (0-100)
 */
export type CloudCover = number & { readonly __brand: "CloudCover" };

/**
 * Create a cloud cover value
 */
export function cloudCover(percent: number): CloudCover {
  if (percent < 0 || percent > 100) {
    throw new RangeError(`Cloud cover must be between 0 and 100, got ${percent}`);
  }
  return percent as CloudCover;
}

/**
 * UV index (0-11+)
 */
export type UVIndex = number & { readonly __brand: "UVIndex" };

/**
 * Create a UV index value
 */
export function uvIndex(value: number): UVIndex {
  if (value < 0) {
    throw new RangeError(`UV index cannot be negative, got ${value}`);
  }
  return value as UVIndex;
}

/**
 * Visibility in meters
 */
export type Visibility = number & { readonly __brand: "Visibility" };

/**
 * Create a visibility value
 */
export function visibility(meters: number): Visibility {
  if (meters < 0) {
    throw new RangeError(`Visibility cannot be negative, got ${meters}`);
  }
  return meters as Visibility;
}

/**
 * Weather condition codes (WMO standard)
 */
export type WeatherCode = number & { readonly __brand: "WeatherCode" };

/**
 * Create a weather code value
 */
export function weatherCode(code: number): WeatherCode {
  return code as WeatherCode;
}

/**
 * Core weather metrics at a point in time
 */
export interface WeatherMetrics {
  readonly temperature: Celsius;
  readonly feelsLike: Celsius;
  readonly humidity: Humidity;
  readonly pressure: Pressure;
  readonly windSpeed: MetersPerSecond;
  readonly windDirection: WindDirection;
  readonly windGust?: MetersPerSecond;
  readonly precipitation: Millimeters;
  readonly precipitationProbability: number;
  readonly cloudCover: CloudCover;
  readonly visibility: Visibility;
  readonly uvIndex: UVIndex;
  readonly weatherCode: WeatherCode;
}

/**
 * Single hour's weather forecast
 */
export interface HourlyForecast {
  readonly timestamp: Date;
  readonly metrics: WeatherMetrics;
}

/**
 * Temperature range for a day
 */
export interface TemperatureRange {
  readonly min: Celsius;
  readonly max: Celsius;
}

/**
 * Precipitation summary for a day
 */
export interface PrecipitationSummary {
  readonly total: Millimeters;
  readonly probability: number;
  readonly hours: number;
}

/**
 * Wind summary for a day
 */
export interface WindSummary {
  readonly avgSpeed: MetersPerSecond;
  readonly maxSpeed: MetersPerSecond;
  readonly dominantDirection: WindDirection;
}

/**
 * Sun times for a day
 */
export interface SunTimes {
  readonly sunrise: Date;
  readonly sunset: Date;
  readonly daylightHours: number;
}

/**
 * Full daily forecast summary
 */
export interface DailyForecast {
  readonly date: Date;
  readonly temperature: TemperatureRange;
  readonly humidity: {
    readonly min: Humidity;
    readonly max: Humidity;
  };
  readonly pressure: {
    readonly min: Pressure;
    readonly max: Pressure;
  };
  readonly precipitation: PrecipitationSummary;
  readonly wind: WindSummary;
  readonly cloudCover: {
    readonly avg: CloudCover;
    readonly max: CloudCover;
  };
  readonly uvIndex: {
    readonly max: UVIndex;
  };
  readonly sun: SunTimes;
  readonly weatherCode: WeatherCode;
  readonly hourly: readonly HourlyForecast[];
}
