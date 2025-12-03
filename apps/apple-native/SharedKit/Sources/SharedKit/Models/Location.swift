import Foundation

// MARK: - Branded Coordinate Types

/// Latitude value (-90 to 90 degrees).
/// Swift equivalent of TypeScript: `type Latitude = number & { readonly __brand: "Latitude" }`
public struct Latitude: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= -90, rawValue <= 90 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a Latitude, throwing if out of range.
    /// - Parameter degrees: Value in degrees (-90 to 90)
    /// - Throws: `LocationError.invalidLatitude` if out of range
    public static func validated(_ degrees: Double) throws -> Latitude {
        guard let lat = Latitude(rawValue: degrees) else {
            throw LocationError.invalidLatitude(degrees)
        }
        return lat
    }
}

/// Longitude value (-180 to 180 degrees).
/// Swift equivalent of TypeScript: `type Longitude = number & { readonly __brand: "Longitude" }`
public struct Longitude: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= -180, rawValue <= 180 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a Longitude, throwing if out of range.
    /// - Parameter degrees: Value in degrees (-180 to 180)
    /// - Throws: `LocationError.invalidLongitude` if out of range
    public static func validated(_ degrees: Double) throws -> Longitude {
        guard let lon = Longitude(rawValue: degrees) else {
            throw LocationError.invalidLongitude(degrees)
        }
        return lon
    }
}

/// Elevation in meters above sea level.
/// Swift equivalent of TypeScript: `type Elevation = number & { readonly __brand: "Elevation" }`
public struct Elevation: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init(rawValue: Double) {
        self.rawValue = rawValue
    }

    /// Convenience initializer for meters.
    public static func meters(_ value: Double) -> Elevation {
        Elevation(rawValue: value)
    }
}

// MARK: - Timezone Identifier

/// Timezone identifier (e.g., "America/New_York", "Europe/London").
/// Swift equivalent of TypeScript: `type TimezoneId = string & { readonly __brand: "TimezoneId" }`
public struct TimezoneId: RawRepresentable, Codable, Sendable, Hashable, ExpressibleByStringLiteral {
    public let rawValue: String

    public init(rawValue: String) {
        self.rawValue = rawValue
    }

    public init(stringLiteral value: String) {
        self.rawValue = value
    }

    /// The corresponding `TimeZone` object, if valid.
    public var timeZone: TimeZone? {
        TimeZone(identifier: rawValue)
    }

    /// Validates that this timezone ID corresponds to a known timezone.
    public var isValid: Bool {
        timeZone != nil
    }
}

// MARK: - Coordinates

/// Geographic coordinates with branded types to prevent mixing lat/lon.
/// Swift equivalent of TypeScript: `interface Coordinates`
public struct Coordinates: Codable, Sendable, Hashable {
    public let latitude: Latitude
    public let longitude: Longitude

    public init(latitude: Latitude, longitude: Longitude) {
        self.latitude = latitude
        self.longitude = longitude
    }

    /// Creates coordinates from raw doubles, validating the values.
    /// - Parameters:
    ///   - lat: Latitude in degrees (-90 to 90)
    ///   - lon: Longitude in degrees (-180 to 180)
    /// - Throws: `LocationError` if values are out of range
    public static func validated(lat: Double, lon: Double) throws -> Coordinates {
        let latitude = try Latitude.validated(lat)
        let longitude = try Longitude.validated(lon)
        return Coordinates(latitude: latitude, longitude: longitude)
    }

    /// Check if two coordinates are approximately equal within a tolerance.
    public func isApproximatelyEqual(to other: Coordinates, toleranceDegrees: Double = 0.0001) -> Bool {
        abs(latitude.rawValue - other.latitude.rawValue) <= toleranceDegrees &&
            abs(longitude.rawValue - other.longitude.rawValue) <= toleranceDegrees
    }
}

// MARK: - Geocoding Result

/// Result from geocoding a location query.
/// Swift equivalent of TypeScript: `interface GeocodingResult`
public struct GeocodingResult: Codable, Sendable, Hashable {
    public let name: String
    public let coordinates: Coordinates
    public let country: String
    public let countryCode: String
    public let region: String?
    public let timezone: TimezoneId
    public let elevation: Elevation?
    public let population: Int?

    public init(
        name: String,
        coordinates: Coordinates,
        country: String,
        countryCode: String,
        region: String? = nil,
        timezone: TimezoneId,
        elevation: Elevation? = nil,
        population: Int? = nil
    ) {
        self.name = name
        self.coordinates = coordinates
        self.country = country
        self.countryCode = countryCode
        self.region = region
        self.timezone = timezone
        self.elevation = elevation
        self.population = population
    }
}

// MARK: - Location Entity

/// A resolved location with query and geocoding result.
/// Swift equivalent of TypeScript: `interface Location`
public struct LocationEntity: Codable, Sendable, Hashable, Identifiable {
    public let id: UUID
    public let query: String
    public let resolved: GeocodingResult

    public init(id: UUID = UUID(), query: String, resolved: GeocodingResult) {
        self.id = id
        self.query = query
        self.resolved = resolved
    }

    /// Convenience accessor for location name.
    public var name: String { resolved.name }

    /// Convenience accessor for coordinates.
    public var coordinates: Coordinates { resolved.coordinates }

    /// Convenience accessor for timezone.
    public var timezone: TimezoneId { resolved.timezone }
}

// MARK: - Location Errors

/// Errors that can occur during location validation.
public enum LocationError: Error, LocalizedError, Sendable {
    case invalidLatitude(Double)
    case invalidLongitude(Double)

    public var errorDescription: String? {
        switch self {
        case let .invalidLatitude(value):
            return "Latitude must be between -90 and 90, got \(value)"
        case let .invalidLongitude(value):
            return "Longitude must be between -180 and 180, got \(value)"
        }
    }
}
