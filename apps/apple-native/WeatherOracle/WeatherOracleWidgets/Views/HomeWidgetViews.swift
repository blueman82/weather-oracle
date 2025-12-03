import SwiftUI
import WidgetKit
import SharedKit

// MARK: - Small Home Widget

/// Small widget showing current conditions and temperature
public struct SmallHomeWidgetView: View {
    let entry: WeatherWidgetEntry

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Location name
            if let location = entry.location {
                Text(location.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Current conditions
            if let temp = entry.currentTemperature,
               let weatherCode = entry.currentWeatherCode {
                HStack(alignment: .top, spacing: 12) {
                    // Weather icon
                    Image(systemName: weatherIcon(weatherCode))
                        .font(.system(size: 32))
                        .foregroundStyle(.blue)

                    Spacer()

                    // Temperature
                    Text("\(Int(temp.rawValue.rounded()))°")
                        .font(.system(size: 48, weight: .thin))
                        .minimumScaleFactor(0.5)
                }
            } else {
                emptyState
            }

            Spacer()

            // Confidence badge
            if entry.configuration.showConfidenceBadge,
               let confidence = entry.currentConfidence {
                confidenceBadge(confidence)
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }

    // MARK: - Subviews

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "cloud.slash")
                .font(.title)
                .foregroundStyle(.secondary)

            Text("No Data")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    private func confidenceBadge(_ confidence: ConfidenceLevel) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(colorForConfidence(confidence.level))
                .frame(width: 6, height: 6)

            Text(confidence.level.rawValue.uppercased())
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
        }
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
}

// MARK: - Medium Home Widget

/// Medium widget showing current conditions plus hourly forecast
public struct MediumHomeWidgetView: View {
    let entry: WeatherWidgetEntry

