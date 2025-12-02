@testable import SharedKit
import Foundation
import Testing

// MARK: - Mock URLProtocol

/// Deterministic URLProtocol mock for testing without network calls.
/// Uses a per-session handler lookup to avoid shared global state.
final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    /// Thread-safe storage for request handlers keyed by session identifier
    private static let handlersLock = NSLock()
    private static var handlers: [String: @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)] = [:]

    /// Generate a unique key for a session
    private static func keyForSession(_ session: URLSession) -> String {
        "\(ObjectIdentifier(session))"
    }

    /// Register a handler for a specific session
    static func setHandler(
        for session: URLSession,
        handler: @escaping @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)
    ) {
        handlersLock.lock()
        defer { handlersLock.unlock() }
        let key = keyForSession(session)
        handlers[key] = handler
    }

    /// Remove handler for a session
    static func removeHandler(for session: URLSession) {
        handlersLock.lock()
        defer { handlersLock.unlock() }
        let key = keyForSession(session)
        handlers.removeValue(forKey: key)
    }

    /// Get handler for a specific session key
    static func handler(forKey key: String) -> (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))? {
        handlersLock.lock()
        defer { handlersLock.unlock() }
        return handlers[key]
    }

    /// Clear all handlers (for test cleanup)
    static func clearAllHandlers() {
        handlersLock.lock()
        defer { handlersLock.unlock() }
        handlers.removeAll()
    }

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        // Get the handler from the first available (since we can't access session from URLProtocol)
        MockURLProtocol.handlersLock.lock()
        let handler = MockURLProtocol.handlers.values.first
        MockURLProtocol.handlersLock.unlock()

        guard let handler else {
            let error = NSError(domain: "MockURLProtocol", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "No handler registered for this request",
            ])
            client?.urlProtocol(self, didFailWithError: error)
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

// MARK: - Test Helpers

/// Creates a mock URLSession with a handler
func createMockSession(
    handler: @escaping @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)
) -> URLSession {
    MockURLProtocol.clearAllHandlers()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    let session = URLSession(configuration: configuration)
    MockURLProtocol.setHandler(for: session, handler: handler)
    return session
}

/// Atomic counter for thread-safe test counting
final class AtomicCounter: @unchecked Sendable {
    private var _value: Int = 0
    private let lock = NSLock()

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return _value
    }

    func increment() -> Int {
        lock.lock()
        defer { lock.unlock() }
        _value += 1
        return _value
    }
}

// MARK: - Endpoints Tests

@Suite("OpenMeteo Endpoints")
struct EndpointsTests {
    // MARK: - Environment Tests

    @Test("Production environment has correct URLs")
    func productionEnvironment() {
        let env = OpenMeteoEnvironment.production
        #expect(env.forecastBaseURL.absoluteString == "https://api.open-meteo.com")
        #expect(env.geocodingBaseURL.absoluteString == "https://geocoding-api.open-meteo.com")
    }

    @Test("Staging environment uses custom URLs")
    func stagingEnvironment() {
        let staging = OpenMeteoEnvironment.staging(
            forecastBaseURL: URL(string: "https://staging.example.com")!,
            geocodingBaseURL: URL(string: "https://geo-staging.example.com")!
        )
        #expect(staging.forecastBaseURL.absoluteString == "https://staging.example.com")
        #expect(staging.geocodingBaseURL.absoluteString == "https://geo-staging.example.com")
    }

    // MARK: - Model Endpoint Config Tests

    @Test("ECMWF endpoint configuration")
    func ecmwfEndpoint() {
        let config = OpenMeteoEndpoints.config(for: .ecmwf)
        #expect(config.path == "/v1/ecmwf")
        #expect(config.modelParam == nil)
    }

    @Test("GFS endpoint configuration")
    func gfsEndpoint() {
        let config = OpenMeteoEndpoints.config(for: .gfs)
        #expect(config.path == "/v1/gfs")
        #expect(config.modelParam == nil)
    }

    @Test("ICON endpoint configuration")
    func iconEndpoint() {
        let config = OpenMeteoEndpoints.config(for: .icon)
        #expect(config.path == "/v1/dwd-icon")
        #expect(config.modelParam == nil)
    }

    @Test("UKMO endpoint includes model parameter")
    func ukmoEndpoint() {
        let config = OpenMeteoEndpoints.config(for: .ukmo)
        #expect(config.path == "/v1/forecast")
        #expect(config.modelParam == "ukmo_seamless")
    }

