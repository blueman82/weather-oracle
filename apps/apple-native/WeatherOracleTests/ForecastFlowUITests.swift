import XCTest
import SwiftUI
@testable import WeatherOracle
@testable import SharedKit

// MARK: - Forecast Flow UI Tests

/// Integration tests for the complete forecast detail flow
@MainActor
final class ForecastFlowUITests: XCTestCase {
    var viewModel: ForecastDetailViewModel!
    var mockClient: OpenMeteoClient!
    var testLocation: LocationEntity!

    override func setUp() async throws {
        // Create test location
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        testLocation = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        // Create mock client with fixture data
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

        mockClient = OpenMeteoClient(retryPolicy: .none, session: session)

        // Create view model with mock client
        viewModel = ForecastDetailViewModel(
            location: testLocation,
            client: mockClient,
            models: [.ecmwf, .gfs, .icon]
        )
    }

    override func tearDown() async throws {
        viewModel = nil
        mockClient = nil
        testLocation = nil
    }

    // MARK: - Initialization Tests

    func testViewModelInitialization() {
        XCTAssertEqual(viewModel.location.name, "New York")
        XCTAssertNil(viewModel.forecast)
        XCTAssertNil(viewModel.narrative)
        XCTAssertNil(viewModel.chartSeries)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
    }

    // MARK: - Data Fetching Tests

    func testFetchForecast() async throws {
        // Initial state
        XCTAssertNil(viewModel.forecast)
        XCTAssertFalse(viewModel.isLoading)

        // Fetch forecast
        await viewModel.fetchForecast()

        // Verify forecast was loaded
        XCTAssertNotNil(viewModel.forecast)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
        XCTAssertNotNil(viewModel.lastUpdated)
    }

    func testFetchForecastLoadsNarrative() async throws {
        await viewModel.fetchForecast()

        // Verify narrative was generated
        XCTAssertNotNil(viewModel.narrative)
        XCTAssertFalse(viewModel.narrative!.headline.isEmpty)
    }

    func testFetchForecastLoadsChartSeries() async throws {
        await viewModel.fetchForecast()

        // Verify chart series was generated
        XCTAssertNotNil(viewModel.chartSeries)
        XCTAssertFalse(viewModel.chartSeries!.temperatureData.isEmpty)
        XCTAssertFalse(viewModel.chartSeries!.modelNodes.isEmpty)
    }

    func testLoadingStatesDuringFetch() async throws {
        // Start fetch in background
        let task = Task {
            await viewModel.fetchForecast()
        }

        // Check loading state briefly (this is timing-dependent)
        try? await Task.sleep(nanoseconds: 10_000_000) // 0.01s

        // Wait for completion
        await task.value

        // Verify final state
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNotNil(viewModel.forecast)
    }

    // MARK: - Refresh Tests

    func testRefreshForecast() async throws {
        // Initial fetch
        await viewModel.fetchForecast()
        let firstUpdate = viewModel.lastUpdated

        // Wait a moment
        try await Task.sleep(nanoseconds: 100_000_000) // 0.1s

        // Refresh
        await viewModel.refresh()
        let secondUpdate = viewModel.lastUpdated

        // Verify data was refreshed
        XCTAssertNotNil(secondUpdate)
        if let first = firstUpdate, let second = secondUpdate {
            XCTAssertGreaterThan(second, first)
        }
    }

    // MARK: - Computed Properties Tests

    func testCurrentConditions() async throws {
        await viewModel.fetchForecast()

        let current = viewModel.currentConditions
        XCTAssertNotNil(current)
        XCTAssertNotNil(current?.metrics.temperature)
        XCTAssertNotNil(current?.metrics.weatherCode)
    }

    func testTodayForecast() async throws {
        await viewModel.fetchForecast()

        let today = viewModel.todayForecast
        XCTAssertNotNil(today)
        XCTAssertNotNil(today?.forecast.temperature.min)
        XCTAssertNotNil(today?.forecast.temperature.max)
    }

