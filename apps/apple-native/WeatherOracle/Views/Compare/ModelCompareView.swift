import SwiftUI
import SharedKit

// MARK: - Model Compare View

/// Renders model comparison with divergence highlighting and spread metrics
public struct ModelCompareView: View {
    let forecast: AggregatedForecast
    let viewModel: ForecastDetailViewModel

    @State private var selectedMetric: ComparisonMetric = .temperature
    @State private var selectedTimeframe: ComparisonTimeframe = .current

    public init(forecast: AggregatedForecast, viewModel: ForecastDetailViewModel) {
        self.forecast = forecast
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 16) {
            // Metric and timeframe picker
            controlBar

            // Model constellation visualization
            if let chartSeries = viewModel.chartSeries {
                ModelConstellationView(
                    nodes: chartSeries.modelNodes,
                    edges: chartSeries.modelEdges,
                    size: CGSize(width: 280, height: 280),
                    showLabels: true
                )
                .padding(.vertical, 8)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Model constellation diagram")
                .accessibilityValue(constellationAccessibilityValue())
                .accessibilityHint("Visual network showing how closely different weather models agree. Models connected by lines share similar predictions. Isolated models represent outliers.")
            }

            Divider()

            // Model comparison list with divergence
            modelComparisonList
        }
    }

    // MARK: - Control Bar

    private var controlBar: some View {
        VStack(spacing: 12) {
            // Metric selector
            Picker("Metric", selection: $selectedMetric) {
                ForEach(ComparisonMetric.allCases, id: \.self) { metric in
                    Text(metric.displayName)
                        .tag(metric)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Select comparison metric")
            .accessibilityValue(selectedMetric.displayName)
            .accessibilityHint("Choose the weather metric to compare across models: Temperature (Celsius), Precipitation (millimeters), or Wind Speed (meters per second)")

            // Timeframe selector
            Picker("Timeframe", selection: $selectedTimeframe) {
                ForEach(ComparisonTimeframe.allCases, id: \.self) { timeframe in
                    Text(timeframe.displayName)
                        .tag(timeframe)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Select forecast timeframe")
            .accessibilityValue(selectedTimeframe.displayName)
            .accessibilityHint("Choose the time period: Now (current conditions), 6h (in 6 hours), 12h (in 12 hours), or Tomorrow (tomorrow's conditions)")
        }
    }

    // MARK: - Model Comparison List

    private var modelComparisonList: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Spread metrics header
            spreadMetricsHeader

            Divider()

            // Model rows
            ForEach(forecast.models, id: \.self) { model in
                modelRow(for: model)

                if model != forecast.models.last {
                    Divider()
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: - Spread Metrics Header

    private var spreadMetricsHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Model Spread")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .accessibilityAddTraits(.isHeader)

                Spacer()

                // Agreement score
                let agreement = currentAgreement
                HStack(spacing: 4) {
                    Image(systemName: agreement.score > 0.7 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(agreement.score > 0.7 ? .green : .orange)
                        .accessibilityHidden(true)

                    Text("\(Int(agreement.score * 100))% agreement")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Model agreement: \(Int(agreement.score * 100))%")
                .accessibilityValue("\(Int(agreement.score * 100))% of models agree on this forecast")
                .accessibilityHint(agreement.score > 0.7 ? "High confidence: Models are in close agreement" : "Lower confidence: Models show some divergence")
            }

            // Statistics
            if let stats = currentStatistics {
                HStack(spacing: 16) {
                    statCell(label: "Mean", value: formatValue(stats.mean), semanticValue: stats.mean)
                    statCell(label: "Range", value: formatValue(stats.range), semanticValue: stats.range)
                    statCell(label: "Std Dev", value: formatValue(stats.stdDev), semanticValue: stats.stdDev)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Spread statistics")
                .accessibilityValue("Mean: \(formatValue(stats.mean)), Range: \(formatValue(stats.range)), Standard deviation: \(formatValue(stats.stdDev))")
                .accessibilityHint("Statistical metrics showing model divergence. Higher values indicate greater disagreement between models.")
            }
        }
    }

    private func statCell(label: String, value: String, semanticValue: Double? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)

            Text(value)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(metricAccessibilityLabel(label))
        .accessibilityValue(value)
        .accessibilityHint(metricAccessibilityHint(label, semanticValue: semanticValue))
    }

    private func metricAccessibilityLabel(_ metric: String) -> String {
        switch metric {
        case "Mean":
            return "Mean value across all models"
        case "Range":
            return "Range of predictions"
        case "Std Dev":
            return "Standard deviation showing spread"
        default:
            return metric
        }
    }

    private func metricAccessibilityHint(_ metric: String, semanticValue: Double?) -> String {
        let valueDescription: String
        if let value = semanticValue {
            valueDescription = String(format: "Value: %.1f. ", value)
        } else {
            valueDescription = ""
        }

        switch metric {
        case "Mean":
            return "\(valueDescription)Average prediction from all models."
        case "Range":
            return "\(valueDescription)Difference between highest and lowest predictions."
        case "Std Dev":
            return "\(valueDescription)Measure of how much predictions deviate from the mean. Higher values indicate greater disagreement."
        default:
            return ""
        }
    }

    // MARK: - Model Row

    private func modelRow(for model: ModelName) -> some View {
        HStack(spacing: 12) {
            // Model indicator with color
            Circle()
                .fill(VisualizationTheme.colorForModel(model))
                .frame(width: 12, height: 12)
                .accessibilityHidden(true)

            // Model name
            Text(modelDisplayName(model))
                .font(.subheadline)
                .fontWeight(.medium)
                .accessibilityLabel("\(modelDisplayName(model)) model")

            Spacer()

            // Divergence indicator
            if isOutlier(model) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .accessibilityHidden(true)
            }

            // Value with deviation indicator
            if let value = modelValue(for: model) {
                HStack(spacing: 4) {
                    Text(formatValue(value))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(isOutlier(model) ? .orange : .primary)
                        .accessibilityLabel("Predicted value")
                        .accessibilityValue(formatValue(value))

                    if let deviation = calculateDeviation(value: value) {
                        deviationIndicator(deviation)
                            .accessibilityHidden(true)
                    }
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(modelRowAccessibilityLabel(model))
        .accessibilityValue(modelRowAccessibilityValue(model))
        .accessibilityHint(modelRowAccessibilityHint(model))
    }

    private func modelRowAccessibilityLabel(_ model: ModelName) -> String {
        return "\(modelDisplayName(model)) forecast"
    }

    private func modelRowAccessibilityValue(_ model: ModelName) -> String {
        guard let value = modelValue(for: model) else {
            return "No data available"
        }

        var valueString = formatValue(value)

        if let stats = currentStatistics {
            let deviation = value - stats.mean
            if abs(deviation) > 0.1 {
                let direction = deviation > 0 ? "above" : "below"
                valueString += ", \(String(format: "%.1f", abs(deviation))) \(direction) average"
            }
        }

        return valueString
    }

    private func modelRowAccessibilityHint(_ model: ModelName) -> String {
        guard isOutlier(model) else {
            return "Prediction from \(modelDisplayName(model)) weather model"
        }

        if let value = modelValue(for: model), let stats = currentStatistics {
            let deviation = value - stats.mean
            let metric = selectedMetric.displayName.lowercased()
            let deviationAmount = String(format: "%.1f", abs(deviation))
            let direction = deviation > 0 ? "above" : "below"

            return "Warning: \(deviationAmount) \(metric) \(direction) the average. This model predicts significantly different conditions than other models."
        }

        return "This model shows divergence from others."
    }

    private func deviationIndicator(_ deviation: Double) -> some View {
        HStack(spacing: 2) {
            Image(systemName: deviation > 0 ? "arrow.up" : "arrow.down")
                .font(.caption2)

            Text(String(format: "%.1f", abs(deviation)))
                .font(.caption2)
        }
        .foregroundStyle(abs(deviation) > 2 ? .red : .secondary)
    }

    // MARK: - Helper Methods

    private func constellationAccessibilityValue() -> String {
        let agreement = currentAgreement
        let agreementPercent = Int(agreement.score * 100)
        let agreementCount = agreement.modelsInAgreement.count
        let outlierCount = agreement.outlierModels.count

        var description = "\(agreementPercent)% agreement. "
        description += "\(agreementCount) model\(agreementCount == 1 ? "" : "s") agree, "
        description += "\(outlierCount) model\(outlierCount == 1 ? "" : "s") show divergence."

        return description
    }

    private var currentAgreement: ModelConsensus {
        switch selectedTimeframe {
        case .current:
            return viewModel.currentConditions?.modelAgreement ?? defaultConsensus
        case .next6Hours:
            return viewModel.hourlyForecast(at: 6)?.modelAgreement ?? defaultConsensus
        case .next12Hours:
            return viewModel.hourlyForecast(at: 12)?.modelAgreement ?? defaultConsensus
        case .tomorrow:
            return viewModel.dailyForecast(at: 1)?.modelAgreement ?? defaultConsensus
        }
    }

    private var currentStatistics: MetricStatistics? {
        let consensus = currentAgreement

        switch selectedMetric {
        case .temperature:
            return consensus.temperatureStats
        case .precipitation:
            return consensus.precipitationStats
        case .wind:
            return consensus.windStats
        }
    }

    private func isOutlier(_ model: ModelName) -> Bool {
        currentAgreement.outlierModels.contains(model)
    }

    private func modelValue(for model: ModelName) -> Double? {
        guard let modelForecast = viewModel.modelForecast(for: model) else {
            return nil
        }

        switch selectedTimeframe {
        case .current:
            return metricValue(from: modelForecast.hourly.first)
        case .next6Hours:
            return metricValue(from: modelForecast.hourly.dropFirst(6).first)
        case .next12Hours:
            return metricValue(from: modelForecast.hourly.dropFirst(12).first)
        case .tomorrow:
            return metricValue(from: modelForecast.daily.dropFirst(1).first)
        }
    }

    private func metricValue(from hourly: HourlyForecast?) -> Double? {
        guard let hourly = hourly else { return nil }

        switch selectedMetric {
        case .temperature:
            return hourly.temperature.rawValue
        case .precipitation:
            return hourly.precipitation.rawValue
        case .wind:
            return hourly.windSpeed.rawValue
        }
    }

    private func metricValue(from daily: DailyForecast?) -> Double? {
        guard let daily = daily else { return nil }

        switch selectedMetric {
        case .temperature:
            return (daily.temperature.min.rawValue + daily.temperature.max.rawValue) / 2
        case .precipitation:
            return daily.precipitation.total.rawValue
        case .wind:
            return daily.wind.avgSpeed.rawValue
        }
    }

    private func calculateDeviation(value: Double) -> Double? {
        guard let stats = currentStatistics else { return nil }
        return value - stats.mean
    }

    private func formatValue(_ value: Double) -> String {
        switch selectedMetric {
        case .temperature:
            return String(format: "%.1f°", value)
        case .precipitation:
            return String(format: "%.1f mm", value)
        case .wind:
            return String(format: "%.1f m/s", value)
        }
    }

    private func modelDisplayName(_ model: ModelName) -> String {
        switch model {
        case .ecmwf: return "ECMWF"
        case .gfs: return "GFS"
        case .icon: return "ICON"
        case .meteofrance: return "Météo-France"
        case .ukmo: return "UK Met Office"
        case .jma: return "JMA"
        case .gem: return "GEM"
        }
    }

    private var defaultConsensus: ModelConsensus {
        ModelConsensus(
            agreementScore: 0,
            modelsInAgreement: [],
            outlierModels: [],
            temperatureStats: MetricStatistics(mean: 0, median: 0, min: 0, max: 0, stdDev: 0, range: 0),
            precipitationStats: MetricStatistics(mean: 0, median: 0, min: 0, max: 0, stdDev: 0, range: 0),
            windStats: MetricStatistics(mean: 0, median: 0, min: 0, max: 0, stdDev: 0, range: 0)
        )
    }
}

// MARK: - Comparison Metric

public enum ComparisonMetric: String, CaseIterable {
    case temperature
    case precipitation
    case wind

    var displayName: String {
        switch self {
        case .temperature: return "Temp"
        case .precipitation: return "Rain"
        case .wind: return "Wind"
        }
    }
}

// MARK: - Comparison Timeframe

public enum ComparisonTimeframe: String, CaseIterable {
    case current
    case next6Hours
    case next12Hours
    case tomorrow

    var displayName: String {
        switch self {
        case .current: return "Now"
        case .next6Hours: return "6h"
        case .next12Hours: return "12h"
        case .tomorrow: return "Tomorrow"
        }
    }
}

// MARK: - Preview

#Preview {
    let coords = try! Coordinates.validated(lat: 40.7128, lon: -74.0060)
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

    // Create mock forecast
    let now = Date()
    let hourly = (0..<24).map { hour -> AggregatedHourlyForecast in
        let timestamp = now.addingTimeInterval(Double(hour) * 3600)
        let metrics = WeatherMetrics(
            temperature: Celsius(rawValue: 15 + Double(hour % 10)),
            feelsLike: Celsius(rawValue: 13 + Double(hour % 10)),
            humidity: Humidity(rawValue: 65)!,
            pressure: Pressure(rawValue: 1013)!,
            windSpeed: MetersPerSecond(rawValue: 5)!,
            windDirection: WindDirection(rawValue: 180),
            precipitation: Millimeters.clamped(0),
            precipitationProbability: 0.2,
            cloudCover: CloudCover(rawValue: 50)!,
            visibility: Visibility(rawValue: 10000)!,
            uvIndex: UVIndex(rawValue: 5)!,
            weatherCode: .clearSky
        )
        let consensus = ModelConsensus(
            agreementScore: 0.85,
            modelsInAgreement: [.ecmwf, .gfs, .icon],
            outlierModels: [.meteofrance],
            temperatureStats: MetricStatistics(mean: 15, median: 15, min: 13, max: 17, stdDev: 1.5, range: 4),
            precipitationStats: MetricStatistics(mean: 0, median: 0, min: 0, max: 0, stdDev: 0, range: 0),
            windStats: MetricStatistics(mean: 5, median: 5, min: 4, max: 6, stdDev: 0.5, range: 2)
        )
        let range = HourlyRange(
            temperature: MetricRange(min: 13, max: 17),
            precipitation: MetricRange(min: 0, max: 0),
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

    let forecast = AggregatedForecast(
        coordinates: coords,
        generatedAt: now,
        validFrom: now,
        validTo: now.addingTimeInterval(7 * 24 * 3600),
        models: [.ecmwf, .gfs, .icon, .meteofrance],
        modelForecasts: [],
        consensus: ForecastConsensus(hourly: hourly, daily: []),
        modelWeights: [],
        overallConfidence: ConfidenceLevel(level: .high, score: 0.85)
    )

    let viewModel = ForecastDetailViewModel(location: location)

    return ScrollView {
        ModelCompareView(forecast: forecast, viewModel: viewModel)
            .padding()
    }
}