    public var body: some View {
        HStack(spacing: 16) {
            // Left: Current conditions
            VStack(alignment: .leading, spacing: 4) {
                if let location = entry.location {
                    Text(location.name)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                if let temp = entry.currentTemperature,
                   let weatherCode = entry.currentWeatherCode {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: weatherIcon(weatherCode))
                            .font(.system(size: 24))
                            .foregroundStyle(.blue)

                        Text("\(Int(temp.rawValue.rounded()))°")
                            .font(.system(size: 40, weight: .thin))
                    }

                    // High/Low
                    if let high = entry.todayHigh, let low = entry.todayLow {
                        HStack(spacing: 8) {
                            HStack(spacing: 2) {
                                Image(systemName: "arrow.up")
                                    .font(.caption2)
                                Text("\(Int(high.rawValue.rounded()))°")
                                    .font(.caption)
                            }
                            .foregroundStyle(.red)

                            HStack(spacing: 2) {
                                Image(systemName: "arrow.down")
                                    .font(.caption2)
                                Text("\(Int(low.rawValue.rounded()))°")
                                    .font(.caption)
                            }
                            .foregroundStyle(.blue)
                        }
                    }
                } else {
                    emptyState
                }

                Spacer()

                // Confidence
                if entry.configuration.showConfidenceBadge,
                   let confidence = entry.currentConfidence {
                    confidenceBadge(confidence)
                }
            }

            Divider()

            // Right: Hourly forecast
            if !entry.nextHourlyForecasts().isEmpty {
                hourlyForecast
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }

    // MARK: - Subviews

    private var hourlyForecast: some View {
        HStack(spacing: 8) {
            ForEach(entry.nextHourlyForecasts(), id: \.timestamp) { hourly in
                VStack(spacing: 6) {
                    Text(hourly.timestamp, style: .time)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    Image(systemName: weatherIcon(hourly.metrics.weatherCode))
                        .font(.body)
                        .symbolRenderingMode(.multicolor)

                    Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                        .font(.caption)
                        .fontWeight(.medium)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "cloud.slash")
                .font(.title3)
                .foregroundStyle(.secondary)

            Text("No Data")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private func confidenceBadge(_ confidence: ConfidenceLevel) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(colorForConfidence(confidence.level))
                .frame(width: 6, height: 6)

            Text(confidence.level.rawValue.uppercased())
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
        }
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
}

// MARK: - Large Home Widget

/// Large widget with current conditions, hourly forecast, and daily forecast
public struct LargeHomeWidgetView: View {
    let entry: WeatherWidgetEntry

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            header

            Divider()

            // Current conditions
            if let temp = entry.currentTemperature,
               let weatherCode = entry.currentWeatherCode {
                currentConditions(temp: temp, weatherCode: weatherCode)
            } else {
                emptyState
            }

            Divider()

            // Hourly forecast
            if !entry.nextHourlyForecasts().isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("HOURLY")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(entry.nextHourlyForecasts(), id: \.timestamp) { hourly in
                                hourlyCell(hourly)
                            }
                        }
                    }
                }
            }

            Divider()

            // Daily forecast
            if !entry.nextDailyForecasts().isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("FORECAST")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)

                    VStack(spacing: 6) {
                        ForEach(entry.nextDailyForecasts().prefix(3), id: \.date) { daily in
                            dailyRow(daily)
                        }
                    }
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }

    // MARK: - Subviews

    private var header: some View {
        HStack {
            if let location = entry.location {
                VStack(alignment: .leading, spacing: 2) {
                    Text(location.name)
                        .font(.headline)
                        .fontWeight(.semibold)

                    if let lastUpdate = entry.lastUpdate {
                        Text("Updated \(lastUpdate, style: .relative)")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Spacer()

            // Confidence badge
            if entry.configuration.showConfidenceBadge,
               let confidence = entry.currentConfidence {
                confidenceBadge(confidence)
            }
        }
    }

    private func currentConditions(temp: Celsius, weatherCode: WeatherCode) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: weatherIcon(weatherCode))
                        .font(.system(size: 32))
                        .foregroundStyle(.blue)

                    Text("\(Int(temp.rawValue.rounded()))°")
                        .font(.system(size: 56, weight: .thin))
                }

                Text(weatherDescription(weatherCode))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // High/Low
            if let high = entry.todayHigh, let low = entry.todayLow {
                VStack(alignment: .trailing, spacing: 8) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up")
                            .font(.caption)
                        Text("\(Int(high.rawValue.rounded()))°")
                            .font(.body)
                    }
                    .foregroundStyle(.red)

                    HStack(spacing: 4) {
                        Image(systemName: "arrow.down")
                            .font(.caption)
                        Text("\(Int(low.rawValue.rounded()))°")
                            .font(.body)
                    }
                    .foregroundStyle(.blue)
                }
            }
        }
    }

    private func hourlyCell(_ hourly: AggregatedHourlyForecast) -> some View {
        VStack(spacing: 6) {
            Text(hourly.timestamp, style: .time)
                .font(.caption2)
                .foregroundStyle(.secondary)

            Image(systemName: weatherIcon(hourly.metrics.weatherCode))
                .font(.body)
                .foregroundStyle(.blue)

            Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                .font(.caption)
                .fontWeight(.medium)
        }
        .frame(width: 40)
    }

    private func dailyRow(_ daily: AggregatedDailyForecast) -> some View {
        HStack {
            Text(daily.date, format: .dateTime.weekday(.abbreviated))
                .font(.caption)
                .frame(width: 30, alignment: .leading)

            Image(systemName: weatherIcon(daily.forecast.weatherCode))
                .font(.caption)
                .foregroundStyle(.blue)
                .frame(width: 20)

            Spacer()

            // Temperature range
            HStack(spacing: 4) {
                Text("\(Int(daily.forecast.temperature.min.rawValue.rounded()))°")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Rectangle()
                    .fill(LinearGradient(
                        colors: [.blue, .orange, .red],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: 40, height: 4)
                    .cornerRadius(2)

                Text("\(Int(daily.forecast.temperature.max.rawValue.rounded()))°")
                    .font(.caption)
                    .fontWeight(.medium)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "cloud.slash")
                .font(.title)
                .foregroundStyle(.secondary)

            Text("No weather data available")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private func confidenceBadge(_ confidence: ConfidenceLevel) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(colorForConfidence(confidence.level))
                .frame(width: 8, height: 8)

            Text(confidence.level.rawValue.uppercased())
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
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
}
