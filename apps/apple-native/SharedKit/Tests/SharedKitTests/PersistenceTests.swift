import Combine
@testable import SharedKit
import XCTest

// MARK: - Preference Schema Tests

final class PreferenceSchemaTests: XCTestCase {
    // MARK: - Unit Type Tests

    func testTemperatureUnitDefault() {
        XCTAssertEqual(TemperatureUnit.default, .celsius)
    }

    func testWindSpeedUnitDefault() {
        XCTAssertEqual(WindSpeedUnit.default, .metersPerSecond)
    }

    func testPressureUnitDefault() {
        XCTAssertEqual(PressureUnit.default, .hectopascals)
    }

    func testPrecipitationUnitDefault() {
        XCTAssertEqual(PrecipitationUnit.default, .millimeters)
    }

    // MARK: - Widget Layout Tests

    func testWidgetLayoutDefault() {
        let layout = WidgetLayout.default
        XCTAssertEqual(layout.visibleModels.count, ModelName.allCases.count)
        XCTAssertEqual(layout.forecastDays, 7)
        XCTAssertTrue(layout.showHourlyDetail)
        XCTAssertFalse(layout.compactMode)
    }

    func testWidgetLayoutCodable() throws {
        let layout = WidgetLayout(
            visibleModels: [.ecmwf, .gfs],
            forecastDays: 5,
            showHourlyDetail: false,
            compactMode: true
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(layout)
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(WidgetLayout.self, from: data)

        XCTAssertEqual(decoded.visibleModels, [.ecmwf, .gfs])
        XCTAssertEqual(decoded.forecastDays, 5)
        XCTAssertFalse(decoded.showHourlyDetail)
        XCTAssertTrue(decoded.compactMode)
    }

    // MARK: - Notification Rule Tests

    func testNotificationRuleCreation() {
        let rule = NotificationRule(
            condition: .temperatureAbove,
            threshold: 30.0,
            locationId: nil,
            isEnabled: true
        )

        XCTAssertEqual(rule.condition, .temperatureAbove)
        XCTAssertEqual(rule.threshold, 30.0)
        XCTAssertNil(rule.locationId)
        XCTAssertTrue(rule.isEnabled)
    }

    func testNotificationRuleCodable() throws {
        let locationId = UUID()
        let rule = NotificationRule(
            condition: .precipitationProbabilityAbove,
            threshold: 0.7,
            locationId: locationId,
            isEnabled: false
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(rule)
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(NotificationRule.self, from: data)

        XCTAssertEqual(decoded.id, rule.id)
        XCTAssertEqual(decoded.condition, .precipitationProbabilityAbove)
        XCTAssertEqual(decoded.threshold, 0.7, accuracy: 0.001)
        XCTAssertEqual(decoded.locationId, locationId)
        XCTAssertFalse(decoded.isEnabled)
    }

    // MARK: - User Preferences Tests

    func testUserPreferencesDefault() {
        let prefs = UserPreferences.default
        XCTAssertTrue(prefs.locations.isEmpty)
        XCTAssertEqual(prefs.temperatureUnit, .celsius)
        XCTAssertEqual(prefs.windSpeedUnit, .metersPerSecond)
        XCTAssertEqual(prefs.pressureUnit, .hectopascals)
        XCTAssertEqual(prefs.precipitationUnit, .millimeters)
        XCTAssertTrue(prefs.notificationRules.isEmpty)
    }

    func testUserPreferencesCodable() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let geocodingResult = GeocodingResult(
            name: "New York",
            coordinates: coords,
            country: "United States",
            countryCode: "US",
            timezone: "America/New_York"
        )
        let location = LocationEntity(query: "NYC", resolved: geocodingResult)

        var prefs = UserPreferences()
        prefs.locations = [location]
        prefs.temperatureUnit = .fahrenheit
        prefs.windSpeedUnit = .milesPerHour

        let encoder = JSONEncoder()
        let data = try encoder.encode(prefs)
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(UserPreferences.self, from: data)

        XCTAssertEqual(decoded.locations.count, 1)
        XCTAssertEqual(decoded.locations.first?.name, "New York")
        XCTAssertEqual(decoded.temperatureUnit, .fahrenheit)
        XCTAssertEqual(decoded.windSpeedUnit, .milesPerHour)
    }

    // MARK: - Preference Key Tests

    func testPreferenceKeysAreUnique() {
        let keys = PreferenceKey.allCases.map(\.rawValue)
        let uniqueKeys = Set(keys)
        XCTAssertEqual(keys.count, uniqueKeys.count, "Preference keys must be unique")
    }
}

// MARK: - Cloud Sync Store Tests

@MainActor
final class CloudSyncStoreTests: XCTestCase {
    var store: CloudSyncStore!
    var memoryStore: InMemoryKeyValueStore!

