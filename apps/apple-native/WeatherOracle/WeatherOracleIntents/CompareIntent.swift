import AppIntents
import Foundation
import SharedKit

// MARK: - Compare Models Intent

/// App Intent for comparing weather model predictions
public struct CompareIntent: AppIntent {
    public static var title: LocalizedStringResource = "Compare Weather Models"

    public static var description: IntentDescription? = IntentDescription(
        "Compare predictions from different weather models",
        categoryName: "Weather",
        searchKeywords: ["weather", "models", "compare", "forecast", "accuracy"]
    )

    // MARK: - Parameters

    @Parameter(title: "Location", description: "The location to compare forecasts for")
    public var location: LocationAppEntity?

    @Parameter(
        title: "Metric",
        description: "The weather metric to compare",
        default: .temperature
    )
    public var metric: ComparisonMetric

    public init() {
        self.metric = .temperature
    }

    public init(location: LocationAppEntity?, metric: ComparisonMetric = .temperature) {
        self.location = location
        self.metric = metric
    }

    // MARK: - Perform

    @MainActor
    public func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        // Get location from CloudSyncStore via shared instance
        let store = CloudSyncStore()
        let targetLocation: LocationAppEntity

        if let location = location {
            targetLocation = location
        } else {
            guard let firstLocation = store.locations.first else {
                return .result(
                    value: "No locations saved",
                    dialog: "You don't have any saved locations. Please add a location in the Weather Oracle app first."
                )
            }
            targetLocation = LocationAppEntity(from: firstLocation)
        }

        // Fetch forecasts from multiple models
        let client = OpenMeteoClient()
        let models: [ModelName] = [.ecmwf, .gfs, .icon, .meteofrance, .ukmo]

