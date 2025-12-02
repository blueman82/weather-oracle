@testable import SharedKit
import XCTest

// MARK: - Statistics Tests

final class StatisticsTests: XCTestCase {
    // MARK: - Mean Tests

    func testMeanBasic() {
        let values = [1.0, 2.0, 3.0, 4.0, 5.0]
        XCTAssertEqual(mean(values), 3.0, accuracy: 0.001)
    }

    func testMeanEmpty() {
        let values: [Double] = []
        XCTAssertEqual(mean(values), 0.0)
    }

    func testMeanSingle() {
        let values = [42.0]
        XCTAssertEqual(mean(values), 42.0)
    }

    // MARK: - Median Tests

    func testMedianOdd() {
        let values = [1.0, 3.0, 5.0, 7.0, 9.0]
        XCTAssertEqual(median(values), 5.0)
    }

    func testMedianEven() {
        let values = [1.0, 2.0, 3.0, 4.0]
        XCTAssertEqual(median(values), 2.5)
    }

    func testMedianEmpty() {
        let values: [Double] = []
        XCTAssertEqual(median(values), 0.0)
    }

    func testMedianUnsorted() {
        let values = [5.0, 1.0, 3.0]
        XCTAssertEqual(median(values), 3.0)
    }

    // MARK: - Standard Deviation Tests

    func testStdDevBasic() {
        let values = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]
        XCTAssertEqual(stdDev(values), 2.0, accuracy: 0.001)
    }

    func testStdDevEmpty() {
        let values: [Double] = []
        XCTAssertEqual(stdDev(values), 0.0)
    }

    func testStdDevSingle() {
        let values = [5.0]
        XCTAssertEqual(stdDev(values), 0.0)
    }

    func testStdDevIdentical() {
        let values = [5.0, 5.0, 5.0, 5.0]
        XCTAssertEqual(stdDev(values), 0.0)
    }

    // MARK: - Trimmed Mean Tests

    func testTrimmedMeanBasic() {
        // [1, 2, 3, 4, 5, 6, 7, 8, 9, 100] -> trim 10% each end
        // Should remove 1 and 100, mean of [2,3,4,5,6,7,8,9] = 5.5
        let values = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 100.0]
        let result = trimmedMean(values)
        XCTAssertEqual(result, 5.5, accuracy: 0.5)
    }

    func testTrimmedMeanSmall() {
        let values = [5.0, 10.0]
        XCTAssertEqual(trimmedMean(values), 7.5)
    }

    func testTrimmedMeanThree() {
        // For 3 values, should return median
        let values = [1.0, 5.0, 100.0]
        XCTAssertEqual(trimmedMean(values), 5.0)
    }

    func testTrimmedMeanFour() {
        // For 4 values, trim 1 from each end
        let values = [1.0, 5.0, 6.0, 100.0]
        let result = trimmedMean(values)
        XCTAssertEqual(result, 5.5, accuracy: 0.01) // mean of [5, 6]
    }

    // MARK: - Calculate Spread Tests

    func testCalculateSpreadBasic() {
        let values = [1.0, 2.0, 3.0, 4.0, 5.0]
        let spread = calculateSpread(values)

        XCTAssertEqual(spread.mean, 3.0, accuracy: 0.001)
        XCTAssertEqual(spread.median, 3.0, accuracy: 0.001)
        XCTAssertEqual(spread.min, 1.0)
        XCTAssertEqual(spread.max, 5.0)
        XCTAssertEqual(spread.range, 4.0)
    }

    func testCalculateSpreadEmpty() {
        let values: [Double] = []
        let spread = calculateSpread(values)

        XCTAssertEqual(spread, SpreadMetrics.empty)
    }

    // MARK: - Ensemble Probability Tests

    func testEnsembleProbabilityGreaterThan() {
        let values = [0.0, 0.5, 1.0, 2.0, 5.0]
        let result = ensembleProbability(values, threshold: 0.1, comparison: .greaterThan)
        XCTAssertEqual(result, 80.0, accuracy: 0.01) // 4 of 5 are > 0.1
    }

    func testEnsembleProbabilityLessThan() {
        let values = [0.0, 0.05, 0.5, 1.0, 2.0]
        let result = ensembleProbability(values, threshold: 0.1, comparison: .lessThan)
        XCTAssertEqual(result, 40.0, accuracy: 0.01) // 2 of 5 are < 0.1
    }

    func testEnsembleProbabilityEmpty() {
        let values: [Double] = []
        let result = ensembleProbability(values, threshold: 0.1, comparison: .greaterThan)
        XCTAssertEqual(result, 0.0)
    }

    // MARK: - Outlier Detection Tests

    func testFindOutliersBasic() {
        let values = [10.0, 11.0, 12.0, 10.0, 11.0, 50.0]
        let outliers = findOutlierIndices(values, threshold: 2.0)
        XCTAssertEqual(outliers, [5])
    }

    func testFindOutliersNone() {
        let values = [10.0, 11.0, 12.0, 10.0, 11.0, 12.0]
        let outliers = findOutlierIndices(values, threshold: 2.0)
        XCTAssertTrue(outliers.isEmpty)
    }

    func testFindOutliersMultiple() {
        // Values clustered around 10-12, with outliers at 1 and 100
        // Mean ~22.67, stddev ~34.5, so z-scores for 1 and 100 are < 2
        // Use tighter cluster for clearer outliers
        let values = [10.0, 10.0, 10.0, 10.0, 10.0, 50.0]
        let outliers = findOutlierIndices(values, threshold: 2.0)
        // 50 should be an outlier from the cluster of 10s
        XCTAssertTrue(outliers.contains(5), "Index 5 (value 50) should be an outlier")
    }

    func testFindOutliersSmallArray() {
        let values = [1.0, 100.0] // Too few for outlier detection
        let outliers = findOutlierIndices(values, threshold: 2.0)
        XCTAssertTrue(outliers.isEmpty)
    }
}

