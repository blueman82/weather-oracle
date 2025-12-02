import XCTest
import SwiftUI
@testable import WeatherOracle
@testable import SharedKit

// MARK: - Visualization Mapper Tests

@MainActor
final class VisualizationMapperTests: XCTestCase {

    // MARK: - Test Data

    func createMockForecast() throws -> AggregatedForecast {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let now = Date()

        // Create hourly forecasts
        let hourlyForecasts = (0..<24).map { hour -> AggregatedHourlyForecast in
            let timestamp = now.addingTimeInterval(Double(hour) * 3600)
            let temp = 15.0 + sin(Double(hour) / 24.0 * 2 * .pi) * 10

            let metrics = WeatherMetrics(
                temperature: Celsius(rawValue: temp),
                feelsLike: Celsius(rawValue: temp - 2),
                humidity: Humidity(rawValue: 65)!,
                pressure: Pressure(rawValue: 1013)!,
                windSpeed: MetersPerSecond(rawValue: 5)!,
                windDirection: WindDirection(rawValue: 180),
                precipitation: Millimeters.clamped(Double(hour % 6)),
                precipitationProbability: 0.5,
                cloudCover: CloudCover(rawValue: 50)!,
                visibility: Visibility(rawValue: 10000)!,
                uvIndex: UVIndex(rawValue: 5)!,
                weatherCode: .clearSky
            )

            let consensus = ModelConsensus(
                agreementScore: 0.8,
                modelsInAgreement: [.ecmwf, .gfs, .icon],
                outlierModels: [.meteofrance],
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
                    min: Celsius(rawValue: 10),
                    max: Celsius(rawValue: 20)
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
                outlierModels: [.meteofrance],
                temperatureStats: MetricStatistics(mean: 15, median: 15, min: 10, max: 20, stdDev: 2.0, range: 10.0),
                precipitationStats: MetricStatistics(mean: 5, median: 5, min: 0, max: 10, stdDev: 2.0, range: 10.0),
                windStats: MetricStatistics(mean: 5, median: 5, min: 4, max: 6, stdDev: 0.5, range: 2.0)
            )

            let range = DailyRange(
                temperatureMax: MetricRange(min: 18, max: 22),
                temperatureMin: MetricRange(min: 8, max: 12),
                precipitation: MetricRange(min: 0, max: 10)
            )

            let confidence = ConfidenceLevel(level: .medium, score: 0.7)

            return AggregatedDailyForecast(
                date: date,
                forecast: forecast,
                confidence: confidence,
                modelAgreement: consensus,
                range: range
            )
        }

        let consensus = ForecastConsensus(hourly: hourlyForecasts, daily: dailyForecasts)

        return AggregatedForecast(
            coordinates: coords,
            generatedAt: now,
            validFrom: now,
            validTo: now.addingTimeInterval(7 * 24 * 3600),
            models: [.ecmwf, .gfs, .icon, .meteofrance],
            modelForecasts: [],
            consensus: consensus,
            modelWeights: [],
            overallConfidence: ConfidenceLevel(level: .high, score: 0.8)
        )
    }

    // MARK: - Temperature Series Tests

    func testMapTemperatureSeries() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.mapTemperatureSeries(from: forecast)

        XCTAssertEqual(series.count, 24)

        // Verify first data point
        let first = series.first!
        XCTAssertNotNil(first.timestamp)
        XCTAssertNotNil(first.temperature)
        XCTAssertNotNil(first.minTemp)
        XCTAssertNotNil(first.maxTemp)

