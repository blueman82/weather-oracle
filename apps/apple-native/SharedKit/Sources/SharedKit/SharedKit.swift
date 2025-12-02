import Foundation

// MARK: - SharedKit

/// SharedKit provides shared business logic and models for the Weather Oracle app ecosystem.
public enum SharedKit {
    public static let version = "1.0.0"
}

// MARK: - WeatherCondition

/// Represents a weather condition for narrative generation
public enum WeatherCondition: String, Codable, Sendable, CaseIterable {
    case sunny
    case partlyCloudy = "partly_cloudy"
    case cloudy
    case overcast
    case fog
    case drizzle
    case rain
    case heavyRain = "heavy_rain"
    case thunderstorm
    case snow
    case sleet
    case unknown

    public var systemImageName: String {
        switch self {
        case .sunny: return "sun.max.fill"
        case .partlyCloudy: return "cloud.sun.fill"
        case .cloudy: return "cloud.fill"
        case .overcast: return "smoke.fill"
        case .fog: return "cloud.fog.fill"
        case .drizzle: return "cloud.drizzle.fill"
        case .rain: return "cloud.rain.fill"
        case .heavyRain: return "cloud.heavyrain.fill"
        case .thunderstorm: return "cloud.bolt.rain.fill"
        case .snow: return "cloud.snow.fill"
        case .sleet: return "cloud.sleet.fill"
        case .unknown: return "questionmark.circle"
        }
    }

    /// Whether this condition involves precipitation
    public var isPrecipitation: Bool {
        switch self {
        case .drizzle, .rain, .heavyRain, .thunderstorm, .snow, .sleet:
            return true
        default:
            return false
        }
    }

    /// Whether this is a dry condition
    public var isDry: Bool {
        switch self {
        case .sunny, .partlyCloudy, .cloudy, .overcast, .fog:
            return true
        default:
            return false
        }
    }

    /// Human-readable description
    public var conditionDescription: String {
        switch self {
        case .sunny: return "sunny"
        case .partlyCloudy: return "partly cloudy"
        case .cloudy: return "cloudy"
        case .overcast: return "overcast"
        case .fog: return "foggy"
        case .drizzle: return "light rain"
        case .rain: return "rain"
        case .heavyRain: return "heavy rain"
        case .thunderstorm: return "thunderstorms"
        case .snow: return "snow"
        case .sleet: return "sleet"
        case .unknown: return "mixed conditions"
        }
    }
}

// MARK: - Temperature

/// Represents a temperature value with unit conversion
public struct Temperature: Codable, Sendable {
    public let celsius: Double

    public init(celsius: Double) {
        self.celsius = celsius
    }

    public init(fahrenheit: Double) {
        celsius = (fahrenheit - 32) * 5 / 9
    }

    public var fahrenheit: Double {
        celsius * 9 / 5 + 32
    }

    public func formatted(unit: TemperatureUnit = .fahrenheit) -> String {
        switch unit {
        case .celsius:
            String(format: "%.0f°C", celsius)
        case .fahrenheit:
            String(format: "%.0f°F", fahrenheit)
        }
    }
}

// MARK: - TemperatureUnit

/// Temperature unit preference
public enum TemperatureUnit: String, Codable, Sendable, CaseIterable {
    case celsius
    case fahrenheit

    public static let `default`: TemperatureUnit = .celsius
}

// MARK: - WeatherForecast

/// A weather forecast entry
public struct WeatherForecast: Codable, Sendable, Identifiable {
    public let id: UUID
    public let date: Date
    public let temperature: Temperature
    public let condition: WeatherCondition
    public let humidity: Double
    public let windSpeed: Double
    public let location: String

    public init(
        id: UUID = UUID(),
        date: Date,
        temperature: Temperature,
        condition: WeatherCondition,
        humidity: Double,
        windSpeed: Double,
        location: String
    ) {
        self.id = id
        self.date = date
        self.temperature = temperature
        self.condition = condition
        self.humidity = humidity
        self.windSpeed = windSpeed
        self.location = location
    }
}

// MARK: - Location

/// Represents a geographic location
public struct Location: Codable, Sendable, Identifiable, Hashable {
    public let id: UUID
    public let name: String
    public let latitude: Double
    public let longitude: Double

    public init(id: UUID = UUID(), name: String, latitude: Double, longitude: Double) {
        self.id = id
        self.name = name
        self.latitude = latitude
        self.longitude = longitude
    }
}

// MARK: - AppGroup

public enum AppGroup {
    public static let identifier = "group.com.weatheroracle.app"

    public static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }
}
