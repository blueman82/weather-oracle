import Foundation

/// SharedKit provides shared business logic and models for the Weather Oracle app ecosystem.
public enum SharedKit {
    public static let version = "1.0.0"
}

// MARK: - Weather Models

/// Represents a weather condition
public enum WeatherCondition: String, Codable, Sendable {
    case sunny = "sunny"
    case cloudy = "cloudy"
    case rainy = "rainy"
    case snowy = "snowy"
    case stormy = "stormy"
    case foggy = "foggy"
    case windy = "windy"
    case partlyCloudy = "partly_cloudy"

    public var systemImageName: String {
        switch self {
        case .sunny: return "sun.max.fill"
        case .cloudy: return "cloud.fill"
        case .rainy: return "cloud.rain.fill"
        case .snowy: return "cloud.snow.fill"
        case .stormy: return "cloud.bolt.rain.fill"
        case .foggy: return "cloud.fog.fill"
        case .windy: return "wind"
        case .partlyCloudy: return "cloud.sun.fill"
        }
    }
}

/// Represents a temperature value with unit conversion
public struct Temperature: Codable, Sendable {
    public let celsius: Double

    public init(celsius: Double) {
        self.celsius = celsius
    }

    public init(fahrenheit: Double) {
        self.celsius = (fahrenheit - 32) * 5 / 9
    }

    public var fahrenheit: Double {
        celsius * 9 / 5 + 32
    }

    public func formatted(unit: TemperatureUnit = .fahrenheit) -> String {
        switch unit {
        case .celsius:
            return String(format: "%.0f°C", celsius)
        case .fahrenheit:
            return String(format: "%.0f°F", fahrenheit)
        }
    }
}

/// Temperature unit preference
public enum TemperatureUnit: String, Codable, Sendable {
    case celsius
    case fahrenheit
}

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

// MARK: - App Group Constants

public enum AppGroup {
    public static let identifier = "group.com.weatheroracle.app"

    public static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }
}