// MARK: - Confidence Service Tests

final class ConfidenceServiceTests: XCTestCase {
    // MARK: - From StdDev Tests

    func testConfidenceFromStdDevHigh() {
        let result = ConfidenceService.confidenceFromStdDev(
            1.0,
            highThreshold: 1.5,
            lowThreshold: 4.0
        )
        XCTAssertEqual(result, 1.0)
    }

    func testConfidenceFromStdDevLow() {
        let result = ConfidenceService.confidenceFromStdDev(
            5.0,
            highThreshold: 1.5,
            lowThreshold: 4.0
        )
        XCTAssertEqual(result, 0.3)
    }

    func testConfidenceFromStdDevMid() {
        let result = ConfidenceService.confidenceFromStdDev(
            2.75,
            highThreshold: 1.5,
            lowThreshold: 4.0
        )
        XCTAssertEqual(result, 0.65, accuracy: 0.01)
    }

    // MARK: - From Range Tests

    func testConfidenceFromRangeHigh() {
        let result = ConfidenceService.confidenceFromRange(
            5.0,
            highThreshold: 10.0,
            lowThreshold: 25.0
        )
        XCTAssertEqual(result, 1.0)
    }

    func testConfidenceFromRangeMid() {
        let result = ConfidenceService.confidenceFromRange(
            17.5,
            highThreshold: 10.0,
            lowThreshold: 25.0
        )
        XCTAssertEqual(result, 0.65, accuracy: 0.01)
    }

    func testConfidenceFromRangeLow() {
        let result = ConfidenceService.confidenceFromRange(
            30.0,
            highThreshold: 10.0,
            lowThreshold: 25.0
        )
        XCTAssertEqual(result, 0.3)
    }

    // MARK: - From Time Horizon Tests

    func testConfidenceFromTimeHorizonDay0() {
        let result = ConfidenceService.confidenceFromTimeHorizon(daysAhead: 0)
        XCTAssertEqual(result, 1.0)
    }

    func testConfidenceFromTimeHorizonDay5() {
        let result = ConfidenceService.confidenceFromTimeHorizon(daysAhead: 5)
        XCTAssertEqual(result, 0.75) // 1.0 - 5 * 0.05
    }

    func testConfidenceFromTimeHorizonDay10() {
        let result = ConfidenceService.confidenceFromTimeHorizon(daysAhead: 10)
        XCTAssertEqual(result, 0.5) // Floors at 0.5
    }

    func testConfidenceFromTimeHorizonBeyondMax() {
        let result = ConfidenceService.confidenceFromTimeHorizon(daysAhead: 15)
        XCTAssertEqual(result, 0.5) // Capped at 10 days, so stays at 0.5
    }

    // MARK: - From Agreement Tests

    func testConfidenceFromAgreementFull() {
        let result = ConfidenceService.confidenceFromAgreement(
            modelsInAgreement: 5,
            totalModels: 5
        )
        XCTAssertEqual(result, 1.0)
    }

