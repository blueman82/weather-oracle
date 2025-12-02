import Foundation

// MARK: - Open-Meteo Environment

/// Environment configuration for Open-Meteo API endpoints.
/// Allows base URL overrides for development, testing, and staging.
public struct OpenMeteoEnvironment: Sendable {
    public let forecastBaseURL: URL
    public let geocodingBaseURL: URL

    public init(forecastBaseURL: URL, geocodingBaseURL: URL) {
        self.forecastBaseURL = forecastBaseURL
        self.geocodingBaseURL = geocodingBaseURL
    }

    /// Production environment using official Open-Meteo APIs
    public static let production = OpenMeteoEnvironment(
        forecastBaseURL: URL(string: "https://api.open-meteo.com")!,
        geocodingBaseURL: URL(string: "https://geocoding-api.open-meteo.com")!
    )

    /// Staging environment (can be customized for testing)
    public static func staging(forecastBaseURL: URL, geocodingBaseURL: URL) -> OpenMeteoEnvironment {
        OpenMeteoEnvironment(forecastBaseURL: forecastBaseURL, geocodingBaseURL: geocodingBaseURL)
    }
}

// MARK: - Model Endpoint Configuration

/// Endpoint configuration for each weather model
public struct ModelEndpointConfig: Sendable {
    public let path: String
    public let modelParam: String?

    public init(path: String, modelParam: String? = nil) {
        self.path = path
        self.modelParam = modelParam
    }
}

/// Endpoint mappings for each supported weather model
public enum OpenMeteoEndpoints {
    /// Returns endpoint config for a given model
    public static func config(for model: ModelName) -> ModelEndpointConfig {
        switch model {
        case .ecmwf:
            return ModelEndpointConfig(path: "/v1/ecmwf")
        case .gfs:
            return ModelEndpointConfig(path: "/v1/gfs")
        case .icon:
            return ModelEndpointConfig(path: "/v1/dwd-icon")
        case .meteofrance:
            return ModelEndpointConfig(path: "/v1/meteofrance")
        case .ukmo:
            return ModelEndpointConfig(path: "/v1/forecast", modelParam: "ukmo_seamless")
        case .jma:
            return ModelEndpointConfig(path: "/v1/jma")
        case .gem:
            return ModelEndpointConfig(path: "/v1/gem")
        }
    }

    /// Full URL for a model endpoint
    public static func url(for model: ModelName, environment: OpenMeteoEnvironment = .production) -> URL {
        let config = config(for: model)
        return environment.forecastBaseURL.appendingPathComponent(config.path)
    }

    /// Geocoding search URL
    public static func geocodingSearchURL(environment: OpenMeteoEnvironment = .production) -> URL {
        environment.geocodingBaseURL.appendingPathComponent("/v1/search")
    }
}

// MARK: - Query Parameters

/// Hourly variables to request from Open-Meteo API
public enum HourlyVariables {
    public static let standard: [String] = [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "surface_pressure",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "precipitation",
        "precipitation_probability",
        "cloud_cover",
        "visibility",
        "uv_index",
        "weather_code",
    ]

    public static var asQueryValue: String {
        standard.joined(separator: ",")
    }
}

/// Daily variables to request from Open-Meteo API
public enum DailyVariables {
    public static let standard: [String] = [
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "precipitation_sum",
        "precipitation_probability_max",
        "precipitation_hours",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "wind_direction_10m_dominant",
        "sunrise",
        "sunset",
        "daylight_duration",
        "uv_index_max",
        "weather_code",
    ]

    public static var asQueryValue: String {
        standard.joined(separator: ",")
    }
}

// MARK: - Request Builder

/// Builder for constructing Open-Meteo API request URLs
public struct OpenMeteoRequestBuilder: Sendable {
    public let environment: OpenMeteoEnvironment
    public let model: ModelName
    public let coordinates: Coordinates
    public var forecastDays: Int = 7
    public var timezone: String = "auto"

    public init(
        environment: OpenMeteoEnvironment = .production,
        model: ModelName,
        coordinates: Coordinates
    ) {
        self.environment = environment
        self.model = model
        self.coordinates = coordinates
    }

    /// Build the complete request URL with query parameters
    public func buildURL() -> URL {
        let baseURL = OpenMeteoEndpoints.url(for: model, environment: environment)
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: true)!

        var queryItems = [
            URLQueryItem(name: "latitude", value: String(coordinates.latitude.rawValue)),
            URLQueryItem(name: "longitude", value: String(coordinates.longitude.rawValue)),
            URLQueryItem(name: "hourly", value: HourlyVariables.asQueryValue),
            URLQueryItem(name: "daily", value: DailyVariables.asQueryValue),
            URLQueryItem(name: "timezone", value: timezone),
            URLQueryItem(name: "forecast_days", value: String(forecastDays)),
        ]

        // Add model parameter if required
        let config = OpenMeteoEndpoints.config(for: model)
        if let modelParam = config.modelParam {
            queryItems.append(URLQueryItem(name: "models", value: modelParam))
        }

        components.queryItems = queryItems
        return components.url!
    }
}

// MARK: - Geocoding Request Builder

/// Builder for constructing geocoding search request URLs
public struct GeocodingRequestBuilder: Sendable {
    public let environment: OpenMeteoEnvironment
    public let query: String
    public var count: Int = 10
    public var language: String = "en"

    public init(
        environment: OpenMeteoEnvironment = .production,
        query: String
    ) {
        self.environment = environment
        self.query = query
    }

    /// Build the complete geocoding request URL
    public func buildURL() -> URL {
        let baseURL = OpenMeteoEndpoints.geocodingSearchURL(environment: environment)
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: true)!

        components.queryItems = [
            URLQueryItem(name: "name", value: query),
            URLQueryItem(name: "count", value: String(count)),
            URLQueryItem(name: "language", value: language),
        ]

        return components.url!
    }
}
