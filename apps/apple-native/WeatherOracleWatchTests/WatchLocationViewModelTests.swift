import XCTest
import Combine
@testable import SharedKit
@testable import WeatherOracleWatch

// MARK: - Watch Location View Model Tests

@MainActor
final class WatchLocationViewModelTests: XCTestCase {
    var viewModel: WatchLocationViewModel!
    var mockStore: CloudSyncStore!
    var memoryStore: InMemoryKeyValueStore!

    override func setUp() async throws {
        memoryStore = InMemoryKeyValueStore()
        mockStore = CloudSyncStore(store: memoryStore)

        // Use mock client with fixture data
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

        let client = OpenMeteoClient(retryPolicy: .none, session: session)

        viewModel = WatchLocationViewModel(
            client: client,
            store: mockStore,
            models: [.ecmwf, .gfs]
        )
    }

    override func tearDown() async throws {
        viewModel = nil
        mockStore = nil
        memoryStore = nil
    }

    // MARK: - Initialization Tests

    func testInitialization() {
        XCTAssertTrue(viewModel.locations.isEmpty)
        XCTAssertNil(viewModel.selectedLocation)
        XCTAssertNil(viewModel.forecast)
        XCTAssertFalse(viewModel.isLoading)
    }

    func testLoadsExistingLocations() async throws {
        // Add a location to the store
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let location = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        mockStore.addLocation(location)

        // Create new view model - should load existing location
        let newViewModel = WatchLocationViewModel(store: mockStore, models: [.ecmwf])

        // Wait briefly for async operations
        try await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertEqual(newViewModel.locations.count, 1)
        XCTAssertEqual(newViewModel.locations.first?.name, "New York")
        XCTAssertEqual(newViewModel.selectedLocation?.name, "New York")
    }

    // MARK: - Location Selection Tests

    func testSelectLocation() async throws {
        // Add two locations
        let coords1 = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let location1 = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords1,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        let coords2 = try Coordinates.validated(lat: 51.5074, lon: -0.1278)
        let location2 = LocationEntity(
            query: "London",
            resolved: GeocodingResult(
                name: "London",
                coordinates: coords2,
                country: "UK",
                countryCode: "GB",
                timezone: "Europe/London"
            )
        )

        mockStore.addLocation(location1)
        mockStore.addLocation(location2)

        // Create view model and select second location
        let newViewModel = WatchLocationViewModel(store: mockStore, models: [.ecmwf])

        // Wait for initial load
        try await Task.sleep(nanoseconds: 200_000_000)

        // Select London
        newViewModel.selectLocation(location2)

        XCTAssertEqual(newViewModel.selectedLocation?.name, "London")

        // Wait for forecast fetch
        try await Task.sleep(nanoseconds: 500_000_000)

        XCTAssertNotNil(newViewModel.forecast)
    }

    // MARK: - Weather Fetching Tests

    func testFetchForecast() async throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let location = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        await viewModel.fetchForecast(for: location)

        // Verify forecast was loaded
        XCTAssertNotNil(viewModel.forecast)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
        XCTAssertNotNil(viewModel.lastUpdated)
    }

    func testRefresh() async throws {
        // Add location and select it
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let location = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        mockStore.addLocation(location)

        let newViewModel = WatchLocationViewModel(store: mockStore, models: [.ecmwf])

        // Wait for initial load
        try await Task.sleep(nanoseconds: 500_000_000)

        XCTAssertNotNil(newViewModel.forecast)
        let firstUpdate = newViewModel.lastUpdated

        // Wait a bit then refresh
        try await Task.sleep(nanoseconds: 100_000_000)

        await newViewModel.refresh()

        // Verify refresh updated timestamp
        XCTAssertNotNil(newViewModel.lastUpdated)
        if let first = firstUpdate, let second = newViewModel.lastUpdated {
            XCTAssertGreaterThanOrEqual(second, first)
        }
    }

    // MARK: - Computed Properties Tests

    func testComputedProperties() async throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let location = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        await viewModel.fetchForecast(for: location)

        // Verify computed properties
        XCTAssertNotNil(viewModel.currentTemperature)
        XCTAssertNotNil(viewModel.currentWeatherCode)
        XCTAssertNotNil(viewModel.todayHigh)
        XCTAssertNotNil(viewModel.todayLow)
        XCTAssertFalse(viewModel.todayCondition.isEmpty)
    }

    func testComputedPropertiesWithoutForecast() {
        // Without forecast, properties should be nil
        XCTAssertNil(viewModel.currentTemperature)
        XCTAssertNil(viewModel.currentWeatherCode)
        XCTAssertNil(viewModel.todayHigh)
        XCTAssertNil(viewModel.todayLow)
        XCTAssertEqual(viewModel.todayCondition, "Unknown")
    }

    // MARK: - iCloud Sync Tests

    func testObservesLocationChangesFromStore() async throws {
        // Add location to store
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let location = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        XCTAssertTrue(viewModel.locations.isEmpty)

        // Add location to store - should trigger update via publisher
        mockStore.addLocation(location)

        // Wait for publisher to fire
        try await Task.sleep(nanoseconds: 500_000_000) // Includes debounce

        // Verify location was loaded
        XCTAssertEqual(viewModel.locations.count, 1)
        XCTAssertEqual(viewModel.locations.first?.name, "New York")
    }

    func testHandlesLocationRemovalFromStore() async throws {
        // Add location
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let location = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )

        mockStore.addLocation(location)

        // Create new view model to pick up location
        let newViewModel = WatchLocationViewModel(store: mockStore, models: [.ecmwf])

        // Wait for load
        try await Task.sleep(nanoseconds: 500_000_000)

        XCTAssertEqual(newViewModel.locations.count, 1)
        XCTAssertNotNil(newViewModel.selectedLocation)

        // Remove location from store
        mockStore.removeLocation(id: location.id)

        // Wait for publisher
        try await Task.sleep(nanoseconds: 500_000_000)

        // Verify location was removed and selection cleared
        XCTAssertTrue(newViewModel.locations.isEmpty)
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