    func testConfidenceFromAgreementNone() {
        let result = ConfidenceService.confidenceFromAgreement(
            modelsInAgreement: 0,
            totalModels: 5
        )
        XCTAssertEqual(result, 0.3)
    }

    func testConfidenceFromAgreementPartial() {
        let result = ConfidenceService.confidenceFromAgreement(
            modelsInAgreement: 3,
            totalModels: 5
        )
        // 0.3 + (3/5) * 0.7 = 0.3 + 0.42 = 0.72
        XCTAssertEqual(result, 0.72, accuracy: 0.01)
    }

    // MARK: - Score to Level Tests

    func testScoreToLevelHigh() {
        XCTAssertEqual(ConfidenceService.scoreToLevel(0.9), .high)
        XCTAssertEqual(ConfidenceService.scoreToLevel(0.8), .high)
    }

    func testScoreToLevelMedium() {
        XCTAssertEqual(ConfidenceService.scoreToLevel(0.7), .medium)
        XCTAssertEqual(ConfidenceService.scoreToLevel(0.5), .medium)
    }

    func testScoreToLevelLow() {
        XCTAssertEqual(ConfidenceService.scoreToLevel(0.4), .low)
        XCTAssertEqual(ConfidenceService.scoreToLevel(0.1), .low)
    }

    // MARK: - Format Tests

    func testGetConfidenceEmoji() {
        XCTAssertEqual(ConfidenceService.getConfidenceEmoji(.high), "\u{2705}")
        XCTAssertEqual(ConfidenceService.getConfidenceEmoji(.medium), "\u{26A0}\u{FE0F}")
        XCTAssertEqual(ConfidenceService.getConfidenceEmoji(.low), "\u{2753}")
    }
}

// MARK: - Narrative Builder Tests

final class NarrativeBuilderTests: XCTestCase {
    // MARK: - Weather Condition Tests

    func testWeatherCodeToConditionSunny() {
        XCTAssertEqual(NarrativeBuilder.weatherCodeToCondition(.clearSky), .sunny)
    }

    func testWeatherCodeToConditionRain() {
        XCTAssertEqual(NarrativeBuilder.weatherCodeToCondition(.slightRain), .rain)
        XCTAssertEqual(NarrativeBuilder.weatherCodeToCondition(.moderateRain), .rain)
        XCTAssertEqual(NarrativeBuilder.weatherCodeToCondition(.heavyRain), .rain)
    }

    func testWeatherCodeToConditionThunderstorm() {
        XCTAssertEqual(NarrativeBuilder.weatherCodeToCondition(.thunderstorm), .thunderstorm)
    }

    func testWeatherCodeToConditionSnow() {
        XCTAssertEqual(NarrativeBuilder.weatherCodeToCondition(.slightSnow), .snow)
        XCTAssertEqual(NarrativeBuilder.weatherCodeToCondition(.heavySnow), .snow)
    }

    // MARK: - Condition Description Tests

    func testConditionToDescription() {
        XCTAssertEqual(NarrativeBuilder.conditionToDescription(.sunny), "sunny")
        XCTAssertEqual(NarrativeBuilder.conditionToDescription(.rain), "rain")
        XCTAssertEqual(NarrativeBuilder.conditionToDescription(.thunderstorm), "thunderstorms")
        XCTAssertEqual(NarrativeBuilder.conditionToDescription(.unknown), "mixed conditions")
    }

    // MARK: - Precipitation Tests

    func testIsPrecipitation() {
        XCTAssertTrue(NarrativeBuilder.isPrecipitation(.rain))
        XCTAssertTrue(NarrativeBuilder.isPrecipitation(.drizzle))
        XCTAssertTrue(NarrativeBuilder.isPrecipitation(.snow))
        XCTAssertFalse(NarrativeBuilder.isPrecipitation(.sunny))
        XCTAssertFalse(NarrativeBuilder.isPrecipitation(.cloudy))
    }

    func testIsDryCondition() {
        XCTAssertTrue(NarrativeBuilder.isDryCondition(.sunny))
        XCTAssertTrue(NarrativeBuilder.isDryCondition(.cloudy))
        XCTAssertTrue(NarrativeBuilder.isDryCondition(.fog))
        XCTAssertFalse(NarrativeBuilder.isDryCondition(.rain))
        XCTAssertFalse(NarrativeBuilder.isDryCondition(.snow))
    }

    // MARK: - Formatting Tests

