import Foundation

// MARK: - Retry Policy

/// Configuration for retry behavior with exponential backoff
public struct RetryPolicy: Sendable {
    public let maxRetries: Int
    public let baseDelaySeconds: Double
    public let maxDelaySeconds: Double
    public let jitterFraction: Double

    public init(
        maxRetries: Int = 3,
        baseDelaySeconds: Double = 1.0,
        maxDelaySeconds: Double = 30.0,
        jitterFraction: Double = 0.1
    ) {
        self.maxRetries = maxRetries
        self.baseDelaySeconds = baseDelaySeconds
        self.maxDelaySeconds = maxDelaySeconds
        self.jitterFraction = jitterFraction
    }

    /// Default retry policy
    public static let `default` = RetryPolicy()

    /// No retries
    public static let none = RetryPolicy(maxRetries: 0)

    /// Aggressive retry policy for flaky networks
    public static let aggressive = RetryPolicy(
        maxRetries: 5,
        baseDelaySeconds: 0.5,
        maxDelaySeconds: 60.0
    )

    /// Calculate delay for a given attempt (0-indexed)
    public func delay(forAttempt attempt: Int) -> TimeInterval {
        let exponentialDelay = baseDelaySeconds * pow(2.0, Double(attempt))
        let cappedDelay = min(exponentialDelay, maxDelaySeconds)
        let jitter = cappedDelay * jitterFraction * Double.random(in: 0 ... 1)
        return cappedDelay + jitter
    }
}

// MARK: - Network Errors

/// Errors that can occur during Open-Meteo API requests
public enum OpenMeteoError: Error, LocalizedError, Sendable {
    case invalidURL
    case requestFailed(statusCode: Int, message: String)
    case rateLimited(retryAfterSeconds: Int?)
    case timeout
    case networkError(underlying: String)
    case decodingError(underlying: String)
    case apiError(reason: String)
    case noData

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL for Open-Meteo API request"
        case let .requestFailed(statusCode, message):
            return "Request failed with status \(statusCode): \(message)"
        case let .rateLimited(retryAfter):
            if let seconds = retryAfter {
                return "Rate limited. Retry after \(seconds) seconds"
            }
            return "Rate limited. Please try again later"
        case .timeout:
            return "Request timed out"
        case let .networkError(underlying):
            return "Network error: \(underlying)"
        case let .decodingError(underlying):
            return "Failed to decode response: \(underlying)"
        case let .apiError(reason):
            return "API error: \(reason)"
        case .noData:
            return "No data received from API"
        }
    }

    /// Whether this error is transient and worth retrying
    public var isTransient: Bool {
        switch self {
        case .rateLimited, .timeout, .networkError:
            return true
        case let .requestFailed(statusCode, _):
            // 5xx errors are server-side and may be transient
            return statusCode >= 500
        default:
            return false
        }
    }
}

// MARK: - API Response Types

/// Raw hourly data from Open-Meteo API
public struct OpenMeteoHourlyResponse: Codable, Sendable {
    public let time: [String]
    public let temperature_2m: [Double?]?
    public let apparent_temperature: [Double?]?
    public let relative_humidity_2m: [Double?]?
    public let surface_pressure: [Double?]?
    public let wind_speed_10m: [Double?]?
    public let wind_direction_10m: [Double?]?
    public let wind_gusts_10m: [Double?]?
    public let precipitation: [Double?]?
    public let precipitation_probability: [Double?]?
    public let cloud_cover: [Double?]?
    public let visibility: [Double?]?
    public let uv_index: [Double?]?
    public let weather_code: [Int?]?
}

/// Raw daily data from Open-Meteo API
public struct OpenMeteoDailyResponse: Codable, Sendable {
    public let time: [String]
    public let temperature_2m_max: [Double?]?
    public let temperature_2m_min: [Double?]?
    public let apparent_temperature_max: [Double?]?
    public let apparent_temperature_min: [Double?]?
    public let precipitation_sum: [Double?]?
    public let precipitation_probability_max: [Double?]?
    public let precipitation_hours: [Double?]?
    public let wind_speed_10m_max: [Double?]?
    public let wind_gusts_10m_max: [Double?]?
    public let wind_direction_10m_dominant: [Double?]?
    public let sunrise: [String?]?
    public let sunset: [String?]?
    public let daylight_duration: [Double?]?
    public let uv_index_max: [Double?]?
    public let weather_code: [Int?]?
}

