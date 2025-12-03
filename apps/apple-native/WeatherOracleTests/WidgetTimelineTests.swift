import XCTest
import WidgetKit
@testable import WeatherOracleWidgets
@testable import SharedKit

// MARK: - Widget Timeline Tests

@MainActor
final class WidgetTimelineTests: XCTestCase {

    // MARK: - TimelineProvider Tests

    func testPlaceholderEntry() {
        let provider = WeatherWidgetTimelineProvider()
        let context = MockTimelineProviderContext()

        let entry = provider.placeholder(in: context)

        XCTAssertNotNil(entry.date)
        XCTAssertNil(entry.forecast)
        XCTAssertNil(entry.location)
        XCTAssertNil(entry.lastUpdate)
    }

    func testSnapshotInPreviewContext() async {
        let provider = WeatherWidgetTimelineProvider()
        let context = MockTimelineProviderContext(isPreview: true)

        let expectation = XCTestExpectation(description: "Snapshot completion")
        var receivedEntry: WeatherWidgetEntry?

        provider.getSnapshot(in: context) { entry in
            receivedEntry = entry
            expectation.fulfill()
        }

        await fulfillment(of: [expectation], timeout: 1.0)

        XCTAssertNotNil(receivedEntry)
        XCTAssertNil(receivedEntry?.forecast, "Preview context should return placeholder")
    }

    func testTimelinePolicyIsAfterNextHour() async {
        let provider = WeatherWidgetTimelineProvider()
        let context = MockTimelineProviderContext()

        let expectation = XCTestExpectation(description: "Timeline completion")
        var receivedTimeline: Timeline<WeatherWidgetEntry>?

        provider.getTimeline(in: context) { timeline in
            receivedTimeline = timeline
            expectation.fulfill()
        }

        await fulfillment(of: [expectation], timeout: 2.0)

        XCTAssertNotNil(receivedTimeline)
        XCTAssertEqual(receivedTimeline?.entries.count, 1)

        // Verify refresh policy is set to update in ~1 hour
        if case .after(let nextUpdate) = receivedTimeline?.policy {
            let hourFromNow = Date().addingTimeInterval(3600)
            let tolerance: TimeInterval = 60 // 1 minute tolerance

            XCTAssertEqual(
                nextUpdate.timeIntervalSince1970,
                hourFromNow.timeIntervalSince1970,
                accuracy: tolerance,
                "Timeline should refresh approximately 1 hour from now"
            )
        } else {
            XCTFail("Timeline policy should be .after()")
        }
    }

    // MARK: - WidgetDataProvider Tests

    func testSaveAndLoadForecast() throws {
        let dataProvider = WidgetDataProvider()

        // Create test data
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

        let forecast = createMockForecast(coordinates: coords)

        // Save forecast
        dataProvider.saveForecast(forecast, for: location)

        // Wait briefly for async save
        Thread.sleep(forTimeInterval: 0.1)

        // Load forecast
        let loadedForecast = dataProvider.loadCachedForecast()
        let loadedLocation = dataProvider.loadSelectedLocation()

        XCTAssertNotNil(loadedForecast)
        XCTAssertNotNil(loadedLocation)
        XCTAssertEqual(loadedLocation?.name, "New York")
    }

    func testLoadLastUpdateTime() {
        let dataProvider = WidgetDataProvider()

        let coords = Coordinates(
            latitude: Latitude(rawValue: 40.7128)!,
            longitude: Longitude(rawValue: -74.0060)!
        )
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
        let forecast = createMockForecast(coordinates: coords)

        // Save forecast
        dataProvider.saveForecast(forecast, for: location)

        Thread.sleep(forTimeInterval: 0.1)

        // Load last update time
        let lastUpdate = dataProvider.loadLastUpdateTime()

        XCTAssertNotNil(lastUpdate)
        XCTAssertLessThan(Date().timeIntervalSince(lastUpdate!), 2.0)
    }

    func testIsCacheFresh() {
        let dataProvider = WidgetDataProvider()

        // Before saving anything, cache should not be fresh
        XCTAssertFalse(dataProvider.isCacheFresh())

        // Save forecast
        let coords = Coordinates(
            latitude: Latitude(rawValue: 40.7128)!,
            longitude: Longitude(rawValue: -74.0060)!
        )
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
        let forecast = createMockForecast(coordinates: coords)

        dataProvider.saveForecast(forecast, for: location)
        Thread.sleep(forTimeInterval: 0.1)

        // Now cache should be fresh
        XCTAssertTrue(dataProvider.isCacheFresh())
    }