    func testFormatModelName() {
        XCTAssertEqual(NarrativeBuilder.formatModelName(.ecmwf), "ECMWF")
        XCTAssertEqual(NarrativeBuilder.formatModelName(.gfs), "GFS")
        XCTAssertEqual(NarrativeBuilder.formatModelName(.meteofrance), "ARPEGE")
        XCTAssertEqual(NarrativeBuilder.formatModelName(.ukmo), "UK Met Office")
    }

    func testFormatModelListSingle() {
        XCTAssertEqual(NarrativeBuilder.formatModelList([.ecmwf]), "ECMWF")
    }

    func testFormatModelListTwo() {
        XCTAssertEqual(NarrativeBuilder.formatModelList([.ecmwf, .gfs]), "ECMWF and GFS")
    }

    func testFormatModelListMultiple() {
        let result = NarrativeBuilder.formatModelList([.ecmwf, .gfs, .icon])
        XCTAssertEqual(result, "ECMWF, GFS, and ICON")
    }

    func testFormatTemperature() {
        XCTAssertEqual(NarrativeBuilder.formatTemperature(20.4), "20\u{00B0}C")
        XCTAssertEqual(NarrativeBuilder.formatTemperature(20.6), "21\u{00B0}C")
        XCTAssertEqual(NarrativeBuilder.formatTemperature(-5.0), "-5\u{00B0}C")
    }

    func testFormatPrecipitation() {
        XCTAssertEqual(NarrativeBuilder.formatPrecipitation(0.5), "trace amounts")
        XCTAssertEqual(NarrativeBuilder.formatPrecipitation(3.0), "3mm")
        XCTAssertEqual(NarrativeBuilder.formatPrecipitation(10.0), "10mm")
    }

    func testFormatTimePeriod() {
        XCTAssertEqual(NarrativeBuilder.formatTimePeriod(6), "morning")
        XCTAssertEqual(NarrativeBuilder.formatTimePeriod(14), "afternoon")
        XCTAssertEqual(NarrativeBuilder.formatTimePeriod(19), "evening")
        XCTAssertEqual(NarrativeBuilder.formatTimePeriod(2), "overnight")
    }

    // MARK: - Template Tests

    func testFillTemplate() {
        let template = "Hello {name}, the weather is {condition}."
        let result = NarrativeBuilder.fillTemplate(template, values: [
            "name": "World",
            "condition": "sunny",
        ])
        XCTAssertEqual(result, "Hello World, the weather is sunny.")
    }

    func testSelectTemplateReturnsFirst() {
        let templates = ["First", "Second", "Third"]
        XCTAssertEqual(NarrativeBuilder.selectTemplate(templates), "First")
    }

    // MARK: - Seeded Random Tests

    func testSeededRandomDeterministic() {
        var rng1 = SeededRandom(seed: 12345)
        var rng2 = SeededRandom(seed: 12345)

        for _ in 0 ..< 10 {
            XCTAssertEqual(rng1.next(), rng2.next())
        }
    }

    func testSeededRandomSelectIndex() {
        var rng = SeededRandom(seed: 42)
        for _ in 0 ..< 100 {
            let idx = rng.selectIndex(from: 5)
            XCTAssertTrue(idx >= 0 && idx < 5)
        }
    }
}

// MARK: - Aggregation Integration Tests

final class AggregationIntegrationTests: XCTestCase {
    // Helper to create test data
    func createTestModelForecast(
        model: ModelName,
        temperature: Double,
        precipitation: Double = 0.0
    ) throws -> ModelForecast {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.006)
        let now = Date()

        let metrics = WeatherMetrics(
            temperature: Celsius(rawValue: temperature),
            feelsLike: Celsius(rawValue: temperature - 2),
            humidity: Humidity(rawValue: 65)!,
            pressure: Pressure(rawValue: 1013)!,
            windSpeed: MetersPerSecond(rawValue: 5)!,
            windDirection: WindDirection(rawValue: 180),
            precipitation: Millimeters.clamped(precipitation),
            precipitationProbability: precipitation > 0.1 ? 0.8 : 0.1,
            cloudCover: CloudCover(rawValue: 50)!,
            visibility: Visibility(rawValue: 10000)!,
            uvIndex: UVIndex(rawValue: 5)!,
            weatherCode: .clearSky
        )

        let hourly = HourlyForecast(timestamp: now, metrics: metrics)

