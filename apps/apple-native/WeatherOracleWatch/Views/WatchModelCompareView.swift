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
                }
            }
            .padding()
        }
        .navigationTitle("Model Compare")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Compare Content

    private func compareContent(_ forecast: AggregatedForecast) -> some View {
        VStack(spacing: 16) {
            // Model count
            Text("\(forecast.models.count) Models")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            // Current temperature comparison
            if let current = forecast.consensus.hourly.first {
                temperatureComparisonCard(forecast, hourly: current)
            }

            Divider()

            // Today's precipitation comparison
            if let today = forecast.consensus.daily.first {
                precipitationComparisonCard(forecast, daily: today)
            }

            Divider()

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

            // Consensus
            HStack {
                Text("Consensus")
                    .font(.caption)
                Spacer()
                Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                    .font(.title3)
                    .fontWeight(.bold)
            }

            // Range
            HStack {
                Text("Range")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(Int(hourly.range.temperature.min.rounded()))° - \(Int(hourly.range.temperature.max.rounded()))°")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Confidence indicator
            HStack {
                Text("Confidence")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                confidenceBadge(hourly.confidence)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }

    // MARK: - Precipitation Comparison

    private func precipitationComparisonCard(_ forecast: AggregatedForecast, daily: AggregatedDailyForecast) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Today's Precipitation")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            // Consensus
            HStack {
                Text("Consensus")
                    .font(.caption)
                Spacer()
                Text("\(String(format: "%.1f", daily.forecast.precipitation.total.rawValue))mm")
                    .font(.title3)
                    .fontWeight(.bold)
            }

            // Probability
            HStack {
                Text("Probability")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(Int((daily.forecast.precipitation.probability * 100).rounded()))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Range
            HStack {
                Text("Range")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(String(format: "%.1f", daily.range.precipitation.min))mm - \(String(format: "%.1f", daily.range.precipitation.max))mm")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }

    // MARK: - Model List

    private func modelListSection(_ forecast: AggregatedForecast) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Models")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            VStack(spacing: 8) {
                ForEach(forecast.models, id: \.self) { model in
                    modelRow(model, forecast: forecast)
                }
            }
        }
    }

    private func modelRow(_ model: ModelName, forecast: AggregatedForecast) -> some View {
        HStack {
            // Model name
            Text(formatModelName(model))
                .font(.caption)

            Spacer()

            // Temperature from this model
            if let modelForecast = forecast.modelForecasts.first(where: { $0.model == model }),
               let temp = modelForecast.hourly.first?.metrics.temperature {
                Text("\(Int(temp.rawValue.rounded()))°")
                    .font(.caption)
                    .fontWeight(.medium)
            }

            // Agreement indicator
            if let hourly = forecast.consensus.hourly.first {
                if hourly.modelAgreement.modelsInAgreement.contains(model) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                } else {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
        }
        .padding(.vertical, 4)
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