        do {
            let forecasts = try await client.fetchForecasts(
                models: models,
                coordinates: targetLocation.coordinates,
                forecastDays: 3,
                timezone: "auto"
            )

            // Aggregate for comparison
            let aggregated = try await AggregateService.aggregate(forecasts)

            // Build comparison based on selected metric
            let comparison = buildComparison(
                aggregated: aggregated,
                metric: metric,
                location: targetLocation.name
            )

            return .result(
                value: comparison.text,
                dialog: IntentDialog(stringLiteral: comparison.spoken)
            )

        } catch {
            return .result(
                value: "Error: \(error.localizedDescription)",
                dialog: "Sorry, I couldn't compare model forecasts for \(targetLocation.name). Please try again later."
            )
        }
    }

    // MARK: - Comparison Builder

    private func buildComparison(
        aggregated: AggregatedForecast,
        metric: ComparisonMetric,
        location: String
    ) -> (text: String, spoken: String) {
        guard let todayDaily = aggregated.consensus.daily.first else {
            return (
                text: "No forecast data available",
                spoken: "No forecast data available for \(location)"
            )
        }

        var text = "\(location) - Model Comparison for \(metric.displayName):\n\n"
        var spoken = "Comparing \(metric.displayName.lowercased()) forecasts for \(location). "

        switch metric {
        case .temperature:
            text += buildTemperatureComparison(aggregated: aggregated, todayDaily: todayDaily)
            spoken += buildTemperatureSpoken(aggregated: aggregated, todayDaily: todayDaily)

        case .precipitation:
            text += buildPrecipitationComparison(aggregated: aggregated, todayDaily: todayDaily)
            spoken += buildPrecipitationSpoken(aggregated: aggregated, todayDaily: todayDaily)

        case .wind:
            text += buildWindComparison(aggregated: aggregated, todayDaily: todayDaily)
            spoken += buildWindSpoken(aggregated: aggregated, todayDaily: todayDaily)
        }

        // Add model agreement info
        let consensus = todayDaily.modelAgreement
        let agreementPct = Int((consensus.agreementScore * 100).rounded())

        text += "\n\nModel Agreement: \(agreementPct)%"
        text += "\nModels in agreement: \(consensus.modelsInAgreement.count)/\(aggregated.models.count)"

        if !consensus.outlierModels.isEmpty {
            let outlierNames = consensus.outlierModels.map { formatModelName($0) }.joined(separator: ", ")
            text += "\nOutlier models: \(outlierNames)"
        }

        spoken += " Overall model agreement is \(agreementPct) percent."

        return (text: text, spoken: spoken)
    }

    private func buildTemperatureComparison(aggregated: AggregatedForecast, todayDaily: AggregatedDailyForecast) -> String {
        var result = ""

        // Consensus temperature
        let consensusMax = Int(todayDaily.forecast.temperature.max.rawValue.rounded())
        let consensusMin = Int(todayDaily.forecast.temperature.min.rawValue.rounded())

        result += "Consensus: High \(consensusMax)°C, Low \(consensusMin)°C\n"
        result += "Range: \(Int(todayDaily.range.temperatureMax.min.rounded()))°C to \(Int(todayDaily.range.temperatureMax.max.rounded()))°C\n\n"

        // Individual model predictions
        result += "Individual Models:\n"

        for modelForecast in aggregated.modelForecasts {
            if let daily = modelForecast.daily.first {
                let maxTemp = Int(daily.temperature.max.rawValue.rounded())
                let minTemp = Int(daily.temperature.min.rawValue.rounded())
                result += "• \(formatModelName(modelForecast.model)): \(maxTemp)°C / \(minTemp)°C\n"
            }
        }

        // Statistics
        let stats = todayDaily.modelAgreement.temperatureStats
        result += "\nSpread: ±\(String(format: "%.1f", stats.stdDev))°C"

        return result
    }

    private func buildTemperatureSpoken(aggregated: AggregatedForecast, todayDaily: AggregatedDailyForecast) -> String {
        let consensusMax = Int(todayDaily.forecast.temperature.max.rawValue.rounded())
        let consensusMin = Int(todayDaily.forecast.temperature.min.rawValue.rounded())
        let spread = Int(todayDaily.range.temperatureMax.max - todayDaily.range.temperatureMax.min)

        var spoken = "The consensus high is \(consensusMax) degrees, low is \(consensusMin) degrees. "

        if spread > 3 {
            spoken += "Models show a \(spread) degree spread, indicating some uncertainty. "
        } else {
            spoken += "Models are in close agreement. "
        }

        return spoken
    }

    private func buildPrecipitationComparison(aggregated: AggregatedForecast, todayDaily: AggregatedDailyForecast) -> String {
        var result = ""

        // Consensus precipitation
        let consensusPrecip = todayDaily.forecast.precipitation.total.rawValue
        let consensusProb = Int((todayDaily.forecast.precipitation.probability * 100).rounded())

        result += "Consensus: \(String(format: "%.1f", consensusPrecip))mm (\(consensusProb)% probability)\n"
        result += "Range: \(String(format: "%.1f", todayDaily.range.precipitation.min))mm to \(String(format: "%.1f", todayDaily.range.precipitation.max))mm\n\n"

        // Individual models
        result += "Individual Models:\n"

        for modelForecast in aggregated.modelForecasts {
            if let daily = modelForecast.daily.first {
                let precip = daily.precipitation.total.rawValue
                let prob = Int((daily.precipitation.probability * 100).rounded())
                result += "• \(formatModelName(modelForecast.model)): \(String(format: "%.1f", precip))mm (\(prob)%)\n"
            }
        }

        return result
    }

    private func buildPrecipitationSpoken(aggregated: AggregatedForecast, todayDaily: AggregatedDailyForecast) -> String {
        let consensusPrecip = todayDaily.forecast.precipitation.total.rawValue
        let consensusProb = Int((todayDaily.forecast.precipitation.probability * 100).rounded())

        if consensusPrecip < 0.5 {
            return "Little to no precipitation expected, with \(consensusProb) percent probability. "
        } else if consensusPrecip < 5 {
            return "Light precipitation of around \(Int(consensusPrecip.rounded())) millimeters expected, \(consensusProb) percent probability. "
        } else {
            return "Significant precipitation of \(Int(consensusPrecip.rounded())) millimeters expected, with \(consensusProb) percent probability. "
        }
    }

    private func buildWindComparison(aggregated: AggregatedForecast, todayDaily: AggregatedDailyForecast) -> String {
        var result = ""

        // Consensus wind
        let consensusMax = todayDaily.forecast.wind.maxSpeed.rawValue * 3.6 // Convert to km/h
        let consensusAvg = todayDaily.forecast.wind.avgSpeed.rawValue * 3.6

        result += "Consensus: Max \(Int(consensusMax.rounded())) km/h, Avg \(Int(consensusAvg.rounded())) km/h\n\n"

        // Individual models
        result += "Individual Models:\n"

        for modelForecast in aggregated.modelForecasts {
            if let daily = modelForecast.daily.first {
                let maxWind = daily.wind.maxSpeed.rawValue * 3.6
                result += "• \(formatModelName(modelForecast.model)): Max \(Int(maxWind.rounded())) km/h\n"
            }
        }

        return result
    }

    private func buildWindSpoken(aggregated: AggregatedForecast, todayDaily: AggregatedDailyForecast) -> String {
        let consensusMax = Int((todayDaily.forecast.wind.maxSpeed.rawValue * 3.6).rounded())

        if consensusMax < 20 {
            return "Light winds expected, with maximum speeds around \(consensusMax) kilometers per hour. "
        } else if consensusMax < 40 {
            return "Moderate winds expected, with gusts up to \(consensusMax) kilometers per hour. "
        } else {
            return "Strong winds expected, with gusts reaching \(consensusMax) kilometers per hour. "
        }
    }

    private func formatModelName(_ model: ModelName) -> String {
        switch model {
        case .ecmwf: return "ECMWF"
        case .gfs: return "GFS"
        case .icon: return "ICON"
        case .meteofrance: return "ARPEGE"
        case .ukmo: return "UK Met"
        case .jma: return "JMA"
        case .gem: return "GEM"
        }
    }
}

// MARK: - Comparison Metric Enum

public enum ComparisonMetric: String, AppEnum {
    case temperature
    case precipitation
    case wind

    public static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(name: "Weather Metric")
    }

    public static var caseDisplayRepresentations: [ComparisonMetric: DisplayRepresentation] {
        [
            .temperature: DisplayRepresentation(
                title: "Temperature",
                subtitle: "Compare temperature forecasts",
                image: DisplayRepresentation.Image(systemName: "thermometer")
            ),
            .precipitation: DisplayRepresentation(
                title: "Precipitation",
                subtitle: "Compare rain and snow predictions",
                image: DisplayRepresentation.Image(systemName: "cloud.rain")
            ),
            .wind: DisplayRepresentation(
                title: "Wind",
                subtitle: "Compare wind speed forecasts",
                image: DisplayRepresentation.Image(systemName: "wind")
            )
        ]
    }

    public var displayName: String {
        switch self {
        case .temperature: return "Temperature"
        case .precipitation: return "Precipitation"
        case .wind: return "Wind"
        }
    }
}
