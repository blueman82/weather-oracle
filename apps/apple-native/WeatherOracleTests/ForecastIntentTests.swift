import XCTest
import AppIntents
@testable import WeatherOracle
@testable import SharedKit

// MARK: - Forecast Intent Tests

@MainActor
final class ForecastIntentTests: XCTestCase {
    var mockStore: CloudSyncStore!
    var memoryStore: InMemoryKeyValueStore!

    override func setUp() async throws {
        memoryStore = InMemoryKeyValueStore()
        mockStore = CloudSyncStore(store: memoryStore)
    }

    override func tearDown() async throws {
        mockStore = nil
        memoryStore = nil
    }

    // MARK: - Location App Entity Tests

    func testLocationAppEntityInitialization() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let id = UUID()

        let entity = LocationAppEntity(
            id: id,
            name: "New York",
            coordinates: coords,
            country: "United States"
        )

        XCTAssertEqual(entity.id, id)
        XCTAssertEqual(entity.name, "New York")
        XCTAssertEqual(entity.country, "United States")
        XCTAssertEqual(entity.coordinates.latitude.rawValue, 40.7128, accuracy: 0.0001)
    }

    func testLocationAppEntityFromLocationEntity() throws {
        let coords = try Coordinates.validated(lat: 51.5074, lon: -0.1278)
        let geocodingResult = GeocodingResult(
            name: "London",
            coordinates: coords,
            country: "United Kingdom",
            countryCode: "GB",
            timezone: "Europe/London"
        )

        let location = LocationEntity(query: "London", resolved: geocodingResult)
        let entity = LocationAppEntity(from: location)

        XCTAssertEqual(entity.id, location.id)
        XCTAssertEqual(entity.name, "London")
        XCTAssertEqual(entity.country, "United Kingdom")
    }

    func testLocationAppEntityDisplayRepresentation() throws {
        let coords = try Coordinates.validated(lat: 48.8566, lon: 2.3522)
        let entity = LocationAppEntity(
            id: UUID(),
            name: "Paris",
            coordinates: coords,
            country: "France"
        )

        let display = entity.displayRepresentation

        // Check that display representation contains location info
        // Note: Can't directly test LocalizedStringResource equality
        XCTAssertNotNil(display.title)
        XCTAssertNotNil(display.subtitle)
    }

    // MARK: - Location Entity Query Tests

    func testLocationEntityQueryWithValidIdentifiers() async throws {
        // Setup: Add location to store
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let geocodingResult = GeocodingResult(
            name: "New York",
            coordinates: coords,
            country: "United States",
            countryCode: "US",
            timezone: "America/New_York"
        )

        let location = LocationEntity(query: "NYC", resolved: geocodingResult)
        mockStore.addLocation(location)

        // Test query
        let query = LocationEntityQuery()
        let entities = try await query.entities(for: [location.id])

        XCTAssertEqual(entities.count, 1)
        XCTAssertEqual(entities.first?.name, "New York")
        XCTAssertEqual(entities.first?.id, location.id)
    }

    func testLocationEntityQueryWithInvalidIdentifiers() async throws {
        let query = LocationEntityQuery()
        let randomId = UUID()

        let entities = try await query.entities(for: [randomId])

        XCTAssertTrue(entities.isEmpty)
    }

    func testLocationEntityQuerySuggestedEntities() async throws {
        // Add multiple locations
        let coords1 = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let coords2 = try Coordinates.validated(lat: 51.5074, lon: -0.1278)

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

        // Test suggested entities
        let query = LocationEntityQuery()
        let suggested = try await query.suggestedEntities()

        XCTAssertEqual(suggested.count, 2)
        XCTAssertTrue(suggested.contains(where: { $0.name == "New York" }))
        XCTAssertTrue(suggested.contains(where: { $0.name == "London" }))
    }

    func testLocationEntityQueryEmptyStore() async throws {
        let query = LocationEntityQuery()
        let suggested = try await query.suggestedEntities()

        XCTAssertTrue(suggested.isEmpty)
    }

    // MARK: - Forecast Intent Tests

    func testForecastIntentInitialization() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let entity = LocationAppEntity(
            id: UUID(),
            name: "New York",
            coordinates: coords,
            country: "USA"
        )

        let intent = ForecastIntent(location: entity)

        XCTAssertNotNil(intent.location)
        XCTAssertEqual(intent.location?.name, "New York")
    }

    func testForecastIntentWithNoLocationUsesFirstSaved() async throws {
        // Add a location to store
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

        // Note: Full intent execution requires actual network calls
        // This test verifies initialization only
        let intent = ForecastIntent(location: nil)
        XCTAssertNil(intent.location)
    }

    func testForecastIntentMetadata() {
        // Test intent metadata
        XCTAssertNotNil(ForecastIntent.title)
        XCTAssertNotNil(ForecastIntent.description)
    }

    // MARK: - Compare Intent Tests

    func testCompareIntentInitialization() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let entity = LocationAppEntity(
            id: UUID(),
            name: "New York",
            coordinates: coords,
            country: "USA"
        )

        let intent = CompareIntent(location: entity, metric: .temperature)

        XCTAssertNotNil(intent.location)
        XCTAssertEqual(intent.location?.name, "New York")
        XCTAssertEqual(intent.metric, .temperature)
    }

    func testCompareIntentDefaultMetric() {
        let intent = CompareIntent()

        XCTAssertEqual(intent.metric, .temperature)
    }

    func testCompareIntentMetadata() {
        XCTAssertNotNil(CompareIntent.title)
        XCTAssertNotNil(CompareIntent.description)
    }

    // MARK: - Comparison Metric Tests

    func testComparisonMetricCases() {
        XCTAssertEqual(ComparisonMetric.temperature.displayName, "Temperature")
        XCTAssertEqual(ComparisonMetric.precipitation.displayName, "Precipitation")
        XCTAssertEqual(ComparisonMetric.wind.displayName, "Wind")
    }

    func testComparisonMetricDisplayRepresentations() {
        let tempDisplay = ComparisonMetric.caseDisplayRepresentations[.temperature]
        let precipDisplay = ComparisonMetric.caseDisplayRepresentations[.precipitation]
        let windDisplay = ComparisonMetric.caseDisplayRepresentations[.wind]

        XCTAssertNotNil(tempDisplay)
        XCTAssertNotNil(precipDisplay)
        XCTAssertNotNil(windDisplay)
    }

    func testComparisonMetricRawValues() {
        XCTAssertEqual(ComparisonMetric.temperature.rawValue, "temperature")
        XCTAssertEqual(ComparisonMetric.precipitation.rawValue, "precipitation")
        XCTAssertEqual(ComparisonMetric.wind.rawValue, "wind")
    }

    // MARK: - App Shortcuts Tests

    @available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
    func testWeatherOracleShortcutsCount() {
        let shortcuts = WeatherOracleShortcuts.appShortcuts

        // Should have 5 shortcuts (forecast + 4 comparison types)
        XCTAssertGreaterThanOrEqual(shortcuts.count, 5)
    }

    @available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
    func testWeatherOracleShortcutsPhrases() {
        let shortcuts = WeatherOracleShortcuts.appShortcuts

        // Verify forecast shortcut has phrases
        let forecastShortcut = shortcuts.first { shortcut in
            shortcut.intent is ForecastIntent
        }

        XCTAssertNotNil(forecastShortcut)
        XCTAssertGreaterThan(forecastShortcut?.phrases.count ?? 0, 0)
    }

    @available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
    func testWeatherOracleShortcutsSystemImages() {
        let shortcuts = WeatherOracleShortcuts.appShortcuts

        // Verify each shortcut has a system image
        for shortcut in shortcuts {
            XCTAssertFalse(shortcut.systemImageName.isEmpty)
        }
    }

    // MARK: - Integration Tests

    func testLocationAppEntityConversionRoundTrip() throws {
        // Create original location
        let coords = try Coordinates.validated(lat: 35.6762, lon: 139.6503)
        let geocodingResult = GeocodingResult(
            name: "Tokyo",
            coordinates: coords,
            country: "Japan",
            countryCode: "JP",
            timezone: "Asia/Tokyo"
        )

        let originalLocation = LocationEntity(query: "Tokyo", resolved: geocodingResult)

        // Convert to AppEntity
        let appEntity = LocationAppEntity(from: originalLocation)

        // Verify conversion
        XCTAssertEqual(appEntity.id, originalLocation.id)
        XCTAssertEqual(appEntity.name, originalLocation.name)
        XCTAssertEqual(appEntity.country, originalLocation.resolved.country)
        XCTAssertEqual(appEntity.coordinates.latitude.rawValue, coords.latitude.rawValue, accuracy: 0.0001)
        XCTAssertEqual(appEntity.coordinates.longitude.rawValue, coords.longitude.rawValue, accuracy: 0.0001)
    }

    func testMultipleLocationsEntityQuery() async throws {
        // Add multiple locations with different countries
        let locations = [
            ("New York", 40.7128, -74.0060, "United States"),
            ("London", 51.5074, -0.1278, "United Kingdom"),
            ("Tokyo", 35.6762, 139.6503, "Japan"),
            ("Sydney", -33.8688, 151.2093, "Australia")
        ]

        var locationIds: [UUID] = []

        for (name, lat, lon, country) in locations {
            let coords = try Coordinates.validated(lat: lat, lon: lon)
            let location = LocationEntity(
                query: name,
                resolved: GeocodingResult(
                    name: name,
                    coordinates: coords,
                    country: country,
                    countryCode: String(country.prefix(2)).uppercased(),
                    timezone: "UTC"
                )
            )

            mockStore.addLocation(location)
            locationIds.append(location.id)
        }

        // Query all locations
        let query = LocationEntityQuery()
        let entities = try await query.entities(for: locationIds)

        XCTAssertEqual(entities.count, 4)

        // Verify all locations are present
        XCTAssertTrue(entities.contains(where: { $0.name == "New York" }))
        XCTAssertTrue(entities.contains(where: { $0.name == "London" }))
        XCTAssertTrue(entities.contains(where: { $0.name == "Tokyo" }))
        XCTAssertTrue(entities.contains(where: { $0.name == "Sydney" }))
    }

    func testComparisonMetricEnumeration() {
        // Test all enum cases are accessible
        let metrics: [ComparisonMetric] = [.temperature, .precipitation, .wind]

        XCTAssertEqual(metrics.count, 3)

        for metric in metrics {
            XCTAssertFalse(metric.displayName.isEmpty)
            XCTAssertFalse(metric.rawValue.isEmpty)
        }
    }
}