    @Test("Model URL construction")
    func modelURL() {
        let url = OpenMeteoEndpoints.url(for: .ecmwf)
        #expect(url.absoluteString.contains("api.open-meteo.com"))
        #expect(url.absoluteString.contains("/v1/ecmwf"))
    }

    // MARK: - Request Builder Tests

    @Test("Request builder generates correct URL")
    func requestBuilderURL() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)
        let builder = OpenMeteoRequestBuilder(model: .ecmwf, coordinates: coords)
        let url = builder.buildURL()

        #expect(url.absoluteString.contains("latitude=40.7128"))
        #expect(url.absoluteString.contains("longitude=-74.006"))
        #expect(url.absoluteString.contains("hourly="))
        #expect(url.absoluteString.contains("daily="))
        #expect(url.absoluteString.contains("timezone=auto"))
        #expect(url.absoluteString.contains("forecast_days=7"))
    }

    @Test("Request builder with custom options")
    func requestBuilderCustomOptions() throws {
        let coords = try Coordinates.validated(lat: 51.5074, lon: -0.1278)
        var builder = OpenMeteoRequestBuilder(model: .gfs, coordinates: coords)
        builder.forecastDays = 14
        builder.timezone = "Europe/London"
        let url = builder.buildURL()

        #expect(url.absoluteString.contains("forecast_days=14"))
        #expect(url.absoluteString.contains("timezone=Europe/London"))
    }

    @Test("Request builder includes model parameter when needed")
    func requestBuilderWithModelParam() throws {
        let coords = try Coordinates.validated(lat: 51.5074, lon: -0.1278)
        let builder = OpenMeteoRequestBuilder(model: .ukmo, coordinates: coords)
        let url = builder.buildURL()

        #expect(url.absoluteString.contains("models=ukmo_seamless"))
    }

    // MARK: - Geocoding Builder Tests

    @Test("Geocoding request builder")
    func geocodingRequestBuilder() {
        let builder = GeocodingRequestBuilder(query: "New York")
        let url = builder.buildURL()

        #expect(url.absoluteString.contains("name=New%20York"))
        #expect(url.absoluteString.contains("count=10"))
        #expect(url.absoluteString.contains("language=en"))
    }

    // MARK: - Variables Tests

    @Test("Hourly variables include required fields")
    func hourlyVariables() {
        let vars = HourlyVariables.standard
        #expect(vars.contains("temperature_2m"))
        #expect(vars.contains("apparent_temperature"))
        #expect(vars.contains("precipitation"))
        #expect(vars.contains("weather_code"))
    }

    @Test("Hourly variables query value format")
    func hourlyVariablesQueryValue() {
        let query = HourlyVariables.asQueryValue
        #expect(query.contains("temperature_2m"))
        #expect(query.contains(","))
    }

    @Test("Daily variables include required fields")
    func dailyVariables() {
        let vars = DailyVariables.standard
        #expect(vars.contains("temperature_2m_max"))
        #expect(vars.contains("temperature_2m_min"))
        #expect(vars.contains("sunrise"))
        #expect(vars.contains("sunset"))
    }
}

// MARK: - Retry Policy Tests

@Suite("RetryPolicy")
struct RetryPolicyTests {
    @Test("Default policy configuration")
    func defaultPolicy() {
        let policy = RetryPolicy.default
        #expect(policy.maxRetries == 3)
        #expect(policy.baseDelaySeconds == 1.0)
        #expect(policy.maxDelaySeconds == 30.0)
    }

    @Test("No retry policy")
    func noRetryPolicy() {
        let policy = RetryPolicy.none
        #expect(policy.maxRetries == 0)
    }

    @Test("Aggressive policy configuration")
    func aggressivePolicy() {
        let policy = RetryPolicy.aggressive
        #expect(policy.maxRetries == 5)
        #expect(policy.baseDelaySeconds == 0.5)
    }

    @Test("Exponential backoff calculation")
    func exponentialBackoff() {
        let policy = RetryPolicy(
            maxRetries: 3,
            baseDelaySeconds: 1.0,
            maxDelaySeconds: 100.0,
            jitterFraction: 0.0 // No jitter for deterministic test
        )

        #expect(abs(policy.delay(forAttempt: 0) - 1.0) < 0.01)
        #expect(abs(policy.delay(forAttempt: 1) - 2.0) < 0.01)
        #expect(abs(policy.delay(forAttempt: 2) - 4.0) < 0.01)
        #expect(abs(policy.delay(forAttempt: 3) - 8.0) < 0.01)
    }

