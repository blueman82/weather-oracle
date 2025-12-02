import SwiftUI
import SharedKit

// MARK: - Watch Forecast Detail View

/// Detailed forecast view for watchOS with scrollable modules
public struct WatchForecastDetailView: View {
    @Bindable var viewModel: WatchLocationViewModel
    let location: LocationEntity

    @State private var scrollOffset: CGFloat = 0

    public init(viewModel: WatchLocationViewModel, location: LocationEntity) {
        self.viewModel = viewModel
        self.location = location
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if viewModel.isLoading {
                    loadingView
                } else if let error = viewModel.error {
                    errorView(error)
                } else if let forecast = viewModel.forecast {
                    forecastContent(forecast)
                } else {
                    Text("No data")
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("No weather data available")
                }
            }
            .padding()
        }
        .navigationTitle(location.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            await viewModel.refresh()
        }
        .focusable()
        .digitalCrownRotation($scrollOffset)
        .accessibilityHint("Use Digital Crown to scroll through forecast details")
    }

    // MARK: - Loading & Error States

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(0.8)
                .accessibilityLabel("Loading forecast")
            Text("Loading...")
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, minHeight: 100)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Loading weather forecast")
    }

    private func errorView(_ error: Error) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(.orange)
                .accessibilityLabel("Error icon")
                .accessibilityHidden(true)

            Text("Failed to load")
                .font(.caption)
                .accessibilityLabel("Load failed")

            Text(error.localizedDescription)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .accessibilityLabel("Error details: \(error.localizedDescription)")
        }
        .padding()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Error loading forecast")
        .accessibilityHint("Check your connection and try again")
    }

    // MARK: - Forecast Content

    private func forecastContent(_ forecast: AggregatedForecast) -> some View {
        VStack(spacing: 16) {
            // Current conditions card
            currentConditionsCard(forecast)

            Divider()
                .accessibilityHidden(true)

            // Hourly forecast (next 6 hours)
            if !forecast.consensus.hourly.isEmpty {
                hourlyForecastSection(forecast)
            }

            Divider()
                .accessibilityHidden(true)

            // Daily forecast
            if !forecast.consensus.daily.isEmpty {
                dailyForecastSection(forecast)
            }

            // Last updated
            if let updated = viewModel.lastUpdated {
                Text("Updated \(updated, style: .relative)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .accessibilityLabel("Last updated \(updated, style: .relative)")
            }
        }
    }

    // MARK: - Current Conditions

    private func currentConditionsCard(_ forecast: AggregatedForecast) -> some View {
        VStack(spacing: 8) {
            if let current = forecast.consensus.hourly.first {
                // Temperature
                Text("\(Int(current.metrics.temperature.rawValue.rounded()))°")
                    .font(.system(size: 48, weight: .thin))
                    .accessibilityLabel("Temperature")
                    .accessibilityValue("\(Int(current.metrics.temperature.rawValue.rounded())) degrees")

                // Condition
                HStack(spacing: 4) {
                    Image(systemName: weatherIcon(current.metrics.weatherCode))
                        .font(.title3)
                        .symbolRenderingMode(.multicolor)
                        .accessibilityLabel("Weather condition icon")
                        .accessibilityValue(weatherDescription(current.metrics.weatherCode))
                        .accessibilityHidden(false)

                    Text(weatherDescription(current.metrics.weatherCode))
                        .font(.caption)
                        .accessibilityHidden(true)
                }
                .foregroundStyle(.secondary)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Current condition: \(weatherDescription(current.metrics.weatherCode))")

                // High/Low
                if let daily = forecast.consensus.daily.first {
                    HStack(spacing: 12) {
                        Label("\(Int(daily.forecast.temperature.max.rawValue.rounded()))°", systemImage: "arrow.up")
                            .font(.caption)
                            .foregroundStyle(.red)
                            .accessibilityLabel("High temperature")
                            .accessibilityValue("\(Int(daily.forecast.temperature.max.rawValue.rounded())) degrees")

                        Label("\(Int(daily.forecast.temperature.min.rawValue.rounded()))°", systemImage: "arrow.down")
                            .font(.caption)
                            .foregroundStyle(.blue)
                            .accessibilityLabel("Low temperature")
                            .accessibilityValue("\(Int(daily.forecast.temperature.min.rawValue.rounded())) degrees")
                    }
                    .accessibilityElement(children: .combine)
                }

                // Additional metrics
                HStack(spacing: 16) {
                    metricItem(
                        icon: "drop.fill",
                        value: "\(Int((current.metrics.precipitationProbability * 100).rounded()))%",
                        label: "Rain"
                    )

                    metricItem(
                        icon: "wind",
                        value: "\(Int(current.metrics.windSpeed.rawValue.rounded()))m/s",
                        label: "Wind"
                    )
                }
                .font(.caption2)
                .accessibilityElement(children: .combine)
            }
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Current conditions")
    }

    private func metricItem(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text(value)
                .fontWeight(.medium)
                .accessibilityLabel(label)
                .accessibilityValue(value)
            Text(label)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Hourly Forecast

    private func hourlyForecastSection(_ forecast: AggregatedForecast) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Next 6 Hours")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityLabel("Next 6 hours forecast section")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(forecast.consensus.hourly.prefix(6)) { hourly in
                        hourlyCell(hourly)
                    }
                }
            }
            .accessibilityLabel("Hourly forecast scroll")
            .accessibilityHint("Scroll horizontally to see more hourly forecasts")
        }
    }

    private func hourlyCell(_ hourly: AggregatedHourlyForecast) -> some View {
        VStack(spacing: 6) {
            Text(hourly.timestamp, style: .time)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Time")
                .accessibilityValue(hourly.timestamp, style: .time)

            Image(systemName: weatherIcon(hourly.metrics.weatherCode))
                .font(.body)
                .symbolRenderingMode(.multicolor)
                .accessibilityLabel("Weather")
                .accessibilityValue(weatherDescription(hourly.metrics.weatherCode))

            Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                .font(.caption)
                .fontWeight(.medium)
                .accessibilityLabel("Temperature")
                .accessibilityValue("\(Int(hourly.metrics.temperature.rawValue.rounded())) degrees")
        }
        .frame(width: 50)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Daily Forecast

    private func dailyForecastSection(_ forecast: AggregatedForecast) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("3-Day Forecast")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityLabel("3-day forecast section")

            VStack(spacing: 8) {
                ForEach(forecast.consensus.daily.prefix(3)) { daily in
                    dailyRow(daily)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    private func dailyRow(_ daily: AggregatedDailyForecast) -> some View {
        HStack {
            // Day
            Text(daily.date, format: .dateTime.weekday(.abbreviated))
                .font(.caption)
                .frame(width: 30, alignment: .leading)
                .accessibilityLabel("Day of week")
                .accessibilityValue(daily.date, format: .dateTime.weekday(.wide))

            // Icon
            Image(systemName: weatherIcon(daily.forecast.weatherCode))
                .font(.caption)
                .symbolRenderingMode(.multicolor)
                .frame(width: 25)
                .accessibilityLabel("Weather condition")
                .accessibilityValue(weatherDescription(daily.forecast.weatherCode))

            Spacer()
                .accessibilityHidden(true)

            // Temperatures
            HStack(spacing: 6) {
                Text("\(Int(daily.forecast.temperature.min.rawValue.rounded()))°")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Low")
                    .accessibilityValue("\(Int(daily.forecast.temperature.min.rawValue.rounded())) degrees")

                Rectangle()
                    .fill(LinearGradient(
                        colors: [.blue, .orange],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: 30, height: 3)
                    .cornerRadius(1.5)
                    .accessibilityHidden(true)

                Text("\(Int(daily.forecast.temperature.max.rawValue.rounded()))°")
                    .font(.caption)
                    .fontWeight(.medium)
                    .accessibilityLabel("High")
                    .accessibilityValue("\(Int(daily.forecast.temperature.max.rawValue.rounded())) degrees")
            }
            .accessibilityElement(children: .combine)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Helpers

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
}
