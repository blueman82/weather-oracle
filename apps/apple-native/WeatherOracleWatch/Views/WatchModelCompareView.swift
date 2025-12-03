import SwiftUI
import SharedKit

// MARK: - Watch Model Compare View

/// Simplified model comparison view for watchOS
public struct WatchModelCompareView: View {
    @Bindable var viewModel: WatchLocationViewModel
    let location: LocationEntity

    public init(viewModel: WatchLocationViewModel, location: LocationEntity) {
        self.viewModel = viewModel
        self.location = location
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let forecast = viewModel.forecast {
                    compareContent(forecast)
                } else {
                    Text("No data")
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("No comparison data available")
                }
            }
            .padding()
        }
        .navigationTitle("Model Compare")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityLabel("Model comparison view")
        .accessibilityHint("Use Digital Crown to scroll through model comparisons")
    }

    // MARK: - Compare Content

    private func compareContent(_ forecast: AggregatedForecast) -> some View {
        VStack(spacing: 16) {
            // Model count
            Text("\(forecast.models.count) Models")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityLabel("Number of models")
                .accessibilityValue("\(forecast.models.count) models")

            // Current temperature comparison
            if let current = forecast.consensus.hourly.first {
                temperatureComparisonCard(forecast, hourly: current)
            }

            Divider()
                .accessibilityHidden(true)

            // Today's precipitation comparison
            if let today = forecast.consensus.daily.first {
                precipitationComparisonCard(forecast, daily: today)
            }

            Divider()
                .accessibilityHidden(true)

            // Model list with confidence
            modelListSection(forecast)
        }
    }

    // MARK: - Temperature Comparison

    private func temperatureComparisonCard(_ forecast: AggregatedForecast, hourly: AggregatedHourlyForecast) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Current Temperature")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityLabel("Current temperature comparison")

            // Consensus
            HStack {
                Text("Consensus")
                    .font(.caption)
                    .accessibilityHidden(true)
                Spacer()
                    .accessibilityHidden(true)
                Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                    .font(.title3)
                    .fontWeight(.bold)
                    .accessibilityLabel("Consensus temperature")
                    .accessibilityValue("\(Int(hourly.metrics.temperature.rawValue.rounded())) degrees")
            }
            .accessibilityElement(children: .combine)

            // Range
            HStack {
                Text("Range")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                Spacer()
                    .accessibilityHidden(true)
                Text("\(Int(hourly.range.temperature.min.rounded()))° - \(Int(hourly.range.temperature.max.rounded()))°")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Temperature range")
                    .accessibilityValue("Low: \(Int(hourly.range.temperature.min.rounded())) degrees, High: \(Int(hourly.range.temperature.max.rounded())) degrees")
            }
            .accessibilityElement(children: .combine)

            // Confidence indicator
            HStack {
                Text("Confidence")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                Spacer()
                    .accessibilityHidden(true)
                confidenceBadge(hourly.confidence)
            }
            .accessibilityElement(children: .combine)
        }
        .padding()
        .background(Color.gray.opacity(0.2))
        .cornerRadius(8)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Precipitation Comparison

    private func precipitationComparisonCard(_ forecast: AggregatedForecast, daily: AggregatedDailyForecast) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Today's Precipitation")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityLabel("Today's precipitation comparison")

            // Consensus
            HStack {
                Text("Consensus")
                    .font(.caption)
                    .accessibilityHidden(true)
                Spacer()
                    .accessibilityHidden(true)
                Text("\(String(format: "%.1f", daily.forecast.precipitation.total.rawValue))mm")
                    .font(.title3)
                    .fontWeight(.bold)
                    .accessibilityLabel("Consensus precipitation")
                    .accessibilityValue("\(String(format: "%.1f", daily.forecast.precipitation.total.rawValue)) millimeters")
            }
            .accessibilityElement(children: .combine)

            // Probability
            HStack {
                Text("Probability")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                Spacer()
                    .accessibilityHidden(true)
                Text("\(Int((daily.forecast.precipitation.probability * 100).rounded()))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Precipitation probability")
                    .accessibilityValue("\(Int((daily.forecast.precipitation.probability * 100).rounded())) percent")
            }
            .accessibilityElement(children: .combine)

            // Range
            HStack {
                Text("Range")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                Spacer()
                    .accessibilityHidden(true)
                Text("\(String(format: "%.1f", daily.range.precipitation.min))mm - \(String(format: "%.1f", daily.range.precipitation.max))mm")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Precipitation range")
                    .accessibilityValue("Low: \(String(format: "%.1f", daily.range.precipitation.min)) millimeters, High: \(String(format: "%.1f", daily.range.precipitation.max)) millimeters")
            }
            .accessibilityElement(children: .combine)
        }
        .padding()
        .background(Color.gray.opacity(0.2))
        .cornerRadius(8)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Model List

    private func modelListSection(_ forecast: AggregatedForecast) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Models")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityLabel("Weather model list")

            VStack(spacing: 8) {
                ForEach(forecast.models, id: \.self) { model in
                    modelRow(model, forecast: forecast)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    private func modelRow(_ model: ModelName, forecast: AggregatedForecast) -> some View {
        HStack {
            // Model name
            Text(formatModelName(model))
                .font(.caption)
                .accessibilityLabel("Weather model")
                .accessibilityValue(formatModelName(model))

            Spacer()
                .accessibilityHidden(true)

            // Temperature from this model
            if let modelForecast = forecast.modelForecasts.first(where: { $0.model == model }),
               let temp = modelForecast.hourly.first?.metrics.temperature {
                Text("\(Int(temp.rawValue.rounded()))°")
                    .font(.caption)
                    .fontWeight(.medium)
                    .accessibilityLabel("Temperature")
                    .accessibilityValue("\(Int(temp.rawValue.rounded())) degrees")
            }

            // Agreement indicator
            if let hourly = forecast.consensus.hourly.first {
                if hourly.modelAgreement.modelsInAgreement.contains(model) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                        .accessibilityLabel("Agreement status")
                        .accessibilityValue("Agrees with consensus")
                } else {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                        .accessibilityLabel("Agreement status")
                        .accessibilityValue("Disagrees with consensus")
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Helpers

    private func confidenceBadge(_ confidence: ConfidenceLevel) -> some View {
        Text(confidence.level.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(confidenceColor(confidence.level))
            .cornerRadius(4)
            .accessibilityLabel("Confidence level")
            .accessibilityValue(confidence.level.rawValue.capitalized)
    }

    private func confidenceColor(_ level: ConfidenceLevelName) -> Color {
        switch level {
        case .high: return .green
        case .medium: return .orange
        case .low: return .red
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