/// Full Open-Meteo forecast API response
public struct OpenMeteoForecastResponse: Codable, Sendable {
    public let latitude: Double
    public let longitude: Double
    public let generationtime_ms: Double
    public let utc_offset_seconds: Int
    public let timezone: String
    public let timezone_abbreviation: String
    public let elevation: Double
    public let hourly_units: [String: String]?
    public let hourly: OpenMeteoHourlyResponse?
    public let daily_units: [String: String]?
    public let daily: OpenMeteoDailyResponse?
    public let error: Bool?
    public let reason: String?
}

/// Geocoding result from Open-Meteo API
public struct OpenMeteoGeocodingResult: Codable, Sendable {
    public let id: Int
    public let name: String
    public let latitude: Double
    public let longitude: Double
    public let elevation: Double?
    public let timezone: String
    public let country: String
    public let country_code: String
    public let admin1: String?
    public let admin2: String?
    public let admin3: String?
    public let population: Int?
}

/// Geocoding API response
public struct OpenMeteoGeocodingResponse: Codable, Sendable {
    public let results: [OpenMeteoGeocodingResult]?
    public let generationtime_ms: Double?
}

// MARK: - Open-Meteo Client

/// Async client for Open-Meteo weather API with retry and backoff support
public actor OpenMeteoClient {
    private let environment: OpenMeteoEnvironment
    private let retryPolicy: RetryPolicy
    private let session: URLSession
    private let decoder: JSONDecoder

    public init(
        environment: OpenMeteoEnvironment = .production,
        retryPolicy: RetryPolicy = .default,
        session: URLSession = .shared
    ) {
        self.environment = environment
        self.retryPolicy = retryPolicy
        self.session = session
        self.decoder = JSONDecoder()
    }

    // MARK: - Forecast Fetching

    /// Fetch forecast for a single model
    public func fetchForecast(
        model: ModelName,
        coordinates: Coordinates,
        forecastDays: Int = 7,
        timezone: String = "auto"
    ) async throws -> ModelForecast {
        var builder = OpenMeteoRequestBuilder(
            environment: environment,
            model: model,
            coordinates: coordinates
        )
        builder.forecastDays = forecastDays
        builder.timezone = timezone

        let url = builder.buildURL()
        let response: OpenMeteoForecastResponse = try await fetchWithRetry(url: url)

        // Check for API-level error
        if response.error == true {
            throw OpenMeteoError.apiError(reason: response.reason ?? "Unknown error")
        }

        return parseModelForecast(response: response, model: model, coordinates: coordinates)
    }

    /// Fetch forecasts from multiple models
    public func fetchForecasts(
        models: [ModelName],
        coordinates: Coordinates,
        forecastDays: Int = 7,
        timezone: String = "auto"
    ) async throws -> [ModelForecast] {
        try await withThrowingTaskGroup(of: ModelForecast.self) { group in
            for model in models {
                group.addTask {
                    try await self.fetchForecast(
                        model: model,
                        coordinates: coordinates,
                        forecastDays: forecastDays,
                        timezone: timezone
                    )
                }
            }

            var forecasts: [ModelForecast] = []
            for try await forecast in group {
                forecasts.append(forecast)
            }
            return forecasts
        }
    }

    // MARK: - Geocoding

    /// Search for locations by name
    public func searchLocations(query: String, count: Int = 10) async throws -> [GeocodingResult] {
        var builder = GeocodingRequestBuilder(environment: environment, query: query)
        builder.count = count

        let url = builder.buildURL()
        let response: OpenMeteoGeocodingResponse = try await fetchWithRetry(url: url)

        guard let results = response.results else {
            return []
        }

        return results.compactMap { result in
            guard let latitude = Latitude(rawValue: result.latitude),
                  let longitude = Longitude(rawValue: result.longitude)
            else {
                return nil
            }

            return GeocodingResult(
                name: result.name,
                coordinates: Coordinates(latitude: latitude, longitude: longitude),
                country: result.country,
                countryCode: result.country_code,
                region: result.admin1,
                timezone: TimezoneId(rawValue: result.timezone),
                elevation: result.elevation.map { Elevation(rawValue: $0) },
                population: result.population
            )
        }
    }

    // MARK: - Private Helpers

    /// Fetch with retry logic
    private func fetchWithRetry<T: Decodable>(url: URL) async throws -> T {
        var lastError: OpenMeteoError?

        for attempt in 0 ... retryPolicy.maxRetries {
            do {
                return try await performRequest(url: url)
            } catch let error as OpenMeteoError {
                lastError = error

                // Only retry transient errors
                guard error.isTransient, attempt < retryPolicy.maxRetries else {
                    throw error
                }

                // Handle rate limiting with Retry-After header if available
                if case let .rateLimited(retryAfter) = error, let seconds = retryAfter {
                    try await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
                } else {
                    let delay = retryPolicy.delay(forAttempt: attempt)
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }

        throw lastError ?? OpenMeteoError.networkError(underlying: "Unknown error after retries")
    }

    /// Perform a single HTTP request
    private func performRequest<T: Decodable>(url: URL) async throws -> T {
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 30

        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            switch error.code {
            case .timedOut:
                throw OpenMeteoError.timeout
            case .notConnectedToInternet, .networkConnectionLost:
                throw OpenMeteoError.networkError(underlying: error.localizedDescription)
            default:
                throw OpenMeteoError.networkError(underlying: error.localizedDescription)
            }
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw OpenMeteoError.networkError(underlying: "Invalid response type")
        }

        switch httpResponse.statusCode {
        case 200 ... 299:
            break
        case 429:
            let retryAfter = httpResponse.value(forHTTPHeaderField: "Retry-After")
                .flatMap { Int($0) }
            throw OpenMeteoError.rateLimited(retryAfterSeconds: retryAfter)
        case 400 ... 499:
            let message = String(data: data, encoding: .utf8) ?? "Client error"
            throw OpenMeteoError.requestFailed(statusCode: httpResponse.statusCode, message: message)
        case 500 ... 599:
            let message = String(data: data, encoding: .utf8) ?? "Server error"
            throw OpenMeteoError.requestFailed(statusCode: httpResponse.statusCode, message: message)
        default:
            throw OpenMeteoError.requestFailed(
                statusCode: httpResponse.statusCode,
                message: "Unexpected status code"
            )
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw OpenMeteoError.decodingError(underlying: error.localizedDescription)
        }
    }

    // MARK: - Response Parsing

    /// Parse Open-Meteo response into ModelForecast
    private func parseModelForecast(
        response: OpenMeteoForecastResponse,
        model: ModelName,
        coordinates: Coordinates
    ) -> ModelForecast {
        let now = Date()
        let hourlyForecasts = parseHourlyData(response.hourly)
        let dailyForecasts = parseDailyData(response.daily, hourlyForecasts: hourlyForecasts)

        let validFrom = hourlyForecasts.first?.timestamp ?? now
        let validTo = hourlyForecasts.last?.timestamp ?? now

        return ModelForecast(
            model: model,
            coordinates: coordinates,
            generatedAt: now,
            validFrom: validFrom,
            validTo: validTo,
            hourly: hourlyForecasts,
            daily: dailyForecasts
        )
    }

    /// Parse hourly response data
    private func parseHourlyData(_ hourly: OpenMeteoHourlyResponse?) -> [HourlyForecast] {
        guard let hourly = hourly else { return [] }

        // Open-Meteo uses format like "2025-01-15T00:00"
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)

        return hourly.time.enumerated().compactMap { index, timeString in
            guard let timestamp = formatter.date(from: timeString) else { return nil }

            let temp = safeGetDouble(hourly.temperature_2m, at: index)
            let feelsLike = safeGetDouble(hourly.apparent_temperature, at: index, default: temp)
            let gustValue = safeGet(hourly.wind_gusts_10m, at: index)

            let metrics = WeatherMetrics(
                temperature: Celsius(rawValue: temp),
                feelsLike: Celsius(rawValue: feelsLike),
                humidity: Humidity.clamped(safeGetDouble(hourly.relative_humidity_2m, at: index)),
                pressure: Pressure.clamped(safeGetDouble(hourly.surface_pressure, at: index, default: 1013)),
                windSpeed: MetersPerSecond.clamped(
                    safeGetDouble(hourly.wind_speed_10m, at: index) / 3.6 // km/h to m/s
                ),
                windDirection: WindDirection(rawValue: safeGetDouble(hourly.wind_direction_10m, at: index)),
                windGust: gustValue.map { MetersPerSecond.clamped($0 / 3.6) },
                precipitation: Millimeters.clamped(safeGetDouble(hourly.precipitation, at: index)),
                precipitationProbability: safeGetDouble(hourly.precipitation_probability, at: index) / 100,
                cloudCover: CloudCover.clamped(safeGetDouble(hourly.cloud_cover, at: index)),
                visibility: Visibility.clamped(safeGetDouble(hourly.visibility, at: index, default: 10000)),
                uvIndex: UVIndex.clamped(safeGetDouble(hourly.uv_index, at: index)),
                weatherCode: WeatherCode(rawValue: safeGetInt(hourly.weather_code, at: index)) ?? .clearSky
            )

            return HourlyForecast(timestamp: timestamp, metrics: metrics)
        }
    }

    /// Parse daily response data
    private func parseDailyData(
        _ daily: OpenMeteoDailyResponse?,
        hourlyForecasts: [HourlyForecast]
    ) -> [DailyForecast] {
        guard let daily = daily else { return [] }

        // Open-Meteo uses format like "2025-01-15" for dates
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)

        // For sunrise/sunset times like "2025-01-15T07:20"
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        timeFormatter.locale = Locale(identifier: "en_US_POSIX")
        timeFormatter.timeZone = TimeZone(secondsFromGMT: 0)

        return daily.time.enumerated().compactMap { index, dateString in
            guard let date = formatter.date(from: dateString) else { return nil }

            // Get hourly forecasts for this day
            let dayStart = Calendar.current.startOfDay(for: date)
            let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart)!
            let dayHourly = hourlyForecasts.filter { $0.timestamp >= dayStart && $0.timestamp < dayEnd }

            // Calculate ranges from hourly data
            let humidityValues = dayHourly.map { $0.metrics.humidity.rawValue }
            let pressureValues = dayHourly.map { $0.metrics.pressure.rawValue }
            let cloudValues = dayHourly.map { $0.metrics.cloudCover.rawValue }

            let humidityMin = humidityValues.min() ?? 0
            let humidityMax = humidityValues.max() ?? 100
            let pressureMin = pressureValues.min() ?? 1013
            let pressureMax = pressureValues.max() ?? 1013
            let cloudAvg = cloudValues.isEmpty ? 0 : cloudValues.reduce(0, +) / Double(cloudValues.count)
            let cloudMax = cloudValues.max() ?? 0

            // Parse sunrise/sunset
            let sunriseStr = safeGetString(daily.sunrise, at: index)
            let sunsetStr = safeGetString(daily.sunset, at: index)
            let sunriseDate = sunriseStr.flatMap { timeFormatter.date(from: $0) }
                ?? dayStart.addingTimeInterval(6 * 3600)
            let sunsetDate = sunsetStr.flatMap { timeFormatter.date(from: $0) }
                ?? dayStart.addingTimeInterval(18 * 3600)
            let daylightSeconds = safeGetDouble(daily.daylight_duration, at: index, default: 43200)
            let daylightHours = daylightSeconds / 3600

            let windMax = safeGetDouble(daily.wind_speed_10m_max, at: index)

            return DailyForecast(
                date: date,
                temperature: TemperatureRange(
                    min: Celsius(rawValue: safeGetDouble(daily.temperature_2m_min, at: index)),
                    max: Celsius(rawValue: safeGetDouble(daily.temperature_2m_max, at: index))
                ),
                humidityRange: HumidityRange(
                    min: Humidity.clamped(humidityMin),
                    max: Humidity.clamped(humidityMax)
                ),
                pressureRange: PressureRange(
                    min: Pressure.clamped(pressureMin),
                    max: Pressure.clamped(pressureMax)
                ),
                precipitation: PrecipitationSummary(
                    total: Millimeters.clamped(safeGetDouble(daily.precipitation_sum, at: index)),
                    probability: safeGetDouble(daily.precipitation_probability_max, at: index) / 100,
                    hours: Int(safeGetDouble(daily.precipitation_hours, at: index))
                ),
                wind: WindSummary(
                    avgSpeed: MetersPerSecond.clamped(windMax / 3.6 / 2), // rough avg
                    maxSpeed: MetersPerSecond.clamped(windMax / 3.6),
                    dominantDirection: WindDirection(
                        rawValue: safeGetDouble(daily.wind_direction_10m_dominant, at: index)
                    )
                ),
                cloudCoverSummary: CloudCoverSummary(
                    avg: CloudCover.clamped(cloudAvg),
                    max: CloudCover.clamped(cloudMax)
                ),
                uvIndexMax: UVIndex.clamped(safeGetDouble(daily.uv_index_max, at: index)),
                sun: SunTimes(
                    sunrise: sunriseDate,
                    sunset: sunsetDate,
                    daylightHours: daylightHours
                ),
                weatherCode: WeatherCode(rawValue: safeGetInt(daily.weather_code, at: index)) ?? .clearSky,
                hourly: dayHourly
            )
        }
    }
}

// MARK: - Safe Array Access

/// Safe element access helper functions
private func safeGet<T>(_ array: [T?]?, at index: Int) -> T? {
    guard let arr = array, index >= 0, index < arr.count else { return nil }
    return arr[index]
}

private func safeGetDouble(_ array: [Double?]?, at index: Int, default defaultValue: Double = 0) -> Double {
    safeGet(array, at: index) ?? defaultValue
}

private func safeGetInt(_ array: [Int?]?, at index: Int, default defaultValue: Int = 0) -> Int {
    safeGet(array, at: index) ?? defaultValue
}

private func safeGetString(_ array: [String?]?, at index: Int) -> String? {
    safeGet(array, at: index)
}