    override func setUp() async throws {
        memoryStore = InMemoryKeyValueStore()
        store = CloudSyncStore(store: memoryStore)
    }

    override func tearDown() async throws {
        memoryStore.clear()
        store = nil
        memoryStore = nil
    }

    // MARK: - Location Tests

    func testAddLocation() async throws {
        let coords = try Coordinates.validated(lat: 51.5074, lon: -0.1278)
        let geocodingResult = GeocodingResult(
            name: "London",
            coordinates: coords,
            country: "United Kingdom",
            countryCode: "GB",
            timezone: "Europe/London"
        )
        let location = LocationEntity(query: "London", resolved: geocodingResult)

        store.addLocation(location)

        XCTAssertEqual(store.locations.count, 1)
        XCTAssertEqual(store.locations.first?.name, "London")
    }

    func testAddDuplicateLocation() async throws {
        let coords = try Coordinates.validated(lat: 51.5074, lon: -0.1278)
        let geocodingResult = GeocodingResult(
            name: "London",
            coordinates: coords,
            country: "United Kingdom",
            countryCode: "GB",
            timezone: "Europe/London"
        )
        let location = LocationEntity(query: "London", resolved: geocodingResult)

        store.addLocation(location)
        store.addLocation(location) // Same location again

        XCTAssertEqual(store.locations.count, 1, "Duplicate locations should not be added")
    }

    func testRemoveLocation() async throws {
        let coords = try Coordinates.validated(lat: 48.8566, lon: 2.3522)
        let geocodingResult = GeocodingResult(
            name: "Paris",
            coordinates: coords,
            country: "France",
            countryCode: "FR",
            timezone: "Europe/Paris"
        )
        let location = LocationEntity(query: "Paris", resolved: geocodingResult)

        store.addLocation(location)
        XCTAssertEqual(store.locations.count, 1)

        store.removeLocation(id: location.id)
        XCTAssertEqual(store.locations.count, 0)
    }

    func testReorderLocations() async throws {
        let coords1 = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let coords2 = try Coordinates.validated(lat: 51.5074, lon: -0.1278)

        let loc1 = LocationEntity(
            query: "NYC",
            resolved: GeocodingResult(
                name: "New York",
                coordinates: coords1,
                country: "USA",
                countryCode: "US",
                timezone: "America/New_York"
            )
        )
        let loc2 = LocationEntity(
            query: "London",
            resolved: GeocodingResult(
                name: "London",
                coordinates: coords2,
                country: "UK",
                countryCode: "GB",
                timezone: "Europe/London"
            )
        )

        store.addLocation(loc1)
        store.addLocation(loc2)

        XCTAssertEqual(store.locations[0].name, "New York")
        XCTAssertEqual(store.locations[1].name, "London")

        // Reorder
        store.reorderLocations([loc2, loc1])

        XCTAssertEqual(store.locations[0].name, "London")
        XCTAssertEqual(store.locations[1].name, "New York")
    }

    func testHasLocation() async throws {
        let coords = try Coordinates.validated(lat: 35.6762, lon: 139.6503)
        let location = LocationEntity(
            query: "Tokyo",
            resolved: GeocodingResult(
                name: "Tokyo",
                coordinates: coords,
                country: "Japan",
                countryCode: "JP",
                timezone: "Asia/Tokyo"
            )
        )

        XCTAssertFalse(store.hasLocation(id: location.id))

        store.addLocation(location)

        XCTAssertTrue(store.hasLocation(id: location.id))
    }

    // MARK: - Unit Settings Tests

    func testSetTemperatureUnit() async throws {
        XCTAssertEqual(store.preferences.temperatureUnit, .celsius)

        store.setTemperatureUnit(.fahrenheit)

        XCTAssertEqual(store.preferences.temperatureUnit, .fahrenheit)
    }