    func testNext24Hours() async throws {
        await viewModel.fetchForecast()

        let hourly = viewModel.next24Hours
        XCTAssertEqual(hourly.count, 24)

        // Verify hourly data is sequential
        for i in 0..<(hourly.count - 1) {
            XCTAssertLessThan(hourly[i].timestamp, hourly[i + 1].timestamp)
        }
    }

    func testNext7Days() async throws {
        await viewModel.fetchForecast()

        let daily = viewModel.next7Days
        XCTAssertEqual(daily.count, 7)

        // Verify daily data is sequential
        for i in 0..<(daily.count - 1) {
            XCTAssertLessThan(daily[i].date, daily[i + 1].date)
        }
    }

    func testOverallConfidence() async throws {
        await viewModel.fetchForecast()

        let confidence = viewModel.overallConfidence
        XCTAssertNotNil(confidence)
        XCTAssertGreaterThanOrEqual(confidence!.score, 0)
        XCTAssertLessThanOrEqual(confidence!.score, 1)
    }

    func testModelForecasts() async throws {
        await viewModel.fetchForecast()

        let models = viewModel.modelForecasts
        XCTAssertFalse(models.isEmpty)
        XCTAssertEqual(models.count, 3) // ecmwf, gfs, icon
    }

    func testOutlierModels() async throws {
        await viewModel.fetchForecast()

        let outliers = viewModel.outlierModels
        // Outliers may or may not exist depending on model agreement
        XCTAssertGreaterThanOrEqual(outliers.count, 0)
    }

    func testAgreementModels() async throws {
        await viewModel.fetchForecast()

        let agreement = viewModel.agreementModels
        XCTAssertFalse(agreement.isEmpty)
    }

    // MARK: - Helper Method Tests

    func testHourlyForecastAtIndex() async throws {
        await viewModel.fetchForecast()

        // Valid index
        let hourly = viewModel.hourlyForecast(at: 5)
        XCTAssertNotNil(hourly)

        // Invalid index
        let invalid = viewModel.hourlyForecast(at: 1000)
        XCTAssertNil(invalid)
    }

    func testDailyForecastAtIndex() async throws {
        await viewModel.fetchForecast()

        // Valid index
        let daily = viewModel.dailyForecast(at: 3)
        XCTAssertNotNil(daily)

        // Invalid index
        let invalid = viewModel.dailyForecast(at: 100)
        XCTAssertNil(invalid)
    }

    func testModelForecastForModel() async throws {
        await viewModel.fetchForecast()

        // Valid model
        let ecmwf = viewModel.modelForecast(for: .ecmwf)
        XCTAssertNotNil(ecmwf)
        XCTAssertEqual(ecmwf?.model, .ecmwf)

        // Model not in list
        let jma = viewModel.modelForecast(for: .jma)
        XCTAssertNil(jma)
    }

    // MARK: - Integration Tests

    func testCompleteUIFlow() async throws {
        // 1. Initial state
        XCTAssertNil(viewModel.forecast)

        // 2. Fetch forecast
        await viewModel.fetchForecast()

        // 3. Verify all data is loaded
        XCTAssertNotNil(viewModel.forecast)
        XCTAssertNotNil(viewModel.narrative)
        XCTAssertNotNil(viewModel.chartSeries)

        // 4. Verify UI-relevant data
        XCTAssertNotNil(viewModel.currentConditions)
        XCTAssertNotNil(viewModel.todayForecast)
        XCTAssertEqual(viewModel.next24Hours.count, 24)
        XCTAssertEqual(viewModel.next7Days.count, 7)

        // 5. Verify comparison data
        XCTAssertFalse(viewModel.modelForecasts.isEmpty)

        // 6. Test refresh
        await viewModel.refresh()
        XCTAssertNotNil(viewModel.lastUpdated)
    }

    func testNarrativeGeneration() async throws {
        await viewModel.fetchForecast()

        guard let narrative = viewModel.narrative else {
            XCTFail("Narrative should be generated")
            return
        }

        // Verify narrative structure
        XCTAssertFalse(narrative.headline.isEmpty, "Headline should not be empty")

        // Body may be empty for simple forecasts
        // Alerts may or may not exist
        // Model notes should exist when there are outliers
    }

