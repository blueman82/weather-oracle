import SwiftUI
import SharedKit

// MARK: - Forecast Detail View

/// Detail view with stacked modules, compare carousel, and narrative panel
public struct ForecastDetailView: View {
    @Bindable var viewModel: ForecastDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @Namespace private var animation

    public init(viewModel: ForecastDetailViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if viewModel.isLoading {
                    loadingView
                } else if let error = viewModel.error {
                    errorView(error)
                } else if let forecast = viewModel.forecast {
                    forecastContent(forecast)
                } else {
                    emptyView
                }
            }
            .padding()
        }
        .refreshable {
            await viewModel.refresh()
            // Haptic feedback on refresh
            #if os(iOS)
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            #endif
        }
        .accessibilityAction(named: "Refresh") {
            Task {
                await viewModel.refresh()
            }
        }
        .navigationTitle(viewModel.location.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .symbolRenderingMode(.hierarchical)
                }
                .accessibilityLabel("Close")
                .accessibilityHint("Dismiss forecast detail and return to location list")
            }

            ToolbarItem(placement: .primaryAction) {
                if let updated = viewModel.lastUpdated {
                    Text(updated, style: .time)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Last updated at \(updated.formatted(date: .omitted, time: .shortened))")
                }
            }
        }
        .task {
            if viewModel.forecast == nil {
                await viewModel.fetchForecast()
            }
        }
    }

    // MARK: - Loading State

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
                .accessibilityLabel("Loading")

            Text("Loading forecast...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 100)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Loading forecast data")
    }

    // MARK: - Error State

    private func errorView(_ error: Error) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.orange)
                .accessibilityHidden(true)

            Text("Failed to Load Forecast")
                .font(.title2)
                .fontWeight(.semibold)
                .accessibilityAddTraits(.isHeader)

            Text(error.localizedDescription)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
                .accessibilityLabel("Error details: \(error.localizedDescription)")

            Button {
                Task {
                    await viewModel.refresh()
                }
            } label: {
                Label("Try Again", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
            .accessibilityLabel("Try again")
            .accessibilityHint("Attempt to reload forecast data for this location")
        }
        .padding(.vertical, 60)
        .accessibilityElement(children: .contain)
    }

    // MARK: - Empty State

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "cloud.slash")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            Text("No Forecast Available")
                .font(.title2)
                .fontWeight(.semibold)
                .accessibilityAddTraits(.isHeader)

            Button {
                Task {
                    await viewModel.fetchForecast()
                }
            } label: {
                Label("Load Forecast", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.bordered)
            .accessibilityLabel("Load forecast")
            .accessibilityHint("Fetch forecast data for this location")
        }
        .padding(.vertical, 60)
        .accessibilityElement(children: .contain)
    }

    // MARK: - Forecast Content

    @ViewBuilder
    private func forecastContent(_ forecast: AggregatedForecast) -> some View {
        // Current conditions module
        if let current = viewModel.currentConditions {
            currentConditionsModule(current)
                .matchedGeometryEffect(id: "currentConditions", in: animation)
        }

        // Narrative panel module
        if let narrative = viewModel.narrative {
            narrativeModule(narrative)
                .matchedGeometryEffect(id: "narrative", in: animation)
        }

        // Hourly forecast module
        if !viewModel.next24Hours.isEmpty {
            hourlyModule(viewModel.next24Hours)
                .matchedGeometryEffect(id: "hourly", in: animation)
        }

        // Daily forecast module
        if !viewModel.next7Days.isEmpty {
            dailyModule(viewModel.next7Days)
                .matchedGeometryEffect(id: "daily", in: animation)
        }

        // Model comparison module
        if !viewModel.modelForecasts.isEmpty {
            compareModule(viewModel.modelForecasts, forecast: forecast)
                .matchedGeometryEffect(id: "compare", in: animation)
        }
    }

    // MARK: - Current Conditions Module

    private func currentConditionsModule(_ current: AggregatedHourlyForecast) -> some View {
        VStack(spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(Int(current.metrics.temperature.rawValue.rounded()))°")
                        .font(.system(size: 72, weight: .thin))
                        .accessibilityLabel("Temperature")
                        .accessibilityValue("\(Int(current.metrics.temperature.rawValue.rounded())) degrees Celsius")

                    Text(weatherDescription(current.metrics.weatherCode))
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Weather conditions")
                        .accessibilityValue(weatherDescription(current.metrics.weatherCode))

                    // Feels like
                    Text("Feels like \(Int(current.metrics.feelsLike.rawValue.rounded()))°")
                        .font(.subheadline)
                        .foregroundStyle(.tertiary)
                        .accessibilityLabel("Feels like temperature")
                        .accessibilityValue("\(Int(current.metrics.feelsLike.rawValue.rounded())) degrees Celsius")
                }

                Spacer()

                // Weather icon
                Image(systemName: weatherIcon(current.metrics.weatherCode))
                    .font(.system(size: 64))
                    .symbolRenderingMode(.multicolor)
                    .accessibilityLabel("\(weatherDescription(current.metrics.weatherCode)) weather icon")
            }
            .accessibilityElement(children: .combine)

            Divider()

            // Additional metrics grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                metricCell(
                    icon: "humidity",
                    label: "Humidity",
                    value: "\(current.metrics.humidity.rawValue)%"
                )

                metricCell(
                    icon: "wind",
                    label: "Wind Speed",
                    value: String(format: "%.1f m/s", current.metrics.windSpeed.rawValue)
                )

                metricCell(
                    icon: "barometer",
                    label: "Pressure",
                    value: String(format: "%.0f hPa", current.metrics.pressure.rawValue)
                )

                metricCell(
                    icon: "drop",
                    label: "Precipitation",
                    value: String(format: "%.1f mm", current.metrics.precipitation.rawValue)
                )

                metricCell(
                    icon: "eye",
                    label: "Visibility",
                    value: String(format: "%.1f km", current.metrics.visibility.rawValue / 1000)
                )

                metricCell(
                    icon: "sun.max",
                    label: "UV Index",
                    value: "\(Int(current.metrics.uvIndex.rawValue))"
                )
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Current weather conditions")
        .accessibilityValue("Temperature \(Int(current.metrics.temperature.rawValue.rounded())) degrees, \(weatherDescription(current.metrics.weatherCode))")
    }

    private func metricCell(icon: String, label: String, value: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            Text(label)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)

            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
        .accessibilityValue(value)
    }

    // MARK: - Narrative Module

    private func narrativeModule(_ narrative: NarrativeSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Forecast Summary", systemImage: "text.quote")
                .font(.headline)
                .foregroundStyle(.primary)
                .accessibilityAddTraits(.isHeader)

            VStack(alignment: .leading, spacing: 8) {
                Text(narrative.headline)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .accessibilityLabel("Summary headline")
                    .accessibilityValue(narrative.headline)

                if !narrative.body.isEmpty {
                    Text(narrative.body)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Summary details")
                        .accessibilityValue(narrative.body)
                }
            }

            // Alerts
            if !narrative.alerts.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Alerts")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.orange)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityHidden(true)

                    ForEach(narrative.alerts, id: \.self) { alert in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption)
                                .foregroundStyle(.orange)
                                .accessibilityHidden(true)

                            Text(alert)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.1))
                        .cornerRadius(8)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Weather alert")
                        .accessibilityValue(alert)
                    }
                }
            }

            // Model notes
            if !narrative.modelNotes.isEmpty {
                Divider()

                VStack(alignment: .leading, spacing: 6) {
                    Text("Model Differences")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                        .accessibilityAddTraits(.isHeader)

                    ForEach(narrative.modelNotes, id: \.self) { note in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: "circle.fill")
                                .font(.system(size: 4))
                                .foregroundStyle(.tertiary)
                                .padding(.top, 6)
                                .accessibilityHidden(true)

                            Text(note)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Model difference")
                        .accessibilityValue(note)
                    }
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Forecast summary and narrative")
    }

    // MARK: - Hourly Module

    private func hourlyModule(_ hourly: [AggregatedHourlyForecast]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Hourly Forecast", systemImage: "clock")
                .font(.headline)
                .foregroundStyle(.primary)
                .accessibilityAddTraits(.isHeader)

            // Temperature heatmap
            if let chartSeries = viewModel.chartSeries {
                GradientHeatmapView(
                    data: Array(chartSeries.temperatureData.prefix(24)),
                    height: 60,
                    showLabels: true
                )
                .accessibilityLabel("Temperature heatmap for next 24 hours")
                .accessibilityValue("Temperature range from \(String(format: "%.0f", chartSeries.temperatureData.prefix(24).min() ?? 0)) to \(String(format: "%.0f", chartSeries.temperatureData.prefix(24).max() ?? 0)) degrees")
                .accessibilityHint("Visual representation of temperature changes throughout the day")
            }

            Divider()

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(hourly.prefix(24)) { hour in
                        hourlyCell(hour)
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Next 24 hours hourly forecast")
                .accessibilityHint("Scroll horizontally to view more hourly forecasts")
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Hourly forecast for next 24 hours")
    }

    private func hourlyCell(_ hourly: AggregatedHourlyForecast) -> some View {
        VStack(spacing: 8) {
            Text(hourly.timestamp, style: .time)
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            Image(systemName: weatherIcon(hourly.metrics.weatherCode))
                .font(.title2)
                .symbolRenderingMode(.multicolor)
                .accessibilityLabel("\(weatherDescription(hourly.metrics.weatherCode)) weather")

            Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                .font(.subheadline)
                .fontWeight(.semibold)
                .accessibilityHidden(true)

            // Confidence indicator
            Circle()
                .fill(confidenceColor(hourly.confidence.level))
                .frame(width: 6, height: 6)
                .accessibilityLabel("Confidence: \(hourly.confidence.level.rawValue)")
                .accessibilityValue(colorDescription(hourly.confidence.level))
        }
        .frame(width: 60)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Hour at \(hourly.timestamp.formatted(date: .omitted, time: .shortened))")
        .accessibilityValue("Temperature \(Int(hourly.metrics.temperature.rawValue.rounded())) degrees, \(weatherDescription(hourly.metrics.weatherCode)), \(hourly.confidence.level.rawValue) confidence")
    }

    // MARK: - Daily Module

    private func dailyModule(_ daily: [AggregatedDailyForecast]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("7-Day Forecast", systemImage: "calendar")
                .font(.headline)
                .foregroundStyle(.primary)
                .accessibilityAddTraits(.isHeader)

            VStack(spacing: 12) {
                ForEach(daily) { day in
                    dailyRow(day)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("7-day daily forecast")
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("7-Day forecast")
    }

    private func dailyRow(_ daily: AggregatedDailyForecast) -> some View {
        HStack {
            // Day name
            Text(daily.date, format: .dateTime.weekday(.abbreviated))
                .font(.subheadline)
                .fontWeight(.medium)
                .frame(width: 50, alignment: .leading)
                .accessibilityHidden(true)

            // Weather icon
            Image(systemName: weatherIcon(daily.forecast.weatherCode))
                .font(.title3)
                .symbolRenderingMode(.multicolor)
                .frame(width: 40)
                .accessibilityLabel("\(weatherDescription(daily.forecast.weatherCode)) weather")

            // Precipitation
            if daily.forecast.precipitation.total.rawValue > 0 {
                Text("\(Int(daily.forecast.precipitation.probability * 100))%")
                    .font(.caption)
                    .foregroundStyle(.blue)
                    .frame(width: 35)
                    .accessibilityLabel("Precipitation chance")
                    .accessibilityValue("\(Int(daily.forecast.precipitation.probability * 100))%")
            } else {
                Spacer()
                    .frame(width: 35)
                    .accessibilityHidden(true)
            }

            Spacer()

            // Temperature range
            HStack(spacing: 8) {
                Text("\(Int(daily.forecast.temperature.min.rawValue.rounded()))°")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(width: 35, alignment: .trailing)
                    .accessibilityHidden(true)

                temperatureBar(
                    min: daily.forecast.temperature.min.rawValue,
                    max: daily.forecast.temperature.max.rawValue,
                    globalMin: daily.range.temperatureMin.min,
                    globalMax: daily.range.temperatureMax.max
                )
                .frame(width: 80)
                .accessibilityLabel("Temperature range")
                .accessibilityValue("Low \(Int(daily.forecast.temperature.min.rawValue.rounded())) degrees, high \(Int(daily.forecast.temperature.max.rawValue.rounded())) degrees")

                Text("\(Int(daily.forecast.temperature.max.rawValue.rounded()))°")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .frame(width: 35, alignment: .leading)
                    .accessibilityHidden(true)
            }

            // Confidence badge
            Image(systemName: "circle.fill")
                .font(.system(size: 8))
                .foregroundStyle(confidenceColor(daily.confidence.level))
                .accessibilityLabel("Confidence level")
                .accessibilityValue(daily.confidence.level.rawValue)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(daily.date.formatted(date: .abbreviated, time: .omitted))")
        .accessibilityValue("Weather: \(weatherDescription(daily.forecast.weatherCode)), Low \(Int(daily.forecast.temperature.min.rawValue.rounded())) degrees, High \(Int(daily.forecast.temperature.max.rawValue.rounded())) degrees\(daily.forecast.precipitation.total.rawValue > 0 ? ", \(Int(daily.forecast.precipitation.probability * 100))% chance of precipitation" : ""), Confidence: \(daily.confidence.level.rawValue)")
    }

    private func temperatureBar(min: Double, max: Double, globalMin: Double, globalMax: Double) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background
                Capsule()
                    .fill(Color.secondary.opacity(0.2))

                // Temperature range
                let range = globalMax - globalMin
                let start = range > 0 ? (min - globalMin) / range : 0
                let width = range > 0 ? (max - min) / range : 1

                Capsule()
                    .fill(LinearGradient(
                        colors: [.blue, .orange, .red],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: geometry.size.width * CGFloat(width))
                    .offset(x: geometry.size.width * CGFloat(start))
            }
        }
        .frame(height: 4)
    }

    // MARK: - Compare Module

    private func compareModule(_ modelForecasts: [ModelForecast], forecast: AggregatedForecast) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Model Comparison", systemImage: "square.grid.3x3")
                .font(.headline)
                .foregroundStyle(.primary)
                .accessibilityAddTraits(.isHeader)

            ModelCompareView(
                forecast: forecast,
                viewModel: viewModel
            )
            .accessibilityLabel("Model comparison and differences")
            .accessibilityHint("Compares predictions from different weather models")
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Model comparison")
    }

    // MARK: - Helper Views

    private func confidenceBadge(_ level: ConfidenceLevelName) -> some View {
        Circle()
            .fill(confidenceColor(level))
            .frame(width: 8, height: 8)
            .overlay(
                Circle()
                    .strokeBorder(confidenceColor(level).opacity(0.3), lineWidth: 3)
            )
            .accessibilityLabel("Confidence level")
            .accessibilityValue(level.rawValue)
    }

    // MARK: - Helpers

    private func colorDescription(_ level: ConfidenceLevelName) -> String {
        switch level {
        case .high: return "Green, indicating high confidence"
        case .medium: return "Yellow, indicating medium confidence"
        case .low: return "Red, indicating low confidence"
        }
    }

    private func weatherDescription(_ code: WeatherCode) -> String {
        switch code {
        case .clearSky: return "Clear"
        case .mainlyClear: return "Mostly Clear"
        case .partlyCloudy: return "Partly Cloudy"
        case .overcast: return "Overcast"
        case .fog, .depositingRimeFog: return "Foggy"
        case .drizzleLight, .drizzleModerate, .drizzleDense: return "Drizzle"
        case .freezingDrizzleLight, .freezingDrizzleDense: return "Freezing Drizzle"
        case .rainSlight, .rainModerate, .rainHeavy: return "Rain"
        case .freezingRainLight, .freezingRainHeavy: return "Freezing Rain"
        case .snowFallSlight, .snowFallModerate, .snowFallHeavy: return "Snow"
        case .snowGrains: return "Snow Grains"
        case .rainShowersSlight, .rainShowersModerate, .rainShowersViolent: return "Rain Showers"
        case .snowShowersSlight, .snowShowersHeavy: return "Snow Showers"
        case .thunderstorm, .thunderstormSlightHail, .thunderstormHeavyHail: return "Thunderstorm"
        }
    }

    private func weatherIcon(_ code: WeatherCode) -> String {
        switch code {
        case .clearSky: return "sun.max.fill"
        case .mainlyClear: return "sun.max"
        case .partlyCloudy: return "cloud.sun.fill"
        case .overcast: return "cloud.fill"
        case .fog, .depositingRimeFog: return "cloud.fog.fill"
        case .drizzleLight, .drizzleModerate, .drizzleDense: return "cloud.drizzle.fill"
        case .freezingDrizzleLight, .freezingDrizzleDense: return "cloud.sleet.fill"
        case .rainSlight, .rainModerate: return "cloud.rain.fill"
        case .rainHeavy: return "cloud.heavyrain.fill"
        case .freezingRainLight, .freezingRainHeavy: return "cloud.sleet.fill"
        case .snowFallSlight, .snowFallModerate, .snowFallHeavy: return "cloud.snow.fill"
        case .snowGrains: return "cloud.snow"
        case .rainShowersSlight, .rainShowersModerate, .rainShowersViolent: return "cloud.rain.fill"
        case .snowShowersSlight, .snowShowersHeavy: return "cloud.snow.fill"
        case .thunderstorm, .thunderstormSlightHail, .thunderstormHeavyHail: return "cloud.bolt.rain.fill"
        }
    }

    private func confidenceColor(_ level: ConfidenceLevelName) -> Color {
        switch level {
        case .high: return .green
        case .medium: return .yellow
        case .low: return .red
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

    return NavigationStack {
        ForecastDetailView(viewModel: ForecastDetailViewModel(location: location))
    }
}