    @Test("Max delay cap without jitter")
    func maxDelayCap() {
        let policy = RetryPolicy(
            maxRetries: 10,
            baseDelaySeconds: 1.0,
            maxDelaySeconds: 5.0,
            jitterFraction: 0.0
        )

        // After enough attempts, delay should be capped at 5.0
        #expect(abs(policy.delay(forAttempt: 5) - 5.0) < 0.01)
    }

    @Test("Jitter stays within expected range")
    func jitterRange() {
        let policy = RetryPolicy(
            maxRetries: 3,
            baseDelaySeconds: 1.0,
            maxDelaySeconds: 100.0,
            jitterFraction: 0.5 // 50% jitter
        )

        // Base delay is 1.0, jitter adds 0 to 0.5
        let minExpected = 1.0
        let maxExpected = 1.5

        for _ in 0 ..< 10 {
            let delay = policy.delay(forAttempt: 0)
            #expect(delay >= minExpected)
            #expect(delay <= maxExpected)
        }
    }
}

// MARK: - OpenMeteo Error Tests

@Suite("OpenMeteoError")
struct OpenMeteoErrorTests {
    @Test("Error descriptions are not nil")
    func errorDescriptions() {
        #expect(OpenMeteoError.invalidURL.errorDescription != nil)
        #expect(OpenMeteoError.timeout.errorDescription != nil)
        #expect(OpenMeteoError.noData.errorDescription != nil)
    }

    @Test("Transient errors are identified correctly")
    func transientErrors() {
        #expect(OpenMeteoError.timeout.isTransient == true)
        #expect(OpenMeteoError.rateLimited(retryAfterSeconds: 60).isTransient == true)
        #expect(OpenMeteoError.networkError(underlying: "Connection lost").isTransient == true)
        #expect(OpenMeteoError.requestFailed(statusCode: 503, message: "").isTransient == true)
    }

    @Test("Non-transient errors are identified correctly")
    func nonTransientErrors() {
        #expect(OpenMeteoError.invalidURL.isTransient == false)
        #expect(OpenMeteoError.decodingError(underlying: "").isTransient == false)
        #expect(OpenMeteoError.apiError(reason: "").isTransient == false)
        #expect(OpenMeteoError.requestFailed(statusCode: 400, message: "").isTransient == false)
    }

    @Test("Rate limited error description includes retry time")
    func rateLimitedDescription() {
        let errorWithRetry = OpenMeteoError.rateLimited(retryAfterSeconds: 30)
        #expect(errorWithRetry.errorDescription?.contains("30") == true)

        let errorWithoutRetry = OpenMeteoError.rateLimited(retryAfterSeconds: nil)
        #expect(errorWithoutRetry.errorDescription?.contains("later") == true)
    }
}

// MARK: - OpenMeteoClient Tests

@Suite("OpenMeteoClient", .serialized)
struct OpenMeteoClientTests {
    @Test("Fetch forecast success with fixture data")
    func fetchForecastSuccess() async throws {
        let fixturePath = "/Users/harrison/Github/weather-oracle/apps/apple-native/SharedKit/Tests/Fixtures/openmeteo-response.json"
        let fixtureData = try Data(contentsOf: URL(fileURLWithPath: fixturePath))

        let session = createMockSession { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, fixtureData)
        }

