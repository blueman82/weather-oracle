import Foundation
import SharedKit
import SwiftUI

// MARK: - Visualization Theme

/// Color theme for visualization components supporting light/dark modes
public struct VisualizationTheme {
    // Temperature colors
    public let coldColor: Color
    public let coolColor: Color
    public let warmColor: Color
    public let hotColor: Color

    // Precipitation colors
    public let dryColor: Color
    public let lightPrecipColor: Color
    public let heavyPrecipColor: Color

    // Confidence colors
    public let highConfidenceColor: Color
    public let mediumConfidenceColor: Color
    public let lowConfidenceColor: Color

    // Model colors
    public let modelNodeColor: Color
    public let modelEdgeColor: Color
    public let outlierColor: Color

    // Background
    public let backgroundColor: Color
    public let gridColor: Color

    public init(
        coldColor: Color = .blue,
        coolColor: Color = .cyan,
        warmColor: Color = .orange,
        hotColor: Color = .red,
        dryColor: Color = .gray.opacity(0.3),
        lightPrecipColor: Color = .blue.opacity(0.5),
        heavyPrecipColor: Color = .blue,
        highConfidenceColor: Color = .green,
        mediumConfidenceColor: Color = .yellow,
        lowConfidenceColor: Color = .red,
        modelNodeColor: Color = .blue,
        modelEdgeColor: Color = .gray.opacity(0.5),
        outlierColor: Color = .orange,
        backgroundColor: Color = .clear,
        gridColor: Color = .gray.opacity(0.2)
    ) {
        self.coldColor = coldColor
        self.coolColor = coolColor
        self.warmColor = warmColor
        self.hotColor = hotColor
        self.dryColor = dryColor
        self.lightPrecipColor = lightPrecipColor
        self.heavyPrecipColor = heavyPrecipColor
        self.highConfidenceColor = highConfidenceColor
        self.mediumConfidenceColor = mediumConfidenceColor
        self.lowConfidenceColor = lowConfidenceColor
        self.modelNodeColor = modelNodeColor
        self.modelEdgeColor = modelEdgeColor
        self.outlierColor = outlierColor
        self.backgroundColor = backgroundColor
        self.gridColor = gridColor
    }

    /// Default theme with adaptive colors
    public static let `default` = VisualizationTheme()

    /// Get color for temperature value
    public func colorForTemperature(_ celsius: Double) -> Color {
        switch celsius {
        case ..<0: return coldColor
        case 0..<15: return coolColor
        case 15..<25: return warmColor
        default: return hotColor
        }
    }

    /// Get color for precipitation amount
    public func colorForPrecipitation(_ mm: Double) -> Color {
        switch mm {
        case 0: return dryColor
        case 0..<5: return lightPrecipColor
        default: return heavyPrecipColor
        }
    }

    /// Get color for confidence level
    public func colorForConfidence(_ level: ConfidenceLevelName) -> Color {
        switch level {
        case .high: return highConfidenceColor
        case .medium: return mediumConfidenceColor
        case .low: return lowConfidenceColor
        }
    }
}

// MARK: - Chart Series Data

/// Data point for temperature chart
public struct TemperatureDataPoint: Identifiable {
    public let id: Date
    public let timestamp: Date
    public let temperature: Double
    public let minRange: Double
    public let maxRange: Double
    public let confidence: ConfidenceLevelName
    public let color: Color

    public init(
        timestamp: Date,
        temperature: Double,
        minRange: Double,
        maxRange: Double,
        confidence: ConfidenceLevelName,
        color: Color
    ) {
        self.id = timestamp
        self.timestamp = timestamp
        self.temperature = temperature
        self.minRange = minRange
        self.maxRange = maxRange
        self.confidence = confidence
        self.color = color
    }
}

/// Data point for precipitation chart
public struct PrecipitationDataPoint: Identifiable {
    public let id: Date
    public let timestamp: Date
    public let amount: Double
    public let probability: Double
    public let color: Color

    public init(
        timestamp: Date,
        amount: Double,
        probability: Double,
        color: Color
    ) {
        self.id = timestamp
        self.timestamp = timestamp
        self.amount = amount
        self.probability = probability
        self.color = color
    }
}

/// Node in model constellation
public struct ModelNode: Identifiable {
    public let id: ModelName
    public let model: ModelName
    public let position: CGPoint
    public let isOutlier: Bool
    public let color: Color

    public init(
        model: ModelName,
        position: CGPoint,
        isOutlier: Bool,
        color: Color
    ) {
        self.id = model
        self.model = model
        self.position = position
        self.isOutlier = isOutlier
        self.color = color
    }
}

/// Edge in model constellation
public struct ModelEdge: Identifiable {
    public let id: String
    public let from: ModelName
    public let to: ModelName
    public let strength: Double
    public let color: Color

    public init(from: ModelName, to: ModelName, strength: Double, color: Color) {
        self.id = "\(from.rawValue)-\(to.rawValue)"
        self.from = from
        self.to = to
        self.strength = strength
        self.color = color
    }
}

/// Heatmap cell data
public struct HeatmapCell: Identifiable {
    public let id: String
    public let row: Int
    public let col: Int
    public let value: Double
    public let color: Color
    public let label: String

    public init(row: Int, col: Int, value: Double, color: Color, label: String) {
        self.id = "\(row)-\(col)"
        self.row = row
        self.col = col
        self.value = value
        self.color = color
        self.label = label
    }
}