    func testClearCache() {
        let dataProvider = WidgetDataProvider()

        // Save forecast
        let coords = Coordinates(
            latitude: Latitude(rawValue: 40.7128)!,
            longitude: Longitude(rawValue: -74.0060)!
        )
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
        let forecast = createMockForecast(coordinates: coords)

        dataProvider.saveForecast(forecast, for: location)
        Thread.sleep(forTimeInterval: 0.1)

        XCTAssertNotNil(dataProvider.loadCachedForecast())

        // Clear cache
        dataProvider.clearCache()
        Thread.sleep(forTimeInterval: 0.1)

        // Verify cache is cleared
        XCTAssertNil(dataProvider.loadCachedForecast())
        XCTAssertNil(dataProvider.loadSelectedLocation())
        XCTAssertNil(dataProvider.loadLastUpdateTime())
    }

    func testLoadConfiguration() {
        let dataProvider = WidgetDataProvider()
        let config = dataProvider.loadConfiguration()

        XCTAssertTrue(config.showModelAgreement)
        XCTAssertTrue(config.showConfidenceBadge)
        XCTAssertEqual(config.temperatureUnit, .celsius)
        XCTAssertEqual(config.hourlyHoursToShow, 6)
    }

    // MARK: - Widget Entry Extension Tests

    func testEntryComputedProperties() {
        let coords = Coordinates(
            latitude: Latitude(rawValue: 40.7128)!,
            longitude: Longitude(rawValue: -74.0060)!
        )
        let forecast = createMockForecast(coordinates: coords)
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

        let entry = WeatherWidgetEntry(
            date: Date(),
            forecast: forecast,
            location: location,
            lastUpdate: Date()
        )

        // Test computed properties
        XCTAssertNotNil(entry.currentTemperature)
        XCTAssertNotNil(entry.currentWeatherCode)
        XCTAssertNotNil(entry.todayHigh)
        XCTAssertNotNil(entry.todayLow)
        XCTAssertNotNil(entry.currentConfidence)

        // Test forecast arrays
        XCTAssertEqual(entry.nextHourlyForecasts(count: 6).count, 6)
        XCTAssertEqual(entry.nextDailyForecasts(count: 5).count, 5)
    }

    func testEntryWithNoForecast() {
        let entry = WeatherWidgetEntry.placeholder

        XCTAssertNil(entry.currentTemperature)
        XCTAssertNil(entry.currentWeatherCode)
        XCTAssertNil(entry.todayHigh)
        XCTAssertNil(entry.todayLow)
        XCTAssertNil(entry.currentConfidence)
        XCTAssertTrue(entry.nextHourlyForecasts().isEmpty)
        XCTAssertTrue(entry.nextDailyForecasts().isEmpty)
    }

    // MARK: - Widget Configuration Tests

    func testWidgetConfigurationDefaults() {
        let config = WidgetPreferences.default

        XCTAssertTrue(config.showModelAgreement)
        XCTAssertTrue(config.showConfidenceBadge)
        XCTAssertEqual(config.temperatureUnit, .celsius)
        XCTAssertEqual(config.hourlyHoursToShow, 6)
    }