        let daily = DailyForecast(
            date: now,
            temperature: TemperatureRange(
                min: Celsius(rawValue: temperature - 5),
                max: Celsius(rawValue: temperature + 5)
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
                total: Millimeters.clamped(precipitation),
                probability: precipitation > 0.1 ? 0.8 : 0.1,
                hours: precipitation > 0 ? 2 : 0
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
                sunrise: now.addingTimeInterval(-6 * 3600),
                sunset: now.addingTimeInterval(6 * 3600),
                daylightHours: 12
            ),
            weatherCode: .clearSky,
            hourly: [hourly]
        )

        return ModelForecast(
            model: model,
            coordinates: coords,
            generatedAt: now,
            validFrom: now,
            validTo: now.addingTimeInterval(24 * 3600),
            hourly: [hourly],
            daily: [daily]
        )
    }

    func testAggregateMultipleModels() async throws {
        let forecasts = [
            try createTestModelForecast(model: .ecmwf, temperature: 20.0),
            try createTestModelForecast(model: .gfs, temperature: 21.0),
            try createTestModelForecast(model: .icon, temperature: 19.5),
            try createTestModelForecast(model: .meteofrance, temperature: 20.5),
            try createTestModelForecast(model: .ukmo, temperature: 20.0),
        ]

        let aggregated = try await AggregateService.aggregate(forecasts)

        // Check model count
        XCTAssertEqual(aggregated.models.count, 5)

        // Check that we have hourly and daily consensus
        XCTAssertFalse(aggregated.consensus.hourly.isEmpty)
        XCTAssertFalse(aggregated.consensus.daily.isEmpty)

        // Check model weights
        XCTAssertEqual(aggregated.modelWeights.count, 5)
        for weight in aggregated.modelWeights {
            XCTAssertEqual(weight.weight, 0.2, accuracy: 0.001)
        }
    }

    func testAggregateEmptyThrows() async {
        let forecasts: [ModelForecast] = []

        do {
            _ = try await AggregateService.aggregate(forecasts)
            XCTFail("Should throw for empty forecasts")
        } catch {
            XCTAssertEqual(
                (error as? AggregationError),
                AggregationError.emptyForecasts
            )
        }
    }

    func testAggregatedTemperatureUsesTrimmingMean() async throws {
        // Create forecasts with one outlier
        let forecasts = [
            try createTestModelForecast(model: .ecmwf, temperature: 20.0),
            try createTestModelForecast(model: .gfs, temperature: 20.0),
            try createTestModelForecast(model: .icon, temperature: 20.0),
            try createTestModelForecast(model: .meteofrance, temperature: 20.0),
            try createTestModelForecast(model: .ukmo, temperature: 50.0), // Outlier
        ]

        let aggregated = try await AggregateService.aggregate(forecasts)

        // With trimmed mean, the 50 should be excluded
        if let firstHourly = aggregated.consensus.hourly.first {
            // Trimmed mean of [20, 20, 20, 20, 50] -> removes extremes -> mean ~ 20
            XCTAssertEqual(firstHourly.metrics.temperature.rawValue, 20.0, accuracy: 1.0)
        }
    }

    func testNarrativeGeneration() async throws {
        let forecasts = [
            try createTestModelForecast(model: .ecmwf, temperature: 20.0),
            try createTestModelForecast(model: .gfs, temperature: 21.0),
            try createTestModelForecast(model: .icon, temperature: 19.5),
        ]

        let aggregated = try await AggregateService.aggregate(forecasts)
        let narrative = NarrativeBuilder.generateNarrative(aggregated)

        // Check narrative has content
        XCTAssertFalse(narrative.headline.isEmpty)
        // Should be an agreement narrative since temps are close
        XCTAssertTrue(narrative.headline.contains("Models agree") || narrative.headline.contains("agreement"))
    }
}

// MARK: - Golden Fixture Tests

final class GoldenFixtureTests: XCTestCase {
    struct TestFixture: Codable {
        let description: String
        let testCases: [TestCaseCategory]
    }

    struct TestCaseCategory: Codable {
        let name: String
        let tests: [TestCase]?
        let description: String?
        let models: [String]?
        let temperatures: [Double]?
        let expectedMean: Double?
        let expectedTrimmedMean: Double?
        let expectedMedian: Double?
        let tolerance: Double?
    }

    struct TestCase: Codable {
        let name: String
        let input: [Double]?
        let expected: Double?
        let tolerance: Double?
        let threshold: Double?
        let comparison: String?
        let expectedIndices: [Int]?
        let stdDev: Double?
        let range: Double?
        let highThreshold: Double?
        let lowThreshold: Double?
        let daysAhead: Int?
    }