        // Verify temperature is within expected range
        XCTAssertGreaterThan(first.temperature, 0)
        XCTAssertLessThan(first.temperature, 30)
    }

    func testMapTemperatureSeriesWithLimit() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.mapTemperatureSeries(from: forecast, limit: 12)

        XCTAssertEqual(series.count, 12)
    }

    func testMapDailyTemperatureSeries() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.mapDailyTemperatureSeries(from: forecast)

        XCTAssertEqual(series.count, 7)

        // Verify data point structure
        let first = series.first!
        XCTAssertNotNil(first.minTemp)
        XCTAssertNotNil(first.maxTemp)
        XCTAssertGreaterThan(first.maxTemp!, first.minTemp!)
    }

    // MARK: - Precipitation Series Tests

    func testMapPrecipitationSeries() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.mapPrecipitationSeries(from: forecast)

        XCTAssertEqual(series.count, 24)

        // Verify data point structure
        let first = series.first!
        XCTAssertNotNil(first.timestamp)
        XCTAssertGreaterThanOrEqual(first.amount, 0)
        XCTAssertGreaterThanOrEqual(first.probability, 0)
        XCTAssertLessThanOrEqual(first.probability, 1)
    }

    func testMapDailyPrecipitationSeries() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.mapDailyPrecipitationSeries(from: forecast)

        XCTAssertEqual(series.count, 7)

        // Verify precipitation amount is reasonable
        for point in series {
            XCTAssertGreaterThanOrEqual(point.amount, 0)
            XCTAssertLessThan(point.amount, 100) // Sanity check
        }
    }

    // MARK: - Confidence Series Tests

    func testMapConfidenceSeries() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.mapConfidenceSeries(from: forecast)

        XCTAssertEqual(series.count, 24)

        // Verify confidence score is in valid range
        for point in series {
            XCTAssertGreaterThanOrEqual(point.score, 0)
            XCTAssertLessThanOrEqual(point.score, 1)
        }
    }

    func testMapDailyConfidenceSeries() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.mapDailyConfidenceSeries(from: forecast)

        XCTAssertEqual(series.count, 7)

        // Verify confidence levels are set
        for point in series {
            XCTAssertNotNil(point.level)
        }
    }

    // MARK: - Model Constellation Tests

    func testMapModelNodes() throws {
        let forecast = try createMockForecast()
        let canvasSize = CGSize(width: 300, height: 300)
        let nodes = VisualizationMapper.mapModelNodes(from: forecast, canvasSize: canvasSize)

        XCTAssertEqual(nodes.count, 4) // ecmwf, gfs, icon, meteofrance

        // Verify node positions are within canvas bounds
        for node in nodes {
            XCTAssertGreaterThan(node.position.x, 0)
            XCTAssertLessThan(node.position.x, canvasSize.width)
            XCTAssertGreaterThan(node.position.y, 0)
            XCTAssertLessThan(node.position.y, canvasSize.height)
        }

        // Verify outlier detection
        let outliers = nodes.filter { $0.isOutlier }
        XCTAssertTrue(outliers.contains { $0.model == .meteofrance })
    }

    func testMapModelEdges() throws {
        let forecast = try createMockForecast()
        let edges = VisualizationMapper.mapModelEdges(from: forecast)

        // Should create edges between all model pairs
        // 4 models = 4 choose 2 = 6 edges
        XCTAssertEqual(edges.count, 6)

        // Verify edge strengths are in valid range
        for edge in edges {
            XCTAssertGreaterThanOrEqual(edge.strength, 0)
            XCTAssertLessThanOrEqual(edge.strength, 1)
        }
    }

    func testModelNodesDeterministicLayout() throws {
        let forecast = try createMockForecast()
        let canvasSize = CGSize(width: 300, height: 300)

        // Generate nodes multiple times
        let nodes1 = VisualizationMapper.mapModelNodes(from: forecast, canvasSize: canvasSize)
        let nodes2 = VisualizationMapper.mapModelNodes(from: forecast, canvasSize: canvasSize)

        // Verify positions are identical (deterministic)
        XCTAssertEqual(nodes1.count, nodes2.count)

        for (node1, node2) in zip(nodes1, nodes2) {
            XCTAssertEqual(node1.model, node2.model)
            XCTAssertEqual(node1.position.x, node2.position.x, accuracy: 0.01)
            XCTAssertEqual(node1.position.y, node2.position.y, accuracy: 0.01)
        }
    }

    // MARK: - Complete Chart Series Tests

    func testGenerateChartSeries() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.generateChartSeries(from: forecast)

        // Verify all series are populated
        XCTAssertEqual(series.temperatureData.count, 24)
        XCTAssertEqual(series.precipitationData.count, 24)
        XCTAssertEqual(series.confidenceData.count, 24)
        XCTAssertEqual(series.modelNodes.count, 4)
        XCTAssertEqual(series.modelEdges.count, 6)
    }

    func testGenerateChartSeriesWithCustomLimits() throws {
        let forecast = try createMockForecast()
        let series = VisualizationMapper.generateChartSeries(
            from: forecast,
            hourlyLimit: 12,
            dailyLimit: 3
        )

        XCTAssertEqual(series.temperatureData.count, 12)
        XCTAssertEqual(series.precipitationData.count, 12)
        XCTAssertEqual(series.confidenceData.count, 12)
    }

    // MARK: - Visualization Theme Tests

    func testVisualizationThemeColorForModel() {
        // Verify each model has a unique color
        let models: [ModelName] = [.ecmwf, .gfs, .icon, .meteofrance, .ukmo, .jma, .gem]
        let colors = models.map { VisualizationTheme.colorForModel($0) }

        // All models should have colors
        XCTAssertEqual(colors.count, models.count)
    }

    func testVisualizationThemeColorForConfidence() {
        let highColor = VisualizationTheme.colorForConfidence(.high)
        let mediumColor = VisualizationTheme.colorForConfidence(.medium)
        let lowColor = VisualizationTheme.colorForConfidence(.low)

        // Colors should be different
        XCTAssertNotEqual(highColor, mediumColor)
        XCTAssertNotEqual(mediumColor, lowColor)
        XCTAssertNotEqual(highColor, lowColor)
    }

    func testVisualizationThemeColorForTemperature() {
        let coldColor = VisualizationTheme.colorForTemperature(-5)
        let mildColor = VisualizationTheme.colorForTemperature(20)
        let hotColor = VisualizationTheme.colorForTemperature(30)

        // Verify we get different colors for different temperature ranges
        XCTAssertNotEqual(coldColor, mildColor)
        XCTAssertNotEqual(mildColor, hotColor)
    }

    func testVisualizationThemeColorForPrecipitation() {
        let noneColor = VisualizationTheme.colorForPrecipitation(0)
        let lightColor = VisualizationTheme.colorForPrecipitation(2)
        let moderateColor = VisualizationTheme.colorForPrecipitation(8)
        let heavyColor = VisualizationTheme.colorForPrecipitation(20)

        // Verify progression exists
        XCTAssertNotEqual(noneColor, lightColor)
        XCTAssertNotEqual(lightColor, moderateColor)
        XCTAssertNotEqual(moderateColor, heavyColor)
    }

    // MARK: - Data Point Tests

    func testTemperatureDataPointIdentifiable() {
        let now = Date()
        let point = TemperatureDataPoint(
            timestamp: now,
            temperature: 20,
            minTemp: 18,
            maxTemp: 22,
            color: .blue
        )

        XCTAssertEqual(point.id, now)
        XCTAssertEqual(point.timestamp, now)
        XCTAssertEqual(point.temperature, 20)
    }

    func testPrecipitationDataPointIdentifiable() {
        let now = Date()
        let point = PrecipitationDataPoint(
            timestamp: now,
            amount: 5,
            probability: 0.7,
            color: .blue
        )

        XCTAssertEqual(point.id, now)
        XCTAssertEqual(point.amount, 5)
        XCTAssertEqual(point.probability, 0.7)
    }

    func testConfidenceDataPointIdentifiable() {
        let now = Date()
        let point = ConfidenceDataPoint(
            timestamp: now,
            score: 0.85,
            level: .high,
            color: .green
        )

        XCTAssertEqual(point.id, now)
        XCTAssertEqual(point.score, 0.85)
        XCTAssertEqual(point.level, .high)
    }

    func testModelNodeIdentifiable() {
        let node = ModelNode(
            model: .ecmwf,
            position: CGPoint(x: 100, y: 100),
            color: .purple,
            isOutlier: false
        )

        XCTAssertEqual(node.id, "ecmwf")
        XCTAssertEqual(node.model, .ecmwf)
        XCTAssertFalse(node.isOutlier)
    }

    func testModelEdgeIdentifiable() {
        let edge = ModelEdge(from: .ecmwf, to: .gfs, strength: 0.8)

        XCTAssertEqual(edge.id, "ecmwf-gfs")
        XCTAssertEqual(edge.from, .ecmwf)
        XCTAssertEqual(edge.to, .gfs)
        XCTAssertEqual(edge.strength, 0.8)
    }
}