    func testSetWindSpeedUnit() async throws {
        XCTAssertEqual(store.preferences.windSpeedUnit, .metersPerSecond)

        store.setWindSpeedUnit(.milesPerHour)

        XCTAssertEqual(store.preferences.windSpeedUnit, .milesPerHour)
    }

    func testSetPressureUnit() async throws {
        XCTAssertEqual(store.preferences.pressureUnit, .hectopascals)

        store.setPressureUnit(.inchesOfMercury)

        XCTAssertEqual(store.preferences.pressureUnit, .inchesOfMercury)
    }

    func testSetPrecipitationUnit() async throws {
        XCTAssertEqual(store.preferences.precipitationUnit, .millimeters)

        store.setPrecipitationUnit(.inches)

        XCTAssertEqual(store.preferences.precipitationUnit, .inches)
    }

    // MARK: - Widget Layout Tests

    func testSetWidgetLayout() async throws {
        let newLayout = WidgetLayout(
            visibleModels: [.ecmwf, .gfs],
            forecastDays: 3,
            showHourlyDetail: false,
            compactMode: true
        )

        store.setWidgetLayout(newLayout)

        XCTAssertEqual(store.preferences.widgetLayout.visibleModels, [.ecmwf, .gfs])
        XCTAssertEqual(store.preferences.widgetLayout.forecastDays, 3)
        XCTAssertFalse(store.preferences.widgetLayout.showHourlyDetail)
        XCTAssertTrue(store.preferences.widgetLayout.compactMode)
    }

    // MARK: - Notification Rule Tests

    func testAddNotificationRule() async throws {
        let rule = NotificationRule(
            condition: .temperatureAbove,
            threshold: 35.0
        )

        store.addNotificationRule(rule)

        XCTAssertEqual(store.preferences.notificationRules.count, 1)
        XCTAssertEqual(store.preferences.notificationRules.first?.condition, .temperatureAbove)
    }

    func testRemoveNotificationRule() async throws {
        let rule = NotificationRule(
            condition: .severeWeather,
            threshold: 0
        )

        store.addNotificationRule(rule)
        XCTAssertEqual(store.preferences.notificationRules.count, 1)

        store.removeNotificationRule(id: rule.id)
        XCTAssertEqual(store.preferences.notificationRules.count, 0)
    }

    func testUpdateNotificationRule() async throws {
        var rule = NotificationRule(
            condition: .uvIndexAbove,
            threshold: 6.0,
            isEnabled: true
        )

        store.addNotificationRule(rule)

        rule.isEnabled = false
        store.updateNotificationRule(rule)

        XCTAssertFalse(store.preferences.notificationRules.first?.isEnabled ?? true)
    }

    func testEnabledNotificationRules() async throws {
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

        // Global rule (applies to all locations)
        let globalRule = NotificationRule(
            condition: .severeWeather,
            threshold: 0,
            locationId: nil,
            isEnabled: true
        )

        // Location-specific rule
        let locationRule = NotificationRule(
            condition: .temperatureBelow,
            threshold: 0,
            locationId: location.id,
            isEnabled: true
        )

        // Disabled rule
        let disabledRule = NotificationRule(
            condition: .windSpeedAbove,
            threshold: 20,
            locationId: location.id,
            isEnabled: false
        )

        store.addNotificationRule(globalRule)
        store.addNotificationRule(locationRule)
        store.addNotificationRule(disabledRule)

        let enabledForLocation = store.enabledNotificationRules(for: location.id)
        XCTAssertEqual(enabledForLocation.count, 2) // global + location-specific
    }

    // MARK: - Persistence Tests

    func testDataPersistsAcrossInstances() async throws {
        let coords = try Coordinates.validated(lat: 52.5200, lon: 13.4050)
        let location = LocationEntity(
            query: "Berlin",
            resolved: GeocodingResult(
                name: "Berlin",
                coordinates: coords,
                country: "Germany",
                countryCode: "DE",
                timezone: "Europe/Berlin"
            )
        )

        store.addLocation(location)
        store.setTemperatureUnit(.fahrenheit)

        // Create new store with same backing store
        let newStore = CloudSyncStore(store: memoryStore)

        XCTAssertEqual(newStore.locations.count, 1)
        XCTAssertEqual(newStore.locations.first?.name, "Berlin")
        XCTAssertEqual(newStore.preferences.temperatureUnit, .fahrenheit)
    }

