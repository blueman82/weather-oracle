import SwiftUI
import WidgetKit
import SharedKit

// MARK: - Inline Accessory Widget

/// Lock Screen inline accessory showing temperature and location
public struct InlineAccessoryWidgetView: View {
    let entry: WeatherWidgetEntry

    public var body: some View {
        if let location = entry.location,
           let temp = entry.currentTemperature {
            // Inline widgets support text and SF Symbols only
            HStack(spacing: 4) {
                Image(systemName: weatherIcon(entry.currentWeatherCode ?? .clearSky, at: entry.date))

                Text("\(location.name)")

                Text("\(Int(temp.rawValue.rounded()))°")
            }
        } else {
            Text("No Data")
        }
    }

    private func weatherIcon(_ code: WeatherCode, at timestamp: Date) -> String {
        let (sunrise, sunset) = entry.sunTimes(for: timestamp)
        return WeatherIconProvider.icon(for: code, at: timestamp, sunrise: sunrise, sunset: sunset)
    }
}

// MARK: - Circular Accessory Widget

/// Lock Screen circular accessory with temperature gauge
public struct CircularAccessoryWidgetView: View {
    let entry: WeatherWidgetEntry

    public var body: some View {
        if let temp = entry.currentTemperature,
           let weatherCode = entry.currentWeatherCode {
            // Circular gauge with temperature
            ZStack {
                AccessoryWidgetBackground()

                VStack(spacing: 2) {
                    Image(systemName: weatherIcon(weatherCode, at: entry.date))
                        .font(.title3)
                        .imageScale(.large)

                    Text("\(Int(temp.rawValue.rounded()))°")
                        .font(.system(size: 18, weight: .semibold))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
            }
        } else {
            ZStack {
                AccessoryWidgetBackground()

                VStack(spacing: 2) {
                    Image(systemName: "cloud.slash")
                        .font(.title3)

                    Text("--°")
                        .font(.caption)
                }
            }
        }
    }

    private func weatherIcon(_ code: WeatherCode, at timestamp: Date) -> String {
        let (sunrise, sunset) = entry.sunTimes(for: timestamp)
        return WeatherIconProvider.icon(for: code, at: timestamp, sunrise: sunrise, sunset: sunset)
    }
}

// MARK: - Rectangular Accessory Widget

/// Lock Screen rectangular accessory with current conditions and hourly preview
public struct RectangularAccessoryWidgetView: View {
    let entry: WeatherWidgetEntry

    public var body: some View {
        if let temp = entry.currentTemperature,
           let weatherCode = entry.currentWeatherCode {
            HStack(alignment: .center, spacing: 8) {
                // Left: Current conditions
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Image(systemName: weatherIcon(weatherCode, at: entry.date))
                            .font(.title3)

                        Text("\(Int(temp.rawValue.rounded()))°")
                            .font(.system(size: 24, weight: .semibold))
                    }

                    if let location = entry.location {
                        Text(location.name)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Right: Next 3 hours mini forecast
                if !entry.nextHourlyForecasts(count: 3).isEmpty {
                    HStack(spacing: 6) {
                        ForEach(entry.nextHourlyForecasts(count: 3), id: \.timestamp) { hourly in
                            VStack(spacing: 2) {
                                Text(hourly.timestamp, style: .time)
                                    .font(.system(size: 8))
                                    .foregroundStyle(.tertiary)

                                Image(systemName: weatherIcon(hourly.metrics.weatherCode, at: hourly.timestamp))
                                    .font(.caption2)

                                Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                                    .font(.system(size: 9))
                            }
                            .frame(width: 22)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        } else {
            HStack {
                Image(systemName: "cloud.slash")
                    .font(.title3)

                Text("No Data")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func weatherIcon(_ code: WeatherCode, at timestamp: Date) -> String {
        let (sunrise, sunset) = entry.sunTimes(for: timestamp)
        return WeatherIconProvider.icon(for: code, at: timestamp, sunrise: sunrise, sunset: sunset)
    }
}