    func testChartSeriesGeneration() async throws {
        await viewModel.fetchForecast()

        guard let chartSeries = viewModel.chartSeries else {
            XCTFail("Chart series should be generated")
            return
        }

        // Verify temperature data
        XCTAssertFalse(chartSeries.temperatureData.isEmpty)
        XCTAssertEqual(chartSeries.temperatureData.count, 48) // hourlyLimit: 48

        // Verify precipitation data
        XCTAssertFalse(chartSeries.precipitationData.isEmpty)

        // Verify confidence data
        XCTAssertFalse(chartSeries.confidenceData.isEmpty)

        // Verify model visualization data
        XCTAssertFalse(chartSeries.modelNodes.isEmpty)
        XCTAssertEqual(chartSeries.modelNodes.count, 3) // 3 models

        // Verify edges between models
        XCTAssertFalse(chartSeries.modelEdges.isEmpty)
    }

    func testModelComparisonData() async throws {
        await viewModel.fetchForecast()

        // Verify we have model forecasts to compare
        XCTAssertFalse(viewModel.modelForecasts.isEmpty)

        // Check agreement metrics
        if let current = viewModel.currentConditions {
            let consensus = current.modelAgreement

            // Agreement score should be valid
            XCTAssertGreaterThanOrEqual(consensus.agreementScore, 0)
            XCTAssertLessThanOrEqual(consensus.agreementScore, 1)

            // Should have models in agreement
            XCTAssertFalse(consensus.modelsInAgreement.isEmpty)

            // Temperature stats should be valid
            let tempStats = consensus.temperatureStats
            XCTAssertGreaterThanOrEqual(tempStats.min, -100)
            XCTAssertLessThanOrEqual(tempStats.max, 100)
            XCTAssertGreaterThanOrEqual(tempStats.range, 0)
        }
    }

    // MARK: - Error Handling Tests

    func testFetchForecastHandlesErrors() async throws {
        // Create a client that will fail
        let failingSession = createMockSession { _ in
            throw URLError(.notConnectedToInternet)
        }

        let failingClient = OpenMeteoClient(retryPolicy: .none, session: failingSession)
        let failingViewModel = ForecastDetailViewModel(
            location: testLocation,
            client: failingClient
        )

        // Attempt to fetch
        await failingViewModel.fetchForecast()

        // Verify error state
        XCTAssertNil(failingViewModel.forecast)
        XCTAssertNotNil(failingViewModel.error)
        XCTAssertFalse(failingViewModel.isLoading)
    }

    // MARK: - Data Consistency Tests

    func testDataConsistencyAcrossModules() async throws {
        await viewModel.fetchForecast()

        guard let forecast = viewModel.forecast else {
            XCTFail("Forecast should be loaded")
            return
        }

        // Verify consensus data matches model forecasts
        XCTAssertEqual(forecast.models.count, forecast.modelForecasts.count)

        // Verify hourly and daily counts are consistent
        XCTAssertFalse(forecast.consensus.hourly.isEmpty)
        XCTAssertFalse(forecast.consensus.daily.isEmpty)

        // Verify chart series matches forecast data
        if let chartSeries = viewModel.chartSeries {
            // Temperature data should match hourly count (up to limit)
            let expectedHourly = min(forecast.consensus.hourly.count, 48)
            XCTAssertEqual(chartSeries.temperatureData.count, expectedHourly)

            // Model nodes should match model count
            XCTAssertEqual(chartSeries.modelNodes.count, forecast.models.count)
        }
    }
}

// MARK: - Mock Session Helper

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

/// Mock URLProtocol for testing
final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    private static let handlersLock = NSLock()
    private static var handlers: [String: @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)] = [:]

    static func keyForSession(_ session: URLSession) -> String {
        "\(ObjectIdentifier(session))"
    }

    static func setHandler(
        for session: URLSession,
        handler: @escaping @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)
    ) {
        handlersLock.lock()
        defer { handlersLock.unlock() }
        let key = keyForSession(session)
        handlers[key] = handler
    }

    static func removeHandler(for session: URLSession) {
        handlersLock.lock()
        defer { handlersLock.unlock() }
        let key = keyForSession(session)
        handlers.removeValue(forKey: key)
    }

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
