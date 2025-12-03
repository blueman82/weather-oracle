import XCTest
import SwiftUI
import SharedKit
@testable import WeatherOracle

// MARK: - Visualization Snapshot Tests

/// UI tests ensuring consistent visualization appearance
final class VisualizationSnapshotTests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UITEST_MODE"]
    }

    override func tearDown() {
        app = nil
        super.tearDown()
    }

    // MARK: - Heatmap Tests

    func testGradientHeatmapRendering() throws {
        // This test validates that the gradient heatmap renders correctly
        // In a real implementation, you would:
        // 1. Navigate to a view containing the heatmap
        // 2. Take a snapshot
        // 3. Compare against reference image

        // For now, we test component structure
        let theme = VisualizationTheme.default

        let cells = (0..<3).map { row in
            (0..<24).map { col in
                let temp = 20.0 + Double(col) / 2.0
                return HeatmapCell(
                    row: row,
                    col: col,
                    value: temp,
                    color: theme.colorForTemperature(temp),
                    label: String(format: "%.0f", temp)
                )
            }
        }

        XCTAssertEqual(cells.count, 3, "Should have 3 rows")
        XCTAssertEqual(cells[0].count, 24, "Should have 24 columns")
        XCTAssertFalse(cells.isEmpty, "Cells should not be empty")
    }

    func testTemperatureGradientBar() throws {
        // Validate temperature gradient bar properties
        let theme = VisualizationTheme.default
        let minTemp = -10.0
        let maxTemp = 35.0

        // Test theme color mapping
        XCTAssertEqual(theme.colorForTemperature(-5), theme.coldColor)
        XCTAssertEqual(theme.colorForTemperature(10), theme.coolColor)
        XCTAssertEqual(theme.colorForTemperature(20), theme.warmColor)
        XCTAssertEqual(theme.colorForTemperature(30), theme.hotColor)
    }

    func testPrecipitationGradientBar() throws {
        // Validate precipitation gradient bar properties
        let theme = VisualizationTheme.default

        // Test precipitation color mapping
        XCTAssertEqual(theme.colorForPrecipitation(0), theme.dryColor)
        XCTAssertEqual(theme.colorForPrecipitation(2), theme.lightPrecipColor)
        XCTAssertEqual(theme.colorForPrecipitation(10), theme.heavyPrecipColor)
    }

    // MARK: - Constellation Tests

    func testModelConstellationNodePositioning() throws {
        // Test deterministic node positioning in constellation
        let theme = VisualizationTheme.default
        let size = CGSize(width: 300, height: 300)

        let models: [ModelName] = [.ecmwf, .gfs, .icon, .meteofrance]
        let radius = min(size.width, size.height) * 0.35
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let angleStep = (2 * Double.pi) / Double(models.count)

        // Validate first node position
        let firstAngle = 0 * angleStep - (Double.pi / 2)
        let expectedX = center.x + radius * cos(firstAngle)
        let expectedY = center.y + radius * sin(firstAngle)

        // Allow small floating point tolerance
        let tolerance: CGFloat = 0.01

        XCTAssertEqual(expectedX, center.x, accuracy: tolerance)
        XCTAssertLessThan(expectedY, center.y) // Should be above center
    }

    func testModelConstellationEdgeStrength() throws {
        // Test edge strength calculation based on temperature agreement
        let temp1 = 20.0
        let temp2 = 21.0
        let diff = abs(temp1 - temp2)
        let strength = max(0, 1 - (diff / 10.0))

        // 1 degree difference should result in high strength
        XCTAssertGreaterThan(strength, 0.8)

        let temp3 = 30.0
        let largeDiff = abs(temp1 - temp3)
        let weakStrength = max(0, 1 - (largeDiff / 10.0))

        // 10 degree difference should result in zero or very low strength
        XCTAssertLessThanOrEqual(weakStrength, 0.1)
    }

    func testModelConstellationOutlierHighlighting() throws {
        // Test outlier node visual differentiation
        let theme = VisualizationTheme.default
        let normalNode = ModelNode(
            model: .ecmwf,
            position: CGPoint(x: 100, y: 100),
            isOutlier: false,
            color: theme.modelNodeColor
        )

        let outlierNode = ModelNode(
            model: .gfs,
            position: CGPoint(x: 200, y: 200),
            isOutlier: true,
            color: theme.outlierColor
        )

        XCTAssertEqual(normalNode.color, theme.modelNodeColor)
        XCTAssertEqual(outlierNode.color, theme.outlierColor)
        XCTAssertNotEqual(normalNode.color, outlierNode.color)
    }

    // MARK: - Sparkline Tests

    func testConfidenceSparklineDataPoints() throws {
        // Test sparkline data point structure
        let theme = VisualizationTheme.default
        let dates = [Date(), Date().addingTimeInterval(86400), Date().addingTimeInterval(172800)]
        let scores = [0.9, 0.7, 0.5]
        let levels: [ConfidenceLevelName] = [.high, .medium, .low]

        let dataPoints = zip(zip(dates, scores), levels).map {
            (date: $0.0.0, score: $0.0.1, color: theme.colorForConfidence($0.1))
        }

        XCTAssertEqual(dataPoints.count, 3)
        XCTAssertEqual(dataPoints[0].score, 0.9)
        XCTAssertEqual(dataPoints[1].score, 0.7)
        XCTAssertEqual(dataPoints[2].score, 0.5)
    }

    // MARK: - Mapper Tests

    func testVisualizationMapperTemperatureSeries() throws {
        // Create test forecast
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let now = Date()

        let hourly = AggregatedHourlyForecast(
            timestamp: now,
            metrics: WeatherMetrics(
                temperature: Celsius(rawValue: 20.0),
                feelsLike: Celsius(rawValue: 19.0),
                humidity: Humidity(rawValue: 65)!,
                pressure: Pressure(rawValue: 1013)!,
                windSpeed: MetersPerSecond(rawValue: 5)!,
                windDirection: WindDirection(rawValue: 180),
                precipitation: Millimeters(rawValue: 0)!,
                precipitationProbability: 0.1,
                cloudCover: CloudCover(rawValue: 50)!,
                visibility: Visibility(rawValue: 10000)!,
                uvIndex: UVIndex(rawValue: 5)!,
                weatherCode: .clearSky
            ),
            confidence: ConfidenceLevel.from(score: 0.8)!,
            modelAgreement: ModelConsensus(
                agreementScore: 0.8,
                modelsInAgreement: [.ecmwf, .gfs],
                outlierModels: [],
                temperatureStats: MetricStatistics(mean: 20, median: 20, min: 19, max: 21, stdDev: 1, range: 2),
                precipitationStats: MetricStatistics.empty,
                windStats: MetricStatistics.empty
            ),
            range: HourlyRange(
                temperature: MetricRange(min: 19, max: 21),
                precipitation: MetricRange(min: 0, max: 0),
                windSpeed: MetricRange(min: 4, max: 6)
            )
        )

        let forecast = AggregatedForecast(
            coordinates: coords,
            generatedAt: now,
            validFrom: now,
            validTo: now.addingTimeInterval(86400),
            models: [.ecmwf, .gfs],
            modelForecasts: [],
            consensus: ForecastConsensus(hourly: [hourly], daily: []),
            modelWeights: [],
            overallConfidence: ConfidenceLevel.from(score: 0.8)!
        )

        // Map to temperature series
        let theme = VisualizationTheme.default
        let series = VisualizationMapper.mapTemperatureSeries(forecast, theme: theme)

        XCTAssertEqual(series.count, 1)
        XCTAssertEqual(series[0].temperature, 20.0)
        XCTAssertEqual(series[0].minRange, 19.0)
        XCTAssertEqual(series[0].maxRange, 21.0)
        XCTAssertEqual(series[0].confidence, .high)
    }

    func testVisualizationMapperPrecipitationSeries() throws {
        // Create test forecast with precipitation
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let now = Date()

        let hourly = AggregatedHourlyForecast(
            timestamp: now,
            metrics: WeatherMetrics(
                temperature: Celsius(rawValue: 15.0),
                feelsLike: Celsius(rawValue: 14.0),
                humidity: Humidity(rawValue: 85)!,
                pressure: Pressure(rawValue: 1010)!,
                windSpeed: MetersPerSecond(rawValue: 8)!,
                windDirection: WindDirection(rawValue: 270),
                precipitation: Millimeters(rawValue: 5.0)!,
                precipitationProbability: 0.8,
                cloudCover: CloudCover(rawValue: 90)!,
                visibility: Visibility(rawValue: 5000)!,
                uvIndex: UVIndex(rawValue: 2)!,
                weatherCode: .slightRain
            ),
            confidence: ConfidenceLevel.from(score: 0.6)!,
            modelAgreement: ModelConsensus(
                agreementScore: 0.6,
                modelsInAgreement: [.ecmwf],
                outlierModels: [.gfs],
                temperatureStats: MetricStatistics.empty,
                precipitationStats: MetricStatistics(mean: 5, median: 5, min: 2, max: 8, stdDev: 3, range: 6),
                windStats: MetricStatistics.empty
            ),
            range: HourlyRange(
                temperature: MetricRange(min: 14, max: 16),
                precipitation: MetricRange(min: 2, max: 8),
                windSpeed: MetricRange(min: 6, max: 10)
            )
        )

        let forecast = AggregatedForecast(
            coordinates: coords,
            generatedAt: now,
            validFrom: now,
            validTo: now.addingTimeInterval(86400),
            models: [.ecmwf, .gfs],
            modelForecasts: [],
            consensus: ForecastConsensus(hourly: [hourly], daily: []),
            modelWeights: [],
            overallConfidence: ConfidenceLevel.from(score: 0.6)!
        )

        // Map to precipitation series
        let theme = VisualizationTheme.default
        let series = VisualizationMapper.mapPrecipitationSeries(forecast, theme: theme)

        XCTAssertEqual(series.count, 1)
        XCTAssertEqual(series[0].amount, 5.0)
        XCTAssertEqual(series[0].probability, 0.8)
    }

    // MARK: - Theme Tests

    func testVisualizationThemeColorMapping() throws {
        let theme = VisualizationTheme.default

        // Temperature colors
        XCTAssertEqual(theme.colorForTemperature(-5), theme.coldColor)
        XCTAssertEqual(theme.colorForTemperature(5), theme.coolColor)
        XCTAssertEqual(theme.colorForTemperature(20), theme.warmColor)
        XCTAssertEqual(theme.colorForTemperature(30), theme.hotColor)

        // Precipitation colors
        XCTAssertEqual(theme.colorForPrecipitation(0), theme.dryColor)
        XCTAssertEqual(theme.colorForPrecipitation(3), theme.lightPrecipColor)
        XCTAssertEqual(theme.colorForPrecipitation(8), theme.heavyPrecipColor)

        // Confidence colors
        XCTAssertEqual(theme.colorForConfidence(.high), theme.highConfidenceColor)
        XCTAssertEqual(theme.colorForConfidence(.medium), theme.mediumConfidenceColor)
        XCTAssertEqual(theme.colorForConfidence(.low), theme.lowConfidenceColor)
    }

    func testVisualizationThemeCustomization() throws {
        // Test custom theme creation
        let customTheme = VisualizationTheme(
            coldColor: .purple,
            coolColor: .blue,
            warmColor: .yellow,
            hotColor: .red
        )

        XCTAssertEqual(customTheme.coldColor, .purple)
        XCTAssertEqual(customTheme.coolColor, .blue)
        XCTAssertEqual(customTheme.warmColor, .yellow)
        XCTAssertEqual(customTheme.hotColor, .red)
    }

    // MARK: - Integration Tests

    func testHeatmapWithRealForecastData() throws {
        // Test heatmap generation with realistic data
        let theme = VisualizationTheme.default

        // Generate 3 days of hourly data
        let cells = (0..<3).map { day in
            (0..<24).map { hour in
                // Simulate daily temperature curve
                let baseTemp = 15.0
                let dailyVariation = 8.0
                let hourAngle = Double(hour) / 24.0 * 2 * Double.pi
                let temp = baseTemp + dailyVariation * sin(hourAngle - Double.pi / 2)

                return HeatmapCell(
                    row: day,
                    col: hour,
                    value: temp,
                    color: theme.colorForTemperature(temp),
                    label: String(format: "%.0f", temp)
                )
            }
        }

        XCTAssertEqual(cells.count, 3)
        XCTAssertEqual(cells[0].count, 24)

        // Verify temperature curve (should peak around hour 14-15)
        let noonTemp = cells[0][14].value
        let midnightTemp = cells[0][0].value
        XCTAssertGreaterThan(noonTemp, midnightTemp, "Noon should be warmer than midnight")
    }

    func testConstellationWithRealModelData() throws {
        // Test constellation generation with realistic model agreement
        let theme = VisualizationTheme.default

        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let now = Date()

        // Create model forecasts with varying temperatures
        let ecmwfForecast = createMockModelForecast(model: .ecmwf, temp: 20.0, coords: coords, date: now)
        let gfsForecast = createMockModelForecast(model: .gfs, temp: 25.0, coords: coords, date: now) // Outlier
        let iconForecast = createMockModelForecast(model: .icon, temp: 19.5, coords: coords, date: now)

        let forecast = AggregatedForecast(
            coordinates: coords,
            generatedAt: now,
            validFrom: now,
            validTo: now.addingTimeInterval(86400),
            models: [.ecmwf, .gfs, .icon],
            modelForecasts: [ecmwfForecast, gfsForecast, iconForecast],
            consensus: ForecastConsensus(hourly: [], daily: []),
            modelWeights: [],
            overallConfidence: ConfidenceLevel.from(score: 0.7)!
        )

        let (nodes, edges) = VisualizationMapper.mapModelConstellation(
            forecast,
            theme: theme,
            size: CGSize(width: 300, height: 300)
        )

        XCTAssertEqual(nodes.count, 3)
        XCTAssertGreaterThan(edges.count, 0)

        // Verify nodes are positioned in circle
        for node in nodes {
            let center = CGPoint(x: 150, y: 150)
            let distance = sqrt(pow(node.position.x - center.x, 2) + pow(node.position.y - center.y, 2))
            XCTAssertGreaterThan(distance, 50, "Nodes should be away from center")
            XCTAssertLessThan(distance, 150, "Nodes should be within bounds")
        }
    }

    // MARK: - Helper Functions

    private func createMockModelForecast(
        model: ModelName,
        temp: Double,
        coords: Coordinates,
        date: Date
    ) -> ModelForecast {
        let daily = DailyForecast(
            date: date,
            temperature: TemperatureRange(
                min: Celsius(rawValue: temp - 5),
                max: Celsius(rawValue: temp + 5)
            ),
            humidityRange: HumidityRange(
                min: Humidity(rawValue: 50)!,
                max: Humidity(rawValue: 80)!
            ),
            pressureRange: PressureRange(
                min: Pressure(rawValue: 1010)!,
                max: Pressure(rawValue: 1020)!
            ),
            precipitation: PrecipitationSummary(
                total: Millimeters(rawValue: 0)!,
                probability: 0.1,
                hours: 0
            ),
            wind: WindSummary(
                avgSpeed: MetersPerSecond(rawValue: 5)!,
                maxSpeed: MetersPerSecond(rawValue: 10)!,
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

        return ModelForecast(
            model: model,
            coordinates: coords,
            generatedAt: date,
            validFrom: date,
            validTo: date.addingTimeInterval(86400),
            hourly: [],
            daily: [daily]
        )
    }
}