        let client = OpenMeteoClient(
            retryPolicy: .none,
            session: session
        )

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)
        let forecast = try await client.fetchForecast(model: .ecmwf, coordinates: coords)

        #expect(forecast.model == .ecmwf)
        #expect(abs(forecast.coordinates.latitude.rawValue - 40.7128) < 0.001)
        #expect(forecast.hourly.count == 24)
        #expect(forecast.daily.count == 3)

        // Check first hourly forecast
        let firstHourly = forecast.hourly[0]
        #expect(abs(firstHourly.metrics.temperature.rawValue - 2.5) < 0.1)
        #expect(abs(firstHourly.metrics.humidity.rawValue - 85) < 0.1)

        // Check first daily forecast
        let firstDaily = forecast.daily[0]
        #expect(abs(firstDaily.temperature.max.rawValue - 12.1) < 0.1)
        #expect(abs(firstDaily.temperature.min.rawValue - 1.5) < 0.1)
    }

    @Test("Fetch forecast handles 429 rate limit with retry")
    func fetchForecast429RateLimit() async throws {
        let fixturePath = "/Users/harrison/Github/weather-oracle/apps/apple-native/SharedKit/Tests/Fixtures/openmeteo-response.json"
        let fixtureData = try Data(contentsOf: URL(fileURLWithPath: fixturePath))

        let counter = AtomicCounter()

        let session = createMockSession { request in
            let currentAttempt = counter.increment()

            if currentAttempt == 1 {
                let response = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 429,
                    httpVersion: nil,
                    headerFields: ["Retry-After": "1"]
                )!
                return (response, Data())
            }

            // Second attempt succeeds
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, fixtureData)
        }

        let client = OpenMeteoClient(
            retryPolicy: RetryPolicy(maxRetries: 2, baseDelaySeconds: 0.01),
            session: session
        )

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)
        let forecast = try await client.fetchForecast(model: .gfs, coordinates: coords)

        #expect(counter.value == 2)
        #expect(forecast.model == .gfs)
    }

    @Test("Fetch forecast retries on 500 server error")
    func fetchForecast500ServerError() async throws {
        let counter = AtomicCounter()

        let session = createMockSession { request in
            _ = counter.increment()

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 503,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, "Service unavailable".data(using: .utf8)!)
        }

        let client = OpenMeteoClient(
            retryPolicy: RetryPolicy(maxRetries: 2, baseDelaySeconds: 0.01),
            session: session
        )

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)

        do {
            _ = try await client.fetchForecast(model: .icon, coordinates: coords)
            Issue.record("Expected error to be thrown")
        } catch let error as OpenMeteoError {
            if case let .requestFailed(statusCode, _) = error {
                #expect(statusCode == 503)
            } else {
                Issue.record("Expected requestFailed error")
            }
        }

        // Should have retried maxRetries + 1 times (initial + retries)
        #expect(counter.value == 3)
    }

    @Test("Fetch forecast does not retry on 400 client error")
    func fetchForecast400ClientError() async throws {
        let counter = AtomicCounter()

        let session = createMockSession { request in
            _ = counter.increment()

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 400,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, "Bad request".data(using: .utf8)!)
        }

        let client = OpenMeteoClient(
            retryPolicy: RetryPolicy(maxRetries: 3, baseDelaySeconds: 0.01),
            session: session
        )

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)

        do {
            _ = try await client.fetchForecast(model: .meteofrance, coordinates: coords)
            Issue.record("Expected error to be thrown")
        } catch let error as OpenMeteoError {
            if case let .requestFailed(statusCode, _) = error {
                #expect(statusCode == 400)
            } else {
                Issue.record("Expected requestFailed error")
            }
        }

        // Should NOT retry 4xx errors (except 429)
        #expect(counter.value == 1)
    }

    @Test("Fetch multiple models concurrently")
    func fetchMultipleModels() async throws {
        let fixturePath = "/Users/harrison/Github/weather-oracle/apps/apple-native/SharedKit/Tests/Fixtures/openmeteo-response.json"
        let fixtureData = try Data(contentsOf: URL(fileURLWithPath: fixturePath))

        let session = createMockSession { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, fixtureData)
        }

        let client = OpenMeteoClient(
            retryPolicy: .none,
            session: session
        )

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)
        let forecasts = try await client.fetchForecasts(
            models: [.ecmwf, .gfs, .icon],
            coordinates: coords
        )

        #expect(forecasts.count == 3)
        let models = Set(forecasts.map(\.model))
        #expect(models.contains(.ecmwf))
        #expect(models.contains(.gfs))
        #expect(models.contains(.icon))
    }

    @Test("Search locations returns results")
    func searchLocations() async throws {
        let geocodingResponse = """
        {
            "results": [
                {
                    "id": 5128581,
                    "name": "New York",
                    "latitude": 40.7128,
                    "longitude": -74.006,
                    "elevation": 10.0,
                    "timezone": "America/New_York",
                    "country": "United States",
                    "country_code": "US",
                    "admin1": "New York"
                }
            ],
            "generationtime_ms": 0.5
        }
        """.data(using: .utf8)!

        let session = createMockSession { request in
            #expect(request.url!.absoluteString.contains("name=New%20York"))
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, geocodingResponse)
        }

        let client = OpenMeteoClient(
            retryPolicy: .none,
            session: session
        )

        let results = try await client.searchLocations(query: "New York")

        #expect(results.count == 1)
        #expect(results[0].name == "New York")
        #expect(results[0].country == "United States")
        #expect(results[0].countryCode == "US")
        #expect(abs(results[0].coordinates.latitude.rawValue - 40.7128) < 0.001)
    }

    @Test("Search locations handles empty results")
    func searchLocationsEmpty() async throws {
        let geocodingResponse = """
        {
            "generationtime_ms": 0.3
        }
        """.data(using: .utf8)!

        let session = createMockSession { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, geocodingResponse)
        }

        let client = OpenMeteoClient(
            retryPolicy: .none,
            session: session
        )

        let results = try await client.searchLocations(query: "XYZNONEXISTENT")

        #expect(results.isEmpty)
    }

    @Test("API error response is handled correctly")
    func apiErrorResponse() async throws {
        let errorResponse = """
        {
            "latitude": 40.7128,
            "longitude": -74.006,
            "generationtime_ms": 0.1,
            "utc_offset_seconds": 0,
            "timezone": "GMT",
            "timezone_abbreviation": "GMT",
            "elevation": 0,
            "error": true,
            "reason": "Invalid parameter combination"
        }
        """.data(using: .utf8)!

        let session = createMockSession { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, errorResponse)
        }

        let client = OpenMeteoClient(
            retryPolicy: .none,
            session: session
        )

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)

        do {
            _ = try await client.fetchForecast(model: .ecmwf, coordinates: coords)
            Issue.record("Expected API error")
        } catch let error as OpenMeteoError {
            if case let .apiError(reason) = error {
                #expect(reason == "Invalid parameter combination")
            } else {
                Issue.record("Expected apiError, got \(error)")
            }
        }
    }

    @Test("Timeout error is simulated correctly")
    func timeoutHandling() async throws {
        let session = createMockSession { _ in
            throw URLError(.timedOut)
        }

        let client = OpenMeteoClient(
            retryPolicy: .none,
            session: session
        )

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)

        do {
            _ = try await client.fetchForecast(model: .ecmwf, coordinates: coords)
            Issue.record("Expected timeout error")
        } catch let error as OpenMeteoError {
            if case .timeout = error {
                // Success - correct error type
            } else {
                Issue.record("Expected timeout error, got \(error)")
            }
        }
    }
}

