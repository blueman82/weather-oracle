import Foundation
import SwiftUI
import SharedKit

// MARK: - Visualization Theme

/// Centralized color token management for charts and visualizations
public struct VisualizationTheme {
    // Temperature colors
    public static let temperatureCold = Color.blue
    public static let temperatureMild = Color.orange
    public static let temperatureHot = Color.red

    // Confidence colors
    public static let confidenceHigh = Color.green
    public static let confidenceMedium = Color.yellow
    public static let confidenceLow = Color.red

    // Precipitation colors
    public static let precipitationNone = Color.clear
    public static let precipitationLight = Color.blue.opacity(0.3)
    public static let precipitationModerate = Color.blue.opacity(0.6)
    public static let precipitationHeavy = Color.blue.opacity(0.9)

    // Model colors (consistent across visualizations)
    public static func colorForModel(_ model: ModelName) -> Color {
        switch model {
        case .ecmwf: return Color.purple
        case .gfs: return Color.blue
        case .icon: return Color.green
        case .meteofrance: return Color.orange
        case .ukmo: return Color.red
        case .jma: return Color.cyan
        case .gem: return Color.pink
        }
    }

    // Confidence badge colors
    public static func colorForConfidence(_ level: ConfidenceLevelName) -> Color {
        switch level {
        case .high: return confidenceHigh
        case .medium: return confidenceMedium
        case .low: return confidenceLow
        }
    }

    // Temperature gradient based on value
    public static func colorForTemperature(_ celsius: Double) -> Color {
        switch celsius {
        case ..<0:
            return temperatureCold
        case 0..<15:
            return Color.blue.opacity(0.7)
        case 15..<25:
            return temperatureMild
        case 25...:
            return temperatureHot
        default:
            return Color.gray
        }
    }

    // Precipitation intensity color
    public static func colorForPrecipitation(_ mm: Double) -> Color {
        switch mm {
        case 0:
            return precipitationNone
        case 0..<5:
            return precipitationLight
        case 5..<15:
            return precipitationModerate
        default:
            return precipitationHeavy
        }
    }

    // Support for dark mode
    public static func adaptiveColor(light: Color, dark: Color) -> Color {
        #if os(iOS)
        return Color(UIColor { traitCollection in
            traitCollection.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
        #elseif os(macOS)
        return Color(NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(dark) : NSColor(light)
        })
        #else
        return light
        #endif
    }
}

// MARK: - Chart Data Series

/// Temperature data point for charts
public struct TemperatureDataPoint: Identifiable, Hashable {
    public let id: Date
    public let timestamp: Date
    public let temperature: Double
    public let minTemp: Double?
    public let maxTemp: Double?
    public let color: Color

    public init(timestamp: Date, temperature: Double, minTemp: Double? = nil, maxTemp: Double? = nil, color: Color) {
        self.id = timestamp
        self.timestamp = timestamp
        self.temperature = temperature
        self.minTemp = minTemp
        self.maxTemp = maxTemp
        self.color = color
    }
}

/// Precipitation data point for charts
public struct PrecipitationDataPoint: Identifiable, Hashable {
    public let id: Date
    public let timestamp: Date
    public let amount: Double
    public let probability: Double
    public let color: Color

    public init(timestamp: Date, amount: Double, probability: Double, color: Color) {
        self.id = timestamp
        self.timestamp = timestamp
        self.amount = amount
        self.probability = probability
        self.color = color
    }
}

/// Confidence data point for timeline
public struct ConfidenceDataPoint: Identifiable, Hashable {
    public let id: Date
    public let timestamp: Date
    public let score: Double
    public let level: ConfidenceLevelName
    public let color: Color

    public init(timestamp: Date, score: Double, level: ConfidenceLevelName, color: Color) {
        self.id = timestamp
        self.timestamp = timestamp
        self.score = score
        self.level = level
        self.color = color
    }
}

/// Model agreement node for constellation
public struct ModelNode: Identifiable, Hashable {
    public let id: String
    public let model: ModelName
    public let position: CGPoint
    public let color: Color
    public let isOutlier: Bool

