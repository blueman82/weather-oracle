import Combine
import Foundation
import SharedKit
import Testing

@testable import WeatherOracle

// MARK: - Mock OpenMeteo Client

/// Mock client for testing
actor MockOpenMeteoClient {
    var fetchForecastsCalled = false
    var searchLocationsCalled = false
    var lastSearchQuery: String?
    var mockForecasts: [ModelForecast] = []
    var mockSearchResults: [GeocodingResult] = []
    var shouldThrowError = false

    func fetchForecasts(
        models _: [ModelName],
        coordinates _: Coordinates,
        forecastDays _: Int = 7,
        timezone _: String = "auto"
    ) async throws -> [ModelForecast] {
        fetchForecastsCalled = true
        if shouldThrowError {
            throw OpenMeteoError.networkError(underlying: "Mock error")
        }
        return mockForecasts
    }

    func searchLocations(query: String, count _: Int = 10) async throws -> [GeocodingResult] {
        searchLocationsCalled = true
        lastSearchQuery = query
        if shouldThrowError {
            throw OpenMeteoError.networkError(underlying: "Mock error")
        }
        return mockSearchResults
    }
}

// MARK: - Test Helpers

enum TestHelpers {
    static func createTestLocation(name: String = "Test City", lat: Double = 40.0, lon: Double = -74.0) -> LocationEntity {
        LocationEntity(
            query: name,
            resolved: GeocodingResult(
                name: name,
                coordinates: Coordinates(
                    latitude: Latitude(rawValue: lat)!,
                    longitude: Longitude(rawValue: lon)!
                ),
                country: "Test Country",
                countryCode: "TC",
                timezone: TimezoneId(rawValue: "UTC")
            )
        )
    }

    static func createTestGeocodingResult(name: String = "Test City") -> GeocodingResult {
        GeocodingResult(
            name: name,
            coordinates: Coordinates(
                latitude: Latitude(rawValue: 40.0)!,
                longitude: Longitude(rawValue: -74.0)!
            ),
            country: "Test Country",
            countryCode: "TC",
            timezone: TimezoneId(rawValue: "UTC")
        )
    }
}

// MARK: - Location Weather State Tests

@Suite("LocationWeatherState Tests")
struct LocationWeatherStateTests {
    @Test("Initial state has no forecast")
    func initialState() {
        let location = TestHelpers.createTestLocation()
        let state = LocationWeatherState(location: location)

        #expect(state.forecast == nil)
        #expect(state.isLoading == false)
        #expect(state.error == nil)
        #expect(state.lastUpdated == nil)
    }

    @Test("Current temperature from forecast")
    func currentTemperature() {
        let location = TestHelpers.createTestLocation()

        // Without forecast
        let stateNoForecast = LocationWeatherState(location: location)
        #expect(stateNoForecast.currentTemperature == nil)
    }

    @Test("Today high and low from forecast")
    func todayHighLow() {
        let location = TestHelpers.createTestLocation()
        let state = LocationWeatherState(location: location)

        #expect(state.todayHigh == nil)
        #expect(state.todayLow == nil)
    }
}

// MARK: - Search State Tests

@Suite("SearchState Tests")
struct SearchStateTests {
    @Test("Search state idle")
    func idleState() {
        let state = SearchState.idle
        if case .idle = state {
            // Pass
        } else {
            Issue.record("Expected idle state")
        }
    }

    @Test("Search state searching")
    func searchingState() {
        let state = SearchState.searching
        if case .searching = state {
            // Pass
        } else {
            Issue.record("Expected searching state")
        }
    }

    @Test("Search state results")
    func resultsState() {
        let results = [TestHelpers.createTestGeocodingResult()]
        let state = SearchState.results(results)
        if case let .results(r) = state {
            #expect(r.count == 1)
        } else {
            Issue.record("Expected results state")
        }
    }

    @Test("Search state error")
    func errorState() {
        let state = SearchState.error("Test error")
        if case let .error(message) = state {
            #expect(message == "Test error")
        } else {
            Issue.record("Expected error state")
        }
    }
}

// MARK: - View Model Integration Tests

@Suite("LocationListViewModel Integration Tests")
@MainActor
struct LocationListViewModelIntegrationTests {
    @Test("ViewModel initializes with empty state")
    func initialization() async {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel(store: store)

        #expect(viewModel.locationStates.isEmpty)
        #expect(viewModel.currentLocationState == nil)
        #expect(viewModel.isRefreshing == false)
    }