// MARK: - Response Parsing Tests

@Suite("Response Parsing")
struct ResponseParsingTests {
    @Test("Hourly response decoding")
    func hourlyResponseDecoding() throws {
        let json = """
        {
            "time": ["2025-01-15T00:00", "2025-01-15T01:00"],
            "temperature_2m": [5.0, 5.5],
            "precipitation": [0.0, 0.1],
            "weather_code": [0, 1]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(OpenMeteoHourlyResponse.self, from: json)

        #expect(response.time.count == 2)
        #expect(response.temperature_2m?[0] == 5.0)
        #expect(response.weather_code?[1] == 1)
    }

    @Test("Daily response decoding")
    func dailyResponseDecoding() throws {
        let json = """
        {
            "time": ["2025-01-15"],
            "temperature_2m_max": [12.0],
            "temperature_2m_min": [2.0],
            "precipitation_sum": [5.5],
            "sunrise": ["2025-01-15T07:20"],
            "sunset": ["2025-01-15T16:55"]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(OpenMeteoDailyResponse.self, from: json)

        #expect(response.time.count == 1)
        #expect(response.temperature_2m_max?[0] == 12.0)
        #expect(response.sunrise?[0] == "2025-01-15T07:20")
    }

    @Test("Geocoding result decoding")
    func geocodingResultDecoding() throws {
        let json = """
        {
            "id": 5128581,
            "name": "New York",
            "latitude": 40.7128,
            "longitude": -74.006,
            "elevation": 10.0,
            "timezone": "America/New_York",
            "country": "United States",
            "country_code": "US",
            "admin1": "New York",
            "population": 8336817
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder().decode(OpenMeteoGeocodingResult.self, from: json)

        #expect(result.name == "New York")
        #expect(result.population == 8_336_817)
        #expect(result.timezone == "America/New_York")
    }

    @Test("Full forecast response decoding from fixture")
    func fullForecastResponseDecoding() throws {
        let fixturePath = "/Users/harrison/Github/weather-oracle/apps/apple-native/SharedKit/Tests/Fixtures/openmeteo-response.json"
        let fixtureData = try Data(contentsOf: URL(fileURLWithPath: fixturePath))

        let response = try JSONDecoder().decode(OpenMeteoForecastResponse.self, from: fixtureData)

        #expect(abs(response.latitude - 40.7128) < 0.001)
        #expect(abs(response.longitude - (-74.006)) < 0.001)
        #expect(response.timezone == "America/New_York")
        #expect(response.hourly?.time.count == 24)
        #expect(response.daily?.time.count == 3)
        #expect(response.error == nil)
    }
}