    public init(model: ModelName, position: CGPoint, color: Color, isOutlier: Bool) {
        self.id = model.rawValue
        self.model = model
        self.position = position
        self.color = color
        self.isOutlier = isOutlier
    }
}

/// Edge between models in constellation
public struct ModelEdge: Identifiable, Hashable {
    public let id: String
    public let from: ModelName
    public let to: ModelName
    public let strength: Double // 0-1, based on agreement

    public init(from: ModelName, to: ModelName, strength: Double) {
        self.id = "\(from.rawValue)-\(to.rawValue)"
        self.from = from
        self.to = to
        self.strength = strength
    }
}

// MARK: - Chart Series

/// Complete chart series for an aggregated forecast
public struct ChartSeries {
    public let temperatureData: [TemperatureDataPoint]
    public let precipitationData: [PrecipitationDataPoint]
    public let confidenceData: [ConfidenceDataPoint]
    public let modelNodes: [ModelNode]
    public let modelEdges: [ModelEdge]

    public init(
        temperatureData: [TemperatureDataPoint],
        precipitationData: [PrecipitationDataPoint],
        confidenceData: [ConfidenceDataPoint],
        modelNodes: [ModelNode],
        modelEdges: [ModelEdge]
    ) {
        self.temperatureData = temperatureData
        self.precipitationData = precipitationData
        self.confidenceData = confidenceData
        self.modelNodes = modelNodes
        self.modelEdges = modelEdges
    }
}

// MARK: - Visualization Mapper

/// Converts aggregated forecast data into chart series with color tokens
public enum VisualizationMapper {

    // MARK: - Temperature Series

    /// Map hourly temperature data with range indicators
    public static func mapTemperatureSeries(
        from forecast: AggregatedForecast,
        limit: Int? = nil
    ) -> [TemperatureDataPoint] {
        let hourly = limit.map { Array(forecast.consensus.hourly.prefix($0)) } ?? forecast.consensus.hourly

        return hourly.map { hour in
            let temp = hour.metrics.temperature.rawValue
            let minTemp = hour.range.temperature.min
            let maxTemp = hour.range.temperature.max
            let color = VisualizationTheme.colorForTemperature(temp)

            return TemperatureDataPoint(
                timestamp: hour.timestamp,
                temperature: temp,
                minTemp: minTemp,
                maxTemp: maxTemp,
                color: color
            )
        }
    }

    /// Map daily temperature data with high/low ranges
    public static func mapDailyTemperatureSeries(
        from forecast: AggregatedForecast,
        limit: Int? = nil
    ) -> [TemperatureDataPoint] {
        let daily = limit.map { Array(forecast.consensus.daily.prefix($0)) } ?? forecast.consensus.daily

        return daily.map { day in
            let avgTemp = (day.forecast.temperature.min.rawValue + day.forecast.temperature.max.rawValue) / 2
            let color = VisualizationTheme.colorForTemperature(avgTemp)

            return TemperatureDataPoint(
                timestamp: day.date,
                temperature: avgTemp,
                minTemp: day.forecast.temperature.min.rawValue,
                maxTemp: day.forecast.temperature.max.rawValue,
                color: color
            )
        }
    }

    // MARK: - Precipitation Series

    /// Map hourly precipitation data
    public static func mapPrecipitationSeries(
        from forecast: AggregatedForecast,
        limit: Int? = nil
    ) -> [PrecipitationDataPoint] {
        let hourly = limit.map { Array(forecast.consensus.hourly.prefix($0)) } ?? forecast.consensus.hourly

        return hourly.map { hour in
            let amount = hour.metrics.precipitation.rawValue
            let probability = hour.metrics.precipitationProbability
            let color = VisualizationTheme.colorForPrecipitation(amount)

            return PrecipitationDataPoint(
                timestamp: hour.timestamp,
                amount: amount,
                probability: probability,
                color: color
            )
        }
    }

    /// Map daily precipitation data
    public static func mapDailyPrecipitationSeries(
        from forecast: AggregatedForecast,
        limit: Int? = nil
    ) -> [PrecipitationDataPoint] {
        let daily = limit.map { Array(forecast.consensus.daily.prefix($0)) } ?? forecast.consensus.daily

        return daily.map { day in
            let amount = day.forecast.precipitation.total.rawValue
            let probability = day.forecast.precipitation.probability
            let color = VisualizationTheme.colorForPrecipitation(amount)

            return PrecipitationDataPoint(
                timestamp: day.date,
                amount: amount,
                probability: probability,
                color: color
            )
        }
    }

