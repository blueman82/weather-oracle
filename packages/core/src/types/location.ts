/**
 * Location types for the Weather Oracle system.
 * Uses branded types for coordinates to prevent accidental lat/lon swaps.
 */

/**
 * Branded type for latitude values (-90 to 90 degrees)
 */
export type Latitude = number & { readonly __brand: "Latitude" };

/**
 * Branded type for longitude values (-180 to 180 degrees)
 */
export type Longitude = number & { readonly __brand: "Longitude" };

/**
 * Type guard and constructor for creating Latitude values
 */
export function latitude(value: number): Latitude {
  if (value < -90 || value > 90) {
    throw new RangeError(`Latitude must be between -90 and 90, got ${value}`);
  }
  return value as Latitude;
}

/**
 * Type guard and constructor for creating Longitude values
 */
export function longitude(value: number): Longitude {
  if (value < -180 || value > 180) {
    throw new RangeError(`Longitude must be between -180 and 180, got ${value}`);
  }
  return value as Longitude;
}

/**
 * Geographic coordinates with branded types to prevent mixing lat/lon
 */
export interface Coordinates {
  readonly latitude: Latitude;
  readonly longitude: Longitude;
}

/**
 * Elevation in meters above sea level
 */
export type Elevation = number & { readonly __brand: "Elevation" };

/**
 * Create an elevation value
 */
export function elevation(meters: number): Elevation {
  return meters as Elevation;
}

/**
 * Timezone identifier (e.g., "America/New_York", "Europe/London")
 */
export type TimezoneId = string & { readonly __brand: "TimezoneId" };

/**
 * Create a timezone identifier
 */
export function timezoneId(tz: string): TimezoneId {
  return tz as TimezoneId;
}

/**
 * Result from geocoding a location query
 */
export interface GeocodingResult {
  readonly name: string;
  readonly coordinates: Coordinates;
  readonly country: string;
  readonly countryCode: string;
  readonly region?: string;
  readonly timezone: TimezoneId;
  readonly elevation?: Elevation;
  readonly population?: number;
}

/**
 * User-provided location input (before geocoding resolution)
 */
export interface LocationQuery {
  readonly query: string;
}

/**
 * Resolved location with coordinates and metadata
 */
export interface Location {
  readonly query: string;
  readonly resolved: GeocodingResult;
}

/**
 * Create coordinates from raw numbers (validates and brands)
 */
export function createCoordinates(lat: number, lon: number): Coordinates {
  return {
    latitude: latitude(lat),
    longitude: longitude(lon),
  };
}

/**
 * Check if two coordinates are approximately equal (within a tolerance)
 */
export function coordinatesEqual(
  a: Coordinates,
  b: Coordinates,
  toleranceDegrees: number = 0.0001
): boolean {
  return (
    Math.abs(a.latitude - b.latitude) <= toleranceDegrees &&
    Math.abs(a.longitude - b.longitude) <= toleranceDegrees
  );
}