    func loadFixture() throws -> TestFixture {
        let path = "/Users/harrison/Github/weather-oracle/apps/apple-native/SharedKit/Tests/Fixtures/aggregation-fixture.json"
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        return try JSONDecoder().decode(TestFixture.self, from: data)
    }

    func testStatisticsFromFixture() throws {
        let fixture = try loadFixture()
        guard let statsCategory = fixture.testCases.first(where: { $0.name == "statistics" }),
              let tests = statsCategory.tests
        else {
            XCTFail("No statistics tests found")
            return
        }

        for test in tests {
            let tolerance = test.tolerance ?? 0.001

            switch test.name {
            case "mean_basic":
                if let input = test.input, let expected = test.expected {
                    XCTAssertEqual(mean(input), expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            case "mean_empty":
                if let input = test.input, let expected = test.expected {
                    XCTAssertEqual(mean(input), expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            case "median_odd", "median_even":
                if let input = test.input, let expected = test.expected {
                    XCTAssertEqual(median(input), expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            case "stddev_basic":
                if let input = test.input, let expected = test.expected {
                    XCTAssertEqual(stdDev(input), expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            case "trimmedMean_basic", "trimmedMean_small":
                if let input = test.input, let expected = test.expected {
                    XCTAssertEqual(trimmedMean(input), expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            case "ensembleProbability_gt":
                if let input = test.input,
                   let expected = test.expected,
                   let threshold = test.threshold
                {
                    let result = ensembleProbability(input, threshold: threshold, comparison: .greaterThan)
                    XCTAssertEqual(result, expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            default:
                break
            }
        }
    }

    func testConfidenceFromFixture() throws {
        let fixture = try loadFixture()
        guard let confCategory = fixture.testCases.first(where: { $0.name == "confidence" }),
              let tests = confCategory.tests
        else {
            XCTFail("No confidence tests found")
            return
        }

        for test in tests {
            let tolerance = test.tolerance ?? 0.001

            if test.name.hasPrefix("fromStdDev") {
                if let sd = test.stdDev,
                   let high = test.highThreshold,
                   let low = test.lowThreshold,
                   let expected = test.expected
                {
                    let result = ConfidenceService.confidenceFromStdDev(sd, highThreshold: high, lowThreshold: low)
                    XCTAssertEqual(result, expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            } else if test.name.hasPrefix("fromRange") {
                if let range = test.range,
                   let high = test.highThreshold,
                   let low = test.lowThreshold,
                   let expected = test.expected
                {
                    let result = ConfidenceService.confidenceFromRange(range, highThreshold: high, lowThreshold: low)
                    XCTAssertEqual(result, expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            } else if test.name.hasPrefix("fromTimeHorizon") {
                if let days = test.daysAhead, let expected = test.expected {
                    let result = ConfidenceService.confidenceFromTimeHorizon(daysAhead: days)
                    XCTAssertEqual(result, expected, accuracy: tolerance, "Failed: \(test.name)")
                }
            }
        }
    }

    func testOutliersFromFixture() throws {
        let fixture = try loadFixture()
        guard let outlierCategory = fixture.testCases.first(where: { $0.name == "outliers" }),
              let tests = outlierCategory.tests
        else {
            XCTFail("No outlier tests found")
            return
        }

        for test in tests {
            if let input = test.input,
               let expectedIndices = test.expectedIndices,
               let threshold = test.threshold
            {
                let result = findOutlierIndices(input, threshold: threshold)
                XCTAssertEqual(Set(result), Set(expectedIndices), "Failed: \(test.name)")
            }
        }
    }

    func testModelAggregationFromFixture() throws {
        let fixture = try loadFixture()
        guard let aggCategory = fixture.testCases.first(where: { $0.name == "modelAggregation" }),
              let temperatures = aggCategory.temperatures,
              let expectedMean = aggCategory.expectedMean,
              let expectedTrimmedMean = aggCategory.expectedTrimmedMean,
              let expectedMedian = aggCategory.expectedMedian,
              let tolerance = aggCategory.tolerance
        else {
            XCTFail("No model aggregation test found")
            return
        }

        XCTAssertEqual(mean(temperatures), expectedMean, accuracy: tolerance)
        XCTAssertEqual(trimmedMean(temperatures), expectedTrimmedMean, accuracy: tolerance)
        XCTAssertEqual(median(temperatures), expectedMedian, accuracy: tolerance)
    }
}