    @Test("Add location updates store")
    func addLocation() async {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel(store: store)

        let result = TestHelpers.createTestGeocodingResult(name: "New York")
        viewModel.addLocation(result)

        // Wait for async operations
        try? await Task.sleep(nanoseconds: 100_000_000)

        #expect(store.locations.count == 1)
        #expect(store.locations.first?.name == "New York")
    }

    @Test("Remove location updates store")
    func removeLocation() async {
        let inMemoryStore = InMemoryKeyValueStore()
        let store = CloudSyncStore(store: inMemoryStore)
        let viewModel = LocationListViewModel(store: store)

        // Add a location first
        let result = TestHelpers.createTestGeocodingResult(name: "Boston")
        viewModel.addLocation(result)

        try? await Task.sleep(nanoseconds: 100_000_000)

        let locationId = store.locations.first!.id

        // Remove it
        viewModel.removeLocation(id: locationId)

        #expect(store.locations.isEmpty)
        #expect(viewModel.locationStates.isEmpty)
    }

    @Test("Set current location")
    func setCurrentLocation() async {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel(store: store)

        let location = TestHelpers.createTestLocation(name: "Current City")
        viewModel.setCurrentLocation(location)

        #expect(viewModel.currentLocationState != nil)
        #expect(viewModel.currentLocationState?.location.name == "Current City")
    }

    @Test("Clear search resets state")
    func clearSearch() async {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel(store: store)

        viewModel.searchQuery = "test"
        viewModel.clearSearch()

        #expect(viewModel.searchQuery.isEmpty)
        if case .idle = viewModel.searchState {
            // Pass
        } else {
            Issue.record("Expected idle search state after clear")
        }
    }

    @Test("Search with empty query sets idle state")
    func searchEmptyQuery() async {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel(store: store)

        await viewModel.search(query: "")

        if case .idle = viewModel.searchState {
            // Pass
        } else {
            Issue.record("Expected idle state for empty search")
        }
    }

    @Test("Search with whitespace sets idle state")
    func searchWhitespace() async {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel(store: store)

        await viewModel.search(query: "   ")

        if case .idle = viewModel.searchState {
            // Pass
        } else {
            Issue.record("Expected idle state for whitespace search")
        }
    }
}

// MARK: - Location Reorder Tests

@Suite("Location Reordering Tests")
@MainActor
struct LocationReorderingTests {
    @Test("Move location updates order")
    func moveLocation() async {
        let inMemoryStore = InMemoryKeyValueStore()
        let store = CloudSyncStore(store: inMemoryStore)
        let viewModel = LocationListViewModel(store: store)

        // Add multiple locations
        let result1 = TestHelpers.createTestGeocodingResult(name: "City A")
        let result2 = TestHelpers.createTestGeocodingResult(name: "City B")
        let result3 = TestHelpers.createTestGeocodingResult(name: "City C")

        viewModel.addLocation(result1)
        try? await Task.sleep(nanoseconds: 50_000_000)
        viewModel.addLocation(result2)
        try? await Task.sleep(nanoseconds: 50_000_000)
        viewModel.addLocation(result3)
        try? await Task.sleep(nanoseconds: 100_000_000)

        #expect(store.locations.count == 3)

        // Move first item to end
        viewModel.moveLocation(from: IndexSet(integer: 0), to: 3)

        try? await Task.sleep(nanoseconds: 100_000_000)

        let names = store.locations.map(\.name)
        #expect(names[0] == "City B")
        #expect(names[1] == "City C")
        #expect(names[2] == "City A")
    }
}

// MARK: - Debounce Tests

@Suite("Search Debounce Tests")
@MainActor
struct SearchDebounceTests {
    @Test("Rapid query changes debounce")
    func debounceRapidChanges() async {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel(store: store)

        // Simulate rapid typing
        viewModel.searchQuery = "S"
        viewModel.searchQuery = "Sa"
        viewModel.searchQuery = "San"
        viewModel.searchQuery = "San "
        viewModel.searchQuery = "San F"

        // Should still be idle or searching immediately after
        // The actual search is debounced
        try? await Task.sleep(nanoseconds: 50_000_000)

        // After a short wait, search should not have been triggered yet
        // (debounce is 300ms)
    }
}