    func testWidgetConfigurationCodable() throws {
        let config = WidgetPreferences(
            showModelAgreement: false,
            showConfidenceBadge: false,
            temperatureUnit: .fahrenheit,
            hourlyHoursToShow: 12
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(config)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(WidgetPreferences.self, from: data)

        XCTAssertFalse(decoded.showModelAgreement)
        XCTAssertFalse(decoded.showConfidenceBadge)
        XCTAssertEqual(decoded.temperatureUnit, .fahrenheit)
        XCTAssertEqual(decoded.hourlyHoursToShow, 12)
    }

    // MARK: - App Group Config Tests

    func testAppGroupIdentifier() {
        XCTAssertEqual(AppGroupConfig.identifier, "group.com.weatheroracle.app")
    }

    func testSharedDefaults() {
        // Shared defaults should be accessible
        XCTAssertNotNil(AppGroupConfig.sharedDefaults)
    }

    // MARK: - Helper Methods

    private func createMockForecast(coordinates: Coordinates) -> AggregatedForecast {
        let now = Date()

        // Create hourly forecasts
        let hourlyForecasts = (0..<24).map { hour -> AggregatedHourlyForecast in
            let timestamp = now.addingTimeInterval(Double(hour) * 3600)
            let temp = 20.0 + sin(Double(hour) / 24.0 * 2 * .pi) * 8

            let metrics = WeatherMetrics(
                temperature: Celsius(rawValue: temp),
                feelsLike: Celsius(rawValue: temp - 2),
                humidity: Humidity(rawValue: 65)!,
                pressure: Pressure(rawValue: 1013)!,
                windSpeed: MetersPerSecond(rawValue: 5)!,
                windDirection: WindDirection(rawValue: 180),
                precipitation: Millimeters.clamped(Double(hour % 6)),
                precipitationProbability: 0.3,
                cloudCover: CloudCover(rawValue: 40)!,
                visibility: Visibility(rawValue: 10000)!,
                uvIndex: UVIndex(rawValue: 5)!,
                weatherCode: .clearSky
            )

            let consensus = ModelConsensus(
                agreementScore: 0.85,
                modelsInAgreement: [.ecmwf, .gfs, .icon],
                outlierModels: [],
                temperatureStats: MetricStatistics(mean: temp, median: temp, min: temp - 2, max: temp + 2, stdDev: 1.0, range: 4.0),
                precipitationStats: MetricStatistics(mean: 0.5, median: 0.5, min: 0, max: 1, stdDev: 0.3, range: 1.0),
                windStats: MetricStatistics(mean: 5, median: 5, min: 4, max: 6, stdDev: 0.5, range: 2.0)
            )

            let range = HourlyRange(
                temperature: MetricRange(min: temp - 2, max: temp + 2),
                precipitation: MetricRange(min: 0, max: 2),
                windSpeed: MetricRange(min: 4, max: 6)
            )

            let confidence = ConfidenceLevel(level: .high, score: 0.85)

            return AggregatedHourlyForecast(
                timestamp: timestamp,
                metrics: metrics,
                confidence: confidence,
                modelAgreement: consensus,
                range: range
            )
        }

        // Create daily forecasts
        let dailyForecasts = (0..<7).map { day -> AggregatedDailyForecast in
            let date = Calendar.current.date(byAdding: .day, value: day, to: now)!

            let forecast = DailyForecast(
                date: date,
                temperature: TemperatureRange(
                    min: Celsius(rawValue: 12),
                    max: Celsius(rawValue: 24)
                ),
                humidityRange: HumidityRange(
                    min: Humidity(rawValue: 50)!,
                    max: Humidity(rawValue: 80)!
                ),
                pressureRange: PressureRange(
                    min: Pressure(rawValue: 1010)!,
                    max: Pressure(rawValue: 1016)!
                ),
                precipitation: PrecipitationSummary(
                    total: Millimeters.clamped(5),
                    probability: 0.6,
                    hours: 2
                ),
                wind: WindSummary(
                    avgSpeed: MetersPerSecond(rawValue: 4)!,
                    maxSpeed: MetersPerSecond(rawValue: 8)!,
                    dominantDirection: WindDirection(rawValue: 180)
                ),
                cloudCoverSummary: CloudCoverSummary(
                    avg: CloudCover(rawValue: 40)!,
                    max: CloudCover(rawValue: 70)!
                ),
                uvIndexMax: UVIndex(rawValue: 7)!,
                sun: SunTimes(
                    sunrise: date.addingTimeInterval(-6 * 3600),
                    sunset: date.addingTimeInterval(6 * 3600),
                    daylightHours: 12
                ),
                weatherCode: .clearSky,
                hourly: []
            )

            let consensus = ModelConsensus(
                agreementScore: 0.8,
                modelsInAgreement: [.ecmwf, .gfs, .icon],
                outlierModels: [],
                temperatureStats: MetricStatistics(mean: 18, median: 18, min: 12, max: 24, stdDev: 2.0, range: 12.0),
                precipitationStats: MetricStatistics(mean: 5, median: 5, min: 0, max: 10, stdDev: 2.0, range: 10.0),
                windStats: MetricStatistics(mean: 5, median: 5, min: 4, max: 6, stdDev: 0.5, range: 2.0)
            )

            let range = DailyRange(
                temperatureMax: MetricRange(min: 22, max: 26),
                temperatureMin: MetricRange(min: 10, max: 14),
                precipitation: MetricRange(min: 0, max: 10)
            )

            let confidence = ConfidenceLevel(level: .high, score: 0.8)

            return AggregatedDailyForecast(
                date: date,
                forecast: forecast,
                confidence: confidence,
                modelAgreement: consensus,
                range: range
            )
        }

        let consensusForecast = ForecastConsensus(hourly: hourlyForecasts, daily: dailyForecasts)

        return AggregatedForecast(
            coordinates: coordinates,
            generatedAt: now,
            validFrom: now,
            validTo: now.addingTimeInterval(7 * 24 * 3600),
            models: [.ecmwf, .gfs, .icon],
            modelForecasts: [],
            consensus: consensusForecast,
            modelWeights: [],
            overallConfidence: ConfidenceLevel(level: .high, score: 0.85)
        )
    }
}

// MARK: - Mock Timeline Provider Context

struct MockTimelineProviderContext: TimelineProviderContext {
    var family: WidgetFamily = .systemSmall
    var isPreview: Bool = false
    var displaySize: CGSize = CGSize(width: 200, height: 200)

    #if os(watchOS)
    var previewState: TimelineProviderPreviewState = .notPreviewing
    #endif
}
