import XCTest
import UserNotifications
@testable import WeatherOracle
import SharedKit

// MARK: - Mock Notification Center

final class MockNotificationCenter: UNUserNotificationCenter {
    var authorizationRequested = false
    var authorizationOptions: UNAuthorizationOptions?
    var authorizationResult = true

    var categoriesRegistered: Set<UNNotificationCategory> = []
    var pendingRequests: [UNNotificationRequest] = []
    var removedIdentifiers: [String] = []

    override func requestAuthorization(
        options: UNAuthorizationOptions = []
    ) async throws -> Bool {
        authorizationRequested = true
        authorizationOptions = options
        return authorizationResult
    }

    override func setNotificationCategories(_ categories: Set<UNNotificationCategory>) {
        categoriesRegistered = categories
    }

    override func add(_ request: UNNotificationRequest) async throws {
        pendingRequests.append(request)
    }

    override func getPendingNotificationRequests(
        completionHandler: @escaping ([UNNotificationRequest]) -> Void
    ) {
        completionHandler(pendingRequests)
    }

    override func removePendingNotificationRequests(withIdentifiers identifiers: [String]) {
        removedIdentifiers.append(contentsOf: identifiers)
        pendingRequests.removeAll { identifiers.contains($0.identifier) }
    }

    override func removeAllPendingNotificationRequests() {
        pendingRequests.removeAll()
    }
}

// MARK: - Notification Engine Tests

@MainActor
final class NotificationEngineTests: XCTestCase {
    var mockCenter: MockNotificationCenter!
    var store: CloudSyncStore!
    var engine: NotificationEngine!

    override func setUp() async throws {
        mockCenter = MockNotificationCenter()
        store = CloudSyncStore(store: InMemoryKeyValueStore())
        engine = NotificationEngine(center: mockCenter, store: store)
    }

    override func tearDown() {
        mockCenter = nil
        store = nil
        engine = nil
    }

    // MARK: - Setup Tests

    func testRegisterCategories() {
        engine.registerCategories()

        XCTAssertEqual(mockCenter.categoriesRegistered.count, 3)

        let categoryIds = mockCenter.categoriesRegistered.map { $0.identifier }
        XCTAssertTrue(categoryIds.contains(NotificationCategory.severeWeather.identifier))
        XCTAssertTrue(categoryIds.contains(NotificationCategory.modelDivergence.identifier))
        XCTAssertTrue(categoryIds.contains(NotificationCategory.dailySummary.identifier))
    }

    func testRequestAuthorization() async throws {
        let granted = try await engine.requestAuthorization()

        XCTAssertTrue(mockCenter.authorizationRequested)
        XCTAssertTrue(granted)
        XCTAssertEqual(mockCenter.authorizationOptions, [.alert, .sound, .badge])
    }

    // MARK: - Rule Evaluation Tests

