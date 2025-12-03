import SwiftUI
import WidgetKit
import SharedKit

// MARK: - StandBy Widget View

/// Large format StandBy widget optimized for bedside charging display
/// Displays current conditions with large temperature, hourly forecast, and daily preview
public struct StandByWidgetView: View {
    let entry: WeatherWidgetEntry

    public var body: some View {
        GeometryReader { geometry in
            if let temp = entry.currentTemperature,
               let weatherCode = entry.currentWeatherCode {
                HStack(spacing: 20) {
                    // Left: Large current conditions
                    VStack(alignment: .leading, spacing: 12) {
                        // Location
                        if let location = entry.location {
                            Text(location.name)
                                .font(.title3)
                                .fontWeight(.medium)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        // Large temperature with icon
                        HStack(alignment: .top, spacing: 16) {
                            Image(systemName: weatherIcon(weatherCode))
                                .font(.system(size: 80))
                                .foregroundStyle(.blue)

                            Text("\(Int(temp.rawValue.rounded()))°")
                                .font(.system(size: 120, weight: .ultraLight))
                                .minimumScaleFactor(0.5)
                        }

                        // Condition description
                        Text(weatherDescription(weatherCode))
                            .font(.title2)
                            .foregroundStyle(.secondary)

                        // High/Low
                        if let high = entry.todayHigh, let low = entry.todayLow {
                            HStack(spacing: 20) {
                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.up")
                                        .font(.title3)
                                    Text("\(Int(high.rawValue.rounded()))°")
                                        .font(.title2)
                                }
                                .foregroundStyle(.red)

                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.down")
                                        .font(.title3)
                                    Text("\(Int(low.rawValue.rounded()))°")
                                        .font(.title2)
                                }
                                .foregroundStyle(.blue)
                            }
                        }

                        Spacer()

                        // Footer with confidence and last update
                        HStack {
                            if entry.configuration.showConfidenceBadge,
                               let confidence = entry.currentConfidence {
                                confidenceBadge(confidence)
                            }

                            Spacer()

                            if let lastUpdate = entry.lastUpdate {
                                Text("Updated \(lastUpdate, style: .relative)")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }
                    .frame(maxWidth: geometry.size.width * 0.5)

                    Divider()

                    // Right: Forecast preview
                    VStack(alignment: .leading, spacing: 20) {
                        // Hourly forecast
                        if !entry.nextHourlyForecasts().isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("NEXT 6 HOURS")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.secondary)

                                HStack(spacing: 16) {
                                    ForEach(entry.nextHourlyForecasts(), id: \.timestamp) { hourly in
                                        hourlyCell(hourly)
                                    }
                                }
                            }
                        }

                        Spacer()

                        // Daily forecast
                        if !entry.nextDailyForecasts(count: 3).isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("3-DAY FORECAST")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.secondary)

                                VStack(spacing: 10) {
                                    ForEach(entry.nextDailyForecasts(count: 3), id: \.date) { daily in
                                        dailyRow(daily)
                                    }
                                }
                            }
                        }
                    }
                    .frame(maxWidth: geometry.size.width * 0.4)
                }
                .padding(24)
            } else {
                emptyState
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }

    // MARK: - Subviews

    private func hourlyCell(_ hourly: AggregatedHourlyForecast) -> some View {
        VStack(spacing: 8) {
            Text(hourly.timestamp, style: .time)
                .font(.caption)
                .foregroundStyle(.secondary)

            Image(systemName: weatherIcon(hourly.metrics.weatherCode))
                .font(.title2)
                .foregroundStyle(.blue)

            Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                .font(.body)
                .fontWeight(.medium)
        }
        .frame(width: 50)
    }

    private func dailyRow(_ daily: AggregatedDailyForecast) -> some View {
        HStack {
            Text(daily.date, format: .dateTime.weekday(.abbreviated))
                .font(.body)
                .frame(width: 40, alignment: .leading)

            Image(systemName: weatherIcon(daily.forecast.weatherCode))
                .font(.title3)
                .foregroundStyle(.blue)
                .frame(width: 30)

            Spacer()

            // Temperature range with gradient bar
            HStack(spacing: 8) {
                Text("\(Int(daily.forecast.temperature.min.rawValue.rounded()))°")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .frame(width: 35, alignment: .trailing)

                Rectangle()
                    .fill(LinearGradient(
                        colors: [.blue, .orange, .red],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: 60, height: 6)
                    .cornerRadius(3)

                Text("\(Int(daily.forecast.temperature.max.rawValue.rounded()))°")
                    .font(.body)
                    .fontWeight(.semibold)
                    .frame(width: 35, alignment: .leading)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "cloud.slash")
                .font(.system(size: 60))
                .foregroundStyle(.secondary)

            Text("No Weather Data Available")
                .font(.title2)
                .foregroundStyle(.secondary)

            Text("Open the app to load weather data")
                .font(.body)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func confidenceBadge(_ confidence: ConfidenceLevel) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(colorForConfidence(confidence.level))
                .frame(width: 10, height: 10)

            Text(confidence.level.rawValue.uppercased())
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            Text(String(format: "%.0f%%", confidence.score * 100))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.secondary.opacity(0.15))
        .cornerRadius(10)
    }

    private func colorForConfidence(_ level: ConfidenceLevelName) -> Color {
        switch level {
        case .high: return .green
        case .medium: return .yellow
        case .low: return .red
        }
    }

    private func weatherIcon(_ code: WeatherCode) -> String {
        switch code {
        case .clearSky: return "sun.max.fill"
        case .mainlyClear: return "sun.max"
        case .partlyCloudy: return "cloud.sun.fill"
        case .overcast: return "cloud.fill"
        case .fog, .depositingRimeFog: return "cloud.fog.fill"
        case .lightDrizzle, .moderateDrizzle, .denseDrizzle: return "cloud.drizzle.fill"
        case .lightFreezingDrizzle, .denseFreezingDrizzle: return "cloud.sleet.fill"
        case .slightRain, .moderateRain: return "cloud.rain.fill"
        case .heavyRain: return "cloud.heavyrain.fill"
        case .lightFreezingRain, .heavyFreezingRain: return "cloud.sleet.fill"
        case .slightSnow, .moderateSnow, .heavySnow: return "cloud.snow.fill"
        case .snowGrains: return "cloud.snow"
        case .slightRainShowers, .moderateRainShowers, .violentRainShowers: return "cloud.rain.fill"
        case .slightSnowShowers, .heavySnowShowers: return "cloud.snow.fill"
        case .thunderstorm, .thunderstormWithSlightHail, .thunderstormWithHeavyHail: return "cloud.bolt.rain.fill"
        }
    }

    private func weatherDescription(_ code: WeatherCode) -> String {
        switch code {
        case .clearSky: return "Clear Sky"
        case .mainlyClear: return "Mostly Clear"
        case .partlyCloudy: return "Partly Cloudy"
        case .overcast: return "Overcast"
        case .fog, .depositingRimeFog: return "Foggy"
        case .lightDrizzle, .moderateDrizzle, .denseDrizzle: return "Drizzle"
        case .lightFreezingDrizzle, .denseFreezingDrizzle: return "Freezing Drizzle"
        case .slightRain, .moderateRain, .heavyRain: return "Rain"
        case .lightFreezingRain, .heavyFreezingRain: return "Freezing Rain"
        case .slightSnow, .moderateSnow, .heavySnow: return "Snow"
        case .snowGrains: return "Snow Grains"
        case .slightRainShowers, .moderateRainShowers, .violentRainShowers: return "Showers"
        case .slightSnowShowers, .heavySnowShowers: return "Snow Showers"
        case .thunderstorm, .thunderstormWithSlightHail, .thunderstormWithHeavyHail: return "Thunderstorm"
        }
    }
}