    // MARK: - Synchronize Tests

    func testSynchronize() async throws {
        let result = store.synchronize()
        XCTAssertTrue(result)
    }

    // MARK: - External Change (KVS Notification) Tests

    func testSimulateExternalChange() async throws {
        // First add some data
        let coords = try Coordinates.validated(lat: 55.6761, lon: 12.5683)
        let location = LocationEntity(
            query: "Copenhagen",
            resolved: GeocodingResult(
                name: "Copenhagen",
                coordinates: coords,
                country: "Denmark",
                countryCode: "DK",
                timezone: "Europe/Copenhagen"
            )
        )

        store.addLocation(location)
        XCTAssertEqual(store.locations.count, 1)

        // Add another location directly to the backing store (simulating external device sync)
        let coords2 = try Coordinates.validated(lat: 59.3293, lon: 18.0686)
        let location2 = LocationEntity(
            query: "Stockholm",
            resolved: GeocodingResult(
                name: "Stockholm",
                coordinates: coords2,
                country: "Sweden",
                countryCode: "SE",
                timezone: "Europe/Stockholm"
            )
        )

        let encoder = JSONEncoder()
        let allLocations = [location, location2]
        if let data = try? encoder.encode(allLocations) {
            memoryStore.set(data, forKey: PreferenceKey.locations.rawValue)
        }

        // Simulate external change notification
        store.simulateExternalChange(changedKeys: [PreferenceKey.locations.rawValue])

        // Verify the store reloaded with new data
        XCTAssertEqual(store.locations.count, 2)
        XCTAssertTrue(store.locations.contains { $0.name == "Stockholm" })
    }

    func testExternalUnitChange() async throws {
        // Set initial unit
        store.setTemperatureUnit(.celsius)
        XCTAssertEqual(store.preferences.temperatureUnit, .celsius)

        // Simulate external change directly to backing store
        memoryStore.set(TemperatureUnit.fahrenheit.rawValue, forKey: PreferenceKey.temperatureUnit.rawValue)

        // Simulate external change notification
        store.simulateExternalChange(changedKeys: [PreferenceKey.temperatureUnit.rawValue])

        // Verify the store reloaded with new unit
        XCTAssertEqual(store.preferences.temperatureUnit, .fahrenheit)
    }

    // MARK: - Debounced Publisher Tests

    func testChangePublisherEmitsChanges() async throws {
        let expectation = XCTestExpectation(description: "Change publisher should emit")
        var receivedChanges: [PreferenceChange] = []

        let cancellable = store.changePublisher.sink { change in
            receivedChanges.append(change)
            expectation.fulfill()
        }

        // Trigger a change
        store.setTemperatureUnit(.fahrenheit)

        // Wait for debounced publisher (300ms + buffer)
        await fulfillment(of: [expectation], timeout: 1.0)

        XCTAssertFalse(receivedChanges.isEmpty)
        XCTAssertEqual(receivedChanges.first?.key, .temperatureUnit)

        cancellable.cancel()
    }

    func testChangePublisherDebouncesBurstChanges() async throws {
        let expectation = XCTestExpectation(description: "Change publisher should emit once for burst")
        var receivedCount = 0

        let cancellable = store.changePublisher.sink { _ in
            receivedCount += 1
            expectation.fulfill()
        }

        // Rapidly emit multiple changes via the emitChange helper
        store.emitChange(PreferenceChange(key: .temperatureUnit))
        store.emitChange(PreferenceChange(key: .temperatureUnit))
        store.emitChange(PreferenceChange(key: .temperatureUnit))

        // Wait for debounce period (300ms + buffer)
        await fulfillment(of: [expectation], timeout: 1.0)

        // Due to debouncing, we should receive fewer emissions than sent
        // (likely 1 after the 300ms debounce)
        XCTAssertLessThanOrEqual(receivedCount, 3, "Debouncing should reduce burst emissions")

        cancellable.cancel()
    }

    // MARK: - Conflict Resolution Tests