    func testEvaluateTemperatureAboveRule() {
        let location = createTestLocation()
        let forecast = createTestForecast(temperature: 38.0)

        let rule = NotificationRule(
            condition: .temperatureAbove,
            threshold: 35.0,
            locationId: location.id
        )
        store.addNotificationRule(rule)

        let results = engine.evaluateRules(location: location, forecast: forecast)

        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].matchedValue, 38.0, accuracy: 0.1)
        XCTAssertTrue(results[0].description.contains("38°C"))
    }

    func testEvaluateTemperatureBelowRule() {
        let location = createTestLocation()
        let forecast = createTestForecast(temperature: -15.0)

        let rule = NotificationRule(
            condition: .temperatureBelow,
            threshold: -10.0,
            locationId: location.id
        )
        store.addNotificationRule(rule)

        let results = engine.evaluateRules(location: location, forecast: forecast)

        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].matchedValue, -15.0, accuracy: 0.1)
    }

    func testEvaluatePrecipitationRule() {
        let location = createTestLocation()
        let forecast = createTestForecast(precipitationProbability: 0.85)

        let rule = NotificationRule(
            condition: .precipitationProbabilityAbove,
            threshold: 70.0,
            locationId: location.id
        )
        store.addNotificationRule(rule)

        let results = engine.evaluateRules(location: location, forecast: forecast)

        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].matchedValue, 85.0, accuracy: 0.1)
    }

    func testEvaluateWindSpeedRule() {
        let location = createTestLocation()
        let forecast = createTestForecast(windSpeed: 18.0) // 18 m/s = 64.8 km/h

        let rule = NotificationRule(
            condition: .windSpeedAbove,
            threshold: 15.0,
            locationId: location.id
        )
        store.addNotificationRule(rule)

        let results = engine.evaluateRules(location: location, forecast: forecast)

        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].matchedValue, 18.0, accuracy: 0.1)
    }

    func testEvaluateUVIndexRule() {
        let location = createTestLocation()
        let forecast = createTestForecast(uvIndex: 10)

        let rule = NotificationRule(
            condition: .uvIndexAbove,
            threshold: 8.0,
            locationId: location.id
        )
        store.addNotificationRule(rule)

        let results = engine.evaluateRules(location: location, forecast: forecast)

        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].matchedValue, 10.0, accuracy: 0.1)
    }

    func testEvaluateMultipleRules() {
        let location = createTestLocation()
        let forecast = createTestForecast(temperature: 38.0, windSpeed: 18.0)

        let tempRule = NotificationRule(
            condition: .temperatureAbove,
            threshold: 35.0,
            locationId: location.id
        )
        let windRule = NotificationRule(
            condition: .windSpeedAbove,
            threshold: 15.0,
            locationId: location.id
        )

        store.addNotificationRule(tempRule)
        store.addNotificationRule(windRule)

        let results = engine.evaluateRules(location: location, forecast: forecast)

        XCTAssertEqual(results.count, 2)
    }

    func testNoRulesTriggered() {
        let location = createTestLocation()
        let forecast = createTestForecast(temperature: 20.0)

        let rule = NotificationRule(
            condition: .temperatureAbove,
            threshold: 35.0,
            locationId: location.id
        )
        store.addNotificationRule(rule)

        let results = engine.evaluateRules(location: location, forecast: forecast)

        XCTAssertEqual(results.count, 0)
    }

    // MARK: - Model Divergence Tests

    func testDetectModelDivergence() {
        let forecast = createTestForecastWithDivergence(spread: 6.0)

        let alert = engine.detectModelDivergence(forecast: forecast)

        XCTAssertNotNil(alert)
        XCTAssertEqual(alert?.metric, "temperature")
        XCTAssertEqual(alert?.spread, 6.0, accuracy: 0.1)
    }

    func testNoDivergenceDetected() {
        let forecast = createTestForecast(temperature: 20.0)

        let alert = engine.detectModelDivergence(forecast: forecast)

        XCTAssertNil(alert)
    }

    // MARK: - Notification Scheduling Tests

    func testScheduleNotification() async throws {
        let location = createTestLocation()
        let forecast = createTestForecast(temperature: 38.0)

        let trigger = AlertTrigger(
            locationId: location.id,
            condition: .temperatureAbove,
            threshold: 35.0
        )

        let result = AlertResult(
            trigger: trigger,
            location: location,
            forecast: forecast,
            matchedValue: 38.0,
            description: "Temperature exceeds 35°C at 38°C"
        )

        try await engine.scheduleNotification(for: result)

        XCTAssertEqual(mockCenter.pendingRequests.count, 1)

        let request = mockCenter.pendingRequests[0]
        XCTAssertTrue(request.identifier.hasPrefix("alert_"))
        XCTAssertEqual(request.content.title, location.name)
        XCTAssertEqual(request.content.body, result.description)
        XCTAssertEqual(
            request.content.categoryIdentifier,
            NotificationCategory.severeWeather.identifier
        )

        let userInfo = request.content.userInfo as? [String: String]
        XCTAssertEqual(userInfo?["locationId"], location.id.uuidString)
        XCTAssertEqual(userInfo?["action"], "viewForecast")
    }

    func testScheduleModelDivergenceNotification() async throws {
        let location = createTestLocation()
        let forecast = createTestForecastWithDivergence(spread: 6.0)

        let alert = ModelDivergenceAlert(
            location: location,
            forecast: forecast,
            metric: "temperature",
            spread: 6.0,
            timestamp: Date()
        )

        try await engine.scheduleModelDivergenceNotification(for: alert)

        XCTAssertEqual(mockCenter.pendingRequests.count, 1)

        let request = mockCenter.pendingRequests[0]
        XCTAssertTrue(request.identifier.hasPrefix("divergence_"))
        XCTAssertEqual(request.content.title, "Model Disagreement")
        XCTAssertTrue(request.content.body.contains("±6°C"))
        XCTAssertEqual(
            request.content.categoryIdentifier,
            NotificationCategory.modelDivergence.identifier
        )
    }

    func testScheduleDailySummary() async throws {
        let location = createTestLocation()
        let forecast = createTestForecast(temperature: 20.0)

        try await engine.scheduleDailySummary(location: location, forecast: forecast)

        XCTAssertEqual(mockCenter.pendingRequests.count, 1)

        let request = mockCenter.pendingRequests[0]
        XCTAssertTrue(request.identifier.hasPrefix("daily_"))
        XCTAssertEqual(request.content.title, "Daily Forecast: \(location.name)")
        XCTAssertEqual(
            request.content.categoryIdentifier,
            NotificationCategory.dailySummary.identifier
        )

        // Verify calendar trigger
        if let trigger = request.trigger as? UNCalendarNotificationTrigger {
            XCTAssertEqual(trigger.dateComponents.hour, 7)
            XCTAssertEqual(trigger.dateComponents.minute, 0)
            XCTAssertTrue(trigger.repeats)
        } else {
            XCTFail("Expected calendar trigger")
        }
    }

    func testCancelNotificationsForLocation() {
        let location = createTestLocation()

        // Add some notifications
        let content = UNMutableNotificationContent()
        content.userInfo = ["locationId": location.id.uuidString]

        let request1 = UNNotificationRequest(
            identifier: "test1",
            content: content,
            trigger: nil
        )
        let request2 = UNNotificationRequest(
            identifier: "test2",
            content: content,
            trigger: nil
        )

        mockCenter.pendingRequests = [request1, request2]

        engine.cancelNotifications(for: location.id)

        // Wait for async completion
        let expectation = XCTestExpectation(description: "Cancel completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)

        XCTAssertTrue(mockCenter.removedIdentifiers.contains("test1"))
        XCTAssertTrue(mockCenter.removedIdentifiers.contains("test2"))
    }

    func testCancelAllNotifications() {
        mockCenter.pendingRequests = [
            UNNotificationRequest(
                identifier: "test1",
                content: UNMutableNotificationContent(),
                trigger: nil
            )
        ]

        engine.cancelAllNotifications()

        XCTAssertEqual(mockCenter.pendingRequests.count, 0)
    }

    // MARK: - Preview Notification Tests

    func testSchedulePreviewNotification() async throws {
        try await engine.schedulePreviewNotification(
            title: "Test Title",
            body: "Test Body",
            category: .severeWeather,
            delay: 5
        )

        XCTAssertEqual(mockCenter.pendingRequests.count, 1)

        let request = mockCenter.pendingRequests[0]
        XCTAssertTrue(request.identifier.hasPrefix("preview_"))
        XCTAssertEqual(request.content.title, "Test Title")
        XCTAssertEqual(request.content.body, "Test Body")
    }

    // MARK: - Deep Link Tests

    func testParseViewForecastDeepLink() {
        let locationId = UUID()
        let userInfo: [AnyHashable: Any] = [
            "action": "viewForecast",
            "locationId": locationId.uuidString
        ]

        let deepLink = DeepLink.parse(userInfo: userInfo)

        if case let .viewForecast(id) = deepLink {
            XCTAssertEqual(id, locationId)
        } else {
            XCTFail("Expected viewForecast deep link")
        }
    }

    func testParseCompareModelsDeepLink() {
        let locationId = UUID()
        let userInfo: [AnyHashable: Any] = [
            "action": "compareModels",
            "locationId": locationId.uuidString
        ]

        let deepLink = DeepLink.parse(userInfo: userInfo)

        if case let .compareModels(id) = deepLink {
            XCTAssertEqual(id, locationId)
        } else {
            XCTFail("Expected compareModels deep link")
        }
    }

    func testParseInvalidDeepLink() {
        let userInfo: [AnyHashable: Any] = [
            "action": "invalid",
            "locationId": UUID().uuidString
        ]

        let deepLink = DeepLink.parse(userInfo: userInfo)

        XCTAssertNil(deepLink)
    }

    // MARK: - Helper Methods

    private func createTestLocation() -> LocationEntity {
        LocationEntity(
            query: "Test City",
            resolved: GeocodingResult(
                name: "Test City",
                coordinates: Coordinates(
                    latitude: Latitude(rawValue: 51.5074)!,
                    longitude: Longitude(rawValue: -0.1278)!
                ),
                country: "UK",
                countryCode: "GB",
                region: "England",
                timezone: TimezoneId(rawValue: "Europe/London"),
                elevation: Elevation(rawValue: 11),
                population: 9000000
            )
        )
    }

    private func createTestForecast(
        temperature: Double = 20.0,
        precipitationProbability: Double = 0.0,
        windSpeed: Double = 5.0,
        uvIndex: Int = 3
    ) -> AggregatedForecast {
        let metrics = WeatherMetrics(
            temperature: Celsius(rawValue: temperature),
            feelsLike: Celsius(rawValue: temperature),
            humidity: Humidity.clamped(50),
            pressure: Pressure.clamped(1013),
            windSpeed: MetersPerSecond.clamped(windSpeed),
            windDirection: WindDirection(rawValue: 180),
            windGust: nil,
            precipitation: Millimeters.clamped(0),
            precipitationProbability: precipitationProbability,
            cloudCover: CloudCover.clamped(20),
            visibility: Visibility.clamped(10000),
            uvIndex: UVIndex.clamped(uvIndex),
            weatherCode: .clearSky
        )

        let hourly = AggregatedHourlyForecast(
            timestamp: Date(),
            metrics: metrics,
            confidence: ConfidenceLevel.from(score: 0.8)!,
            modelAgreement: ModelConsensus(
                agreementScore: 0.9,
                modelsInAgreement: [.ecmwf, .gfs, .icon],
                outlierModels: [],
                temperatureStats: MetricStatistics(
                    mean: temperature,
                    median: temperature,
                    min: temperature - 1,
                    max: temperature + 1,
                    stdDev: 0.5,
                    range: 2
                ),
                precipitationStats: MetricStatistics.empty,
                windStats: MetricStatistics.empty
            ),
            range: HourlyRange(
                temperature: MetricRange(min: temperature - 1, max: temperature + 1),
                precipitation: MetricRange(min: 0, max: 0),
                windSpeed: MetricRange(min: windSpeed - 1, max: windSpeed + 1)
            )
        )

        let daily = AggregatedDailyForecast(
            date: Date(),
            forecast: DailyForecast(
                date: Date(),
                temperature: TemperatureRange(
                    min: Celsius(rawValue: temperature - 5),
                    max: Celsius(rawValue: temperature + 5)
                ),
                humidityRange: HumidityRange(
                    min: Humidity.clamped(40),
                    max: Humidity.clamped(60)
                ),
                pressureRange: PressureRange(
                    min: Pressure.clamped(1010),
                    max: Pressure.clamped(1016)
                ),
                precipitation: PrecipitationSummary(
                    total: Millimeters.clamped(0),
                    probability: precipitationProbability,
                    hours: 0
                ),
                wind: WindSummary(
                    avgSpeed: MetersPerSecond.clamped(windSpeed),
                    maxSpeed: MetersPerSecond.clamped(windSpeed + 2),
                    dominantDirection: WindDirection(rawValue: 180)
                ),
                cloudCoverSummary: CloudCoverSummary(
                    avg: CloudCover.clamped(20),
                    max: CloudCover.clamped(40)
                ),
                uvIndexMax: UVIndex.clamped(uvIndex),
                sun: SunTimes(
                    sunrise: Date(),
                    sunset: Date().addingTimeInterval(12 * 3600),
                    daylightHours: 12
                ),
                weatherCode: .clearSky,
                hourly: []
            ),
            confidence: ConfidenceLevel.from(score: 0.8)!,
            modelAgreement: ModelConsensus(
                agreementScore: 0.9,
                modelsInAgreement: [.ecmwf, .gfs, .icon],
                outlierModels: [],
                temperatureStats: MetricStatistics.empty,
                precipitationStats: MetricStatistics.empty,
                windStats: MetricStatistics.empty
            ),
            range: DailyRange(
                temperatureMax: MetricRange(min: temperature + 4, max: temperature + 6),
                temperatureMin: MetricRange(min: temperature - 6, max: temperature - 4),
                precipitation: MetricRange(min: 0, max: 0)
            )
        )

        return AggregatedForecast(
            coordinates: Coordinates(
                latitude: Latitude(rawValue: 51.5074)!,
                longitude: Longitude(rawValue: -0.1278)!
            ),
            generatedAt: Date(),
            validFrom: Date(),
            validTo: Date().addingTimeInterval(7 * 24 * 3600),
            models: [.ecmwf, .gfs, .icon],
            modelForecasts: [],
            consensus: ForecastConsensus(hourly: [hourly], daily: [daily]),
            modelWeights: [],
            overallConfidence: ConfidenceLevel.from(score: 0.8)!
        )
    }

    private func createTestForecastWithDivergence(spread: Double) -> AggregatedForecast {
        let temperature = 20.0

        let consensus = ModelConsensus(
            agreementScore: 0.5,
            modelsInAgreement: [.ecmwf],
            outlierModels: [.gfs, .icon],
            temperatureStats: MetricStatistics(
                mean: temperature,
                median: temperature,
                min: temperature - spread,
                max: temperature + spread,
                stdDev: spread,
                range: spread * 2
            ),
            precipitationStats: MetricStatistics.empty,
            windStats: MetricStatistics.empty
        )

        let hourly = AggregatedHourlyForecast(
            timestamp: Date(),
            metrics: WeatherMetrics(
                temperature: Celsius(rawValue: temperature),
                feelsLike: Celsius(rawValue: temperature),
                humidity: Humidity.clamped(50),
                pressure: Pressure.clamped(1013),
                windSpeed: MetersPerSecond.clamped(5),
                windDirection: WindDirection(rawValue: 180),
                windGust: nil,
                precipitation: Millimeters.clamped(0),
                precipitationProbability: 0,
                cloudCover: CloudCover.clamped(20),
                visibility: Visibility.clamped(10000),
                uvIndex: UVIndex.clamped(3),
                weatherCode: .clearSky
            ),
            confidence: ConfidenceLevel.from(score: 0.5)!,
            modelAgreement: consensus,
            range: HourlyRange(
                temperature: MetricRange(
                    min: temperature - spread,
                    max: temperature + spread
                ),
                precipitation: MetricRange(min: 0, max: 0),
                windSpeed: MetricRange(min: 4, max: 6)
            )
        )

        return AggregatedForecast(
            coordinates: Coordinates(
                latitude: Latitude(rawValue: 51.5074)!,
                longitude: Longitude(rawValue: -0.1278)!
            ),
            generatedAt: Date(),
            validFrom: Date(),
            validTo: Date().addingTimeInterval(7 * 24 * 3600),
            models: [.ecmwf, .gfs, .icon],
            modelForecasts: [],
            consensus: ForecastConsensus(hourly: [hourly], daily: []),
            modelWeights: [],
            overallConfidence: ConfidenceLevel.from(score: 0.5)!
        )
    }
}