    // MARK: - Confidence Series

    /// Map confidence timeline
    public static func mapConfidenceSeries(
        from forecast: AggregatedForecast,
        limit: Int? = nil
    ) -> [ConfidenceDataPoint] {
        let hourly = limit.map { Array(forecast.consensus.hourly.prefix($0)) } ?? forecast.consensus.hourly

        return hourly.map { hour in
            let score = hour.confidence.score
            let level = hour.confidence.level
            let color = VisualizationTheme.colorForConfidence(level)

            return ConfidenceDataPoint(
                timestamp: hour.timestamp,
                score: score,
                level: level,
                color: color
            )
        }
    }

    /// Map daily confidence timeline
    public static func mapDailyConfidenceSeries(
        from forecast: AggregatedForecast,
        limit: Int? = nil
    ) -> [ConfidenceDataPoint] {
        let daily = limit.map { Array(forecast.consensus.daily.prefix($0)) } ?? forecast.consensus.daily

        return daily.map { day in
            let score = day.confidence.score
            let level = day.confidence.level
            let color = VisualizationTheme.colorForConfidence(level)

            return ConfidenceDataPoint(
                timestamp: day.date,
                score: score,
                level: level,
                color: color
            )
        }
    }

    // MARK: - Model Constellation

    /// Create model nodes for constellation view with deterministic layout
    public static func mapModelNodes(
        from forecast: AggregatedForecast,
        canvasSize: CGSize
    ) -> [ModelNode] {
        let models = forecast.models
        let count = models.count

        // Use first hourly forecast for outlier detection
        let outlierModels = Set(forecast.consensus.hourly.first?.modelAgreement.outlierModels ?? [])

        // Deterministic circular layout
        let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
        let radius = min(canvasSize.width, canvasSize.height) * 0.35

        return models.enumerated().map { index, model in
            let angle = (2 * .pi * Double(index)) / Double(count) - .pi / 2 // Start from top
            let x = center.x + radius * cos(angle)
            let y = center.y + radius * sin(angle)
            let position = CGPoint(x: x, y: y)
            let color = VisualizationTheme.colorForModel(model)
            let isOutlier = outlierModels.contains(model)

            return ModelNode(
                model: model,
                position: position,
                color: color,
                isOutlier: isOutlier
            )
        }
    }

    /// Create edges between models based on agreement strength
    public static func mapModelEdges(
        from forecast: AggregatedForecast
    ) -> [ModelEdge] {
        let models = forecast.models
        var edges: [ModelEdge] = []

        // Use first hourly forecast for agreement calculation
        guard let firstHourly = forecast.consensus.hourly.first else {
            return edges
        }

        let consensus = firstHourly.modelAgreement
        let agreementModels = Set(consensus.modelsInAgreement)

        // Create edges between models in agreement
        for i in 0..<models.count {
            for j in (i+1)..<models.count {
                let model1 = models[i]
                let model2 = models[j]

                // Both in agreement = strong edge
                let bothInAgreement = agreementModels.contains(model1) && agreementModels.contains(model2)
                let strength = bothInAgreement ? 0.8 : 0.2

                edges.append(ModelEdge(from: model1, to: model2, strength: strength))
            }
        }

        return edges
    }

    // MARK: - Complete Series

    /// Generate complete chart series from aggregated forecast
    public static func generateChartSeries(
        from forecast: AggregatedForecast,
        hourlyLimit: Int = 24,
        dailyLimit: Int = 7,
        canvasSize: CGSize = CGSize(width: 300, height: 300)
    ) -> ChartSeries {
        let temperatureData = mapTemperatureSeries(from: forecast, limit: hourlyLimit)
        let precipitationData = mapPrecipitationSeries(from: forecast, limit: hourlyLimit)
        let confidenceData = mapConfidenceSeries(from: forecast, limit: hourlyLimit)
        let modelNodes = mapModelNodes(from: forecast, canvasSize: canvasSize)
        let modelEdges = mapModelEdges(from: forecast)

        return ChartSeries(
            temperatureData: temperatureData,
            precipitationData: precipitationData,
            confidenceData: confidenceData,
            modelNodes: modelNodes,
            modelEdges: modelEdges
        )
    }
}