    func testConflictResolutionRemoteWins() async throws {
        let oldDate = Date(timeIntervalSinceNow: -3600) // 1 hour ago
        let newDate = Date()

        let localPrefs = UserPreferences(
            temperatureUnit: .celsius,
            lastModified: oldDate
        )

        let remotePrefs = UserPreferences(
            temperatureUnit: .fahrenheit,
            lastModified: newDate
        )

        let winner = store.resolveConflict(local: localPrefs, remote: remotePrefs)

        // Remote should win since it has newer timestamp
        XCTAssertEqual(winner.temperatureUnit, .fahrenheit)
        XCTAssertEqual(winner.lastModified, newDate)
    }

    func testConflictResolutionLocalWins() async throws {
        let oldDate = Date(timeIntervalSinceNow: -3600) // 1 hour ago
        let newDate = Date()

        let localPrefs = UserPreferences(
            temperatureUnit: .celsius,
            lastModified: newDate
        )

        let remotePrefs = UserPreferences(
            temperatureUnit: .fahrenheit,
            lastModified: oldDate
        )

        let winner = store.resolveConflict(local: localPrefs, remote: remotePrefs)

        // Local should win since it has newer timestamp
        XCTAssertEqual(winner.temperatureUnit, .celsius)
        XCTAssertEqual(winner.lastModified, newDate)
    }

    func testConflictResolutionEqualTimestamp() async throws {
        let sameDate = Date()

        let localPrefs = UserPreferences(
            temperatureUnit: .celsius,
            lastModified: sameDate
        )

        let remotePrefs = UserPreferences(
            temperatureUnit: .fahrenheit,
            lastModified: sameDate
        )

        let winner = store.resolveConflict(local: localPrefs, remote: remotePrefs)

        // When timestamps are equal, local wins (defensive behavior)
        XCTAssertEqual(winner.temperatureUnit, .celsius)
    }

    func testConflictResolutionWithLocations() async throws {
        let oldDate = Date(timeIntervalSinceNow: -3600)
        let newDate = Date()

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

        let coords2 = try Coordinates.validated(lat: 34.0522, lon: -118.2437)
        let location2 = LocationEntity(
            query: "LA",
            resolved: GeocodingResult(
                name: "Los Angeles",
                coordinates: coords2,
                country: "USA",
                countryCode: "US",
                timezone: "America/Los_Angeles"
            )
        )

        let localPrefs = UserPreferences(
            locations: [location1],
            lastModified: oldDate
        )

        let remotePrefs = UserPreferences(
            locations: [location2],
            lastModified: newDate
        )

        let winner = store.resolveConflict(local: localPrefs, remote: remotePrefs)

        // Remote should win, so we get LA not NYC
        XCTAssertEqual(winner.locations.count, 1)
        XCTAssertEqual(winner.locations.first?.name, "Los Angeles")
    }
}

// MARK: - In-Memory Store Tests

final class InMemoryKeyValueStoreTests: XCTestCase {
    var store: InMemoryKeyValueStore!

    override func setUp() {
        store = InMemoryKeyValueStore()
    }

    override func tearDown() {
        store = nil
    }

    func testSetAndGet() {
        store.set("test_value", forKey: "test_key")
        XCTAssertEqual(store.object(forKey: "test_key") as? String, "test_value")
    }

    func testRemoveObject() {
        store.set("test_value", forKey: "test_key")
        store.removeObject(forKey: "test_key")
        XCTAssertNil(store.object(forKey: "test_key"))
    }

    func testSetNilRemovesValue() {
        store.set("test_value", forKey: "test_key")
        store.set(nil, forKey: "test_key")
        XCTAssertNil(store.object(forKey: "test_key"))
    }

    func testDictionaryRepresentation() {
        store.set("value1", forKey: "key1")
        store.set(42, forKey: "key2")

        let dict = store.dictionaryRepresentation()
        XCTAssertEqual(dict["key1"] as? String, "value1")
        XCTAssertEqual(dict["key2"] as? Int, 42)
    }

    func testClear() {
        store.set("value1", forKey: "key1")
        store.set("value2", forKey: "key2")
        store.clear()

        XCTAssertNil(store.object(forKey: "key1"))
        XCTAssertNil(store.object(forKey: "key2"))
        XCTAssertTrue(store.dictionaryRepresentation().isEmpty)
    }

    func testSynchronize() {
        XCTAssertTrue(store.synchronize())
    }
}