// MARK: - Visualization Mapper

/// Converts aggregated forecast data into chart series with color tokens
public enum VisualizationMapper {
    /// Convert hourly forecasts to temperature data points
    public static func mapTemperatureSeries(
        _ forecast: AggregatedForecast,
        theme: VisualizationTheme = .default
    ) -> [TemperatureDataPoint] {
        forecast.consensus.hourly.map { hourly in
            let temp = hourly.metrics.temperature.rawValue
            let color = theme.colorForTemperature(temp)

            return TemperatureDataPoint(
                timestamp: hourly.timestamp,
                temperature: temp,
                minRange: hourly.range.temperature.min,
                maxRange: hourly.range.temperature.max,
                confidence: hourly.confidence.level,
                color: color
            )
        }
    }

    /// Convert hourly forecasts to precipitation data points
    public static func mapPrecipitationSeries(
        _ forecast: AggregatedForecast,
        theme: VisualizationTheme = .default
    ) -> [PrecipitationDataPoint] {
        forecast.consensus.hourly.map { hourly in
            let amount = hourly.metrics.precipitation.rawValue
            let color = theme.colorForPrecipitation(amount)

            return PrecipitationDataPoint(
                timestamp: hourly.timestamp,
                amount: amount,
                probability: hourly.metrics.precipitationProbability,
                color: color
            )
        }
    }

    /// Convert daily forecasts to temperature heatmap
    public static func mapTemperatureHeatmap(
        _ forecast: AggregatedForecast,
        theme: VisualizationTheme = .default
    ) -> [[HeatmapCell]] {
        let calendar = Calendar.current
        var cells: [[HeatmapCell]] = []

        for (dayIndex, daily) in forecast.consensus.daily.enumerated() {
            var row: [HeatmapCell] = []

            // Hour columns (0-23)
            for hour in 0..<24 {
                // Find hourly forecast for this day/hour
                let targetDate = calendar.date(byAdding: .hour, value: hour, to: calendar.startOfDay(for: daily.date))!

                if let hourly = forecast.consensus.hourly.first(where: { hourlyForecast in
                    calendar.isDate(hourlyForecast.timestamp, equalTo: targetDate, toGranularity: .hour)
                }) {
                    let temp = hourly.metrics.temperature.rawValue
                    let color = theme.colorForTemperature(temp)
                    let label = String(format: "%.0f°", temp)

                    row.append(HeatmapCell(
                        row: dayIndex,
                        col: hour,
                        value: temp,
                        color: color,
                        label: label
                    ))
                } else {
                    // No data for this hour
                    row.append(HeatmapCell(
                        row: dayIndex,
                        col: hour,
                        value: 0,
                        color: theme.gridColor,
                        label: "-"
                    ))
                }
            }

            cells.append(row)
        }

        return cells
    }

    /// Convert model forecasts to constellation nodes and edges
    public static func mapModelConstellation(
        _ forecast: AggregatedForecast,
        theme: VisualizationTheme = .default,
        size: CGSize = CGSize(width: 300, height: 300)
    ) -> (nodes: [ModelNode], edges: [ModelEdge]) {
        let models = forecast.models
        var nodes: [ModelNode] = []
        var edges: [ModelEdge] = []

        // Position nodes in circle
        let radius = min(size.width, size.height) * 0.35
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let angleStep = (2 * Double.pi) / Double(models.count)

        for (index, model) in models.enumerated() {
            let angle = Double(index) * angleStep - (Double.pi / 2)
            let x = center.x + radius * cos(angle)
            let y = center.y + radius * sin(angle)

            // Check if model is outlier in first daily forecast
            let isOutlier = forecast.consensus.daily.first?.modelAgreement.outlierModels.contains(model) ?? false
            let color = isOutlier ? theme.outlierColor : theme.modelNodeColor

            nodes.append(ModelNode(
                model: model,
                position: CGPoint(x: x, y: y),
                isOutlier: isOutlier,
                color: color
            ))
        }

        // Create edges between models based on agreement
        for i in 0..<models.count {
            for j in (i+1)..<models.count {
                let model1 = models[i]
                let model2 = models[j]

                // Calculate agreement strength based on temperature difference
                if let daily = forecast.consensus.daily.first {
                    let temp1 = forecast.modelForecasts.first { $0.model == model1 }?.daily.first?.temperature.max.rawValue ?? 0
                    let temp2 = forecast.modelForecasts.first { $0.model == model2 }?.daily.first?.temperature.max.rawValue ?? 0

                    let diff = abs(temp1 - temp2)
                    let strength = max(0, 1 - (diff / 10.0)) // Normalize difference

                    edges.append(ModelEdge(
                        from: model1,
                        to: model2,
                        strength: strength,
                        color: theme.modelEdgeColor.opacity(strength)
                    ))
                }
            }
        }

        return (nodes, edges)
    }

    /// Convert confidence data to sparkline points
    public static func mapConfidenceSparkline(
        _ forecast: AggregatedForecast,
        theme: VisualizationTheme = .default
    ) -> [(date: Date, score: Double, color: Color)] {
        forecast.consensus.daily.map { daily in
            let score = daily.confidence.score
            let color = theme.colorForConfidence(daily.confidence.level)

            return (date: daily.date, score: score, color: color)
        }
    }
}
