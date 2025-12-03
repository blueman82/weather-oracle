import WidgetKit
import SwiftUI
import SharedKit

// MARK: - App Group Configuration

/// Shared App Group identifier for data sharing between app and widgets
public enum AppGroupConfig {
    public static let identifier = "group.com.weatheroracle.app"

    /// Shared UserDefaults for widget data
    public static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: identifier)
    }

    /// Keys for widget data storage
    public enum CacheKey: String {
        case aggregatedForecast = "widget_aggregated_forecast"
        case lastUpdate = "widget_last_update"
        case selectedLocationId = "widget_selected_location_id"
    }
}

// MARK: - Widget Entry

/// Timeline entry for Weather Oracle widgets with aggregated forecast data
public struct WeatherWidgetEntry: TimelineEntry {
    public let date: Date
    public let forecast: AggregatedForecast?
    public let location: LocationEntity?
    public let lastUpdate: Date?
    public let configuration: WeatherWidgetConfiguration

    public init(
        date: Date,
        forecast: AggregatedForecast? = nil,
        location: LocationEntity? = nil,
        lastUpdate: Date? = nil,
        configuration: WeatherWidgetConfiguration = .default
    ) {
        self.date = date
        self.forecast = forecast
        self.location = location
        self.lastUpdate = lastUpdate
        self.configuration = configuration
    }

    /// Placeholder entry for widget preview
    public static var placeholder: WeatherWidgetEntry {
        WeatherWidgetEntry(
            date: Date(),
            forecast: nil,
            location: nil,
            lastUpdate: nil
        )
    }
}

// MARK: - Widget Configuration

/// Configuration options for widgets
public struct WeatherWidgetConfiguration: Codable, Sendable {
    public let showModelAgreement: Bool
    public let showConfidenceBadge: Bool
    public let temperatureUnit: TemperatureUnit
    public let hourlyHoursToShow: Int

    public init(
        showModelAgreement: Bool = true,
        showConfidenceBadge: Bool = true,
        temperatureUnit: TemperatureUnit = .celsius,
        hourlyHoursToShow: Int = 6
    ) {
        self.showModelAgreement = showModelAgreement
        self.showConfidenceBadge = showConfidenceBadge
        self.temperatureUnit = temperatureUnit
        self.hourlyHoursToShow = hourlyHoursToShow
    }

    public static let `default` = WeatherWidgetConfiguration()
}

// MARK: - Weather Widget Timeline Provider

/// Provides timeline entries for Weather Oracle widgets with hourly refresh from App Group cache
public struct WeatherWidgetTimelineProvider: TimelineProvider {
    public typealias Entry = WeatherWidgetEntry

    private let dataProvider = WidgetDataProvider()

    public init() {}

    // MARK: - Timeline Provider Methods

    public func placeholder(in context: Context) -> WeatherWidgetEntry {
        .placeholder
    }

    public func getSnapshot(
        in context: Context,
        completion: @escaping (WeatherWidgetEntry) -> Void
    ) {
        if context.isPreview {
            // For previews, use placeholder
            completion(.placeholder)
        } else {
            // For actual snapshot, load from cache
            Task {
                let entry = await loadEntry()
                completion(entry)
            }
        }
    }

    public func getTimeline(
        in context: Context,
        completion: @escaping (Timeline<WeatherWidgetEntry>) -> Void
    ) {
        Task {
            let entry = await loadEntry()

            // Schedule next update in 1 hour
            let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()

            let timeline = Timeline(
                entries: [entry],
                policy: .after(nextUpdate)
            )

            completion(timeline)
        }
    }

    // MARK: - Private Helpers

    private func loadEntry() async -> WeatherWidgetEntry {
        // Load forecast from App Group cache
        guard let forecast = dataProvider.loadCachedForecast(),
              let location = dataProvider.loadSelectedLocation(),
              let lastUpdate = dataProvider.loadLastUpdateTime() else {
            return WeatherWidgetEntry(
                date: Date(),
                forecast: nil,
                location: nil,
                lastUpdate: nil
            )
        }

        let configuration = dataProvider.loadConfiguration()

        return WeatherWidgetEntry(
            date: Date(),
            forecast: forecast,
            location: location,
            lastUpdate: lastUpdate,
            configuration: configuration
        )
    }
}

// MARK: - Widget Data Provider

/// Bridges SharedKit aggregator with widget data storage in App Group
public struct WidgetDataProvider {
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    public init() {}

    // MARK: - Cache Operations

    /// Save aggregated forecast to App Group for widgets
    public func saveForecast(_ forecast: AggregatedForecast, for location: LocationEntity) {
        guard let defaults = AppGroupConfig.sharedDefaults else { return }

        do {
            let forecastData = try encoder.encode(forecast)
            let locationData = try encoder.encode(location)

            defaults.set(forecastData, forKey: AppGroupConfig.CacheKey.aggregatedForecast.rawValue)
            defaults.set(locationData, forKey: AppGroupConfig.CacheKey.selectedLocationId.rawValue)
            defaults.set(Date(), forKey: AppGroupConfig.CacheKey.lastUpdate.rawValue)

            defaults.synchronize()

            // Reload all widget timelines after saving new data
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            print("Failed to save forecast to App Group: \(error)")
        }
    }

    /// Load cached aggregated forecast from App Group
    public func loadCachedForecast() -> AggregatedForecast? {
        guard let defaults = AppGroupConfig.sharedDefaults,
              let data = defaults.data(forKey: AppGroupConfig.CacheKey.aggregatedForecast.rawValue) else {
            return nil
        }

        return try? decoder.decode(AggregatedForecast.self, from: data)
    }

    /// Load selected location from App Group
    public func loadSelectedLocation() -> LocationEntity? {
        guard let defaults = AppGroupConfig.sharedDefaults,
              let data = defaults.data(forKey: AppGroupConfig.CacheKey.selectedLocationId.rawValue) else {
            return nil
        }

        return try? decoder.decode(LocationEntity.self, from: data)
    }

    /// Load last update time from App Group
    public func loadLastUpdateTime() -> Date? {
        guard let defaults = AppGroupConfig.sharedDefaults else { return nil }
        return defaults.object(forKey: AppGroupConfig.CacheKey.lastUpdate.rawValue) as? Date
    }

    /// Load widget configuration
    public func loadConfiguration() -> WeatherWidgetConfiguration {
        // Could be extended to load user preferences from CloudSyncStore
        return .default
    }

    // MARK: - Helper Methods

    /// Check if cached data is still fresh (within 1 hour)
    public func isCacheFresh() -> Bool {
        guard let lastUpdate = loadLastUpdateTime() else { return false }
        let hourAgo = Date().addingTimeInterval(-3600)
        return lastUpdate > hourAgo
    }

    /// Clear all widget cached data
    public func clearCache() {
        guard let defaults = AppGroupConfig.sharedDefaults else { return }

        defaults.removeObject(forKey: AppGroupConfig.CacheKey.aggregatedForecast.rawValue)
        defaults.removeObject(forKey: AppGroupConfig.CacheKey.selectedLocationId.rawValue)
        defaults.removeObject(forKey: AppGroupConfig.CacheKey.lastUpdate.rawValue)

        defaults.synchronize()

        WidgetCenter.shared.reloadAllTimelines()
    }
}

// MARK: - Widget Utilities

extension WeatherWidgetEntry {
    /// Current temperature for display
    public var currentTemperature: Celsius? {
        forecast?.consensus.hourly.first?.metrics.temperature
    }

    /// Current weather code
    public var currentWeatherCode: WeatherCode? {
        forecast?.consensus.hourly.first?.metrics.weatherCode
    }

    /// Today's high temperature
    public var todayHigh: Celsius? {
        forecast?.consensus.daily.first?.forecast.temperature.max
    }

    /// Today's low temperature
    public var todayLow: Celsius? {
        forecast?.consensus.daily.first?.forecast.temperature.min
    }

    /// Current confidence level
    public var currentConfidence: ConfidenceLevel? {
        forecast?.consensus.hourly.first?.confidence
    }

    /// Hourly forecast for next few hours
    public func nextHourlyForecasts(count: Int = 6) -> [AggregatedHourlyForecast] {
        Array((forecast?.consensus.hourly.prefix(count) ?? []))
    }

    /// Daily forecast for next few days
    public func nextDailyForecasts(count: Int = 5) -> [AggregatedDailyForecast] {
        Array((forecast?.consensus.daily.prefix(count) ?? []))
    }

    /// Today's sunrise time from the first daily forecast
    /// - Returns: The sunrise time if available, otherwise nil
    public var todaySunrise: Date? {
        forecast?.consensus.daily.first?.forecast.sun.sunrise
    }

    /// Today's sunset time from the first daily forecast
    /// - Returns: The sunset time if available, otherwise nil
    public var todaySunset: Date? {
        forecast?.consensus.daily.first?.forecast.sun.sunset
    }

    /// Retrieves sunrise and sunset times for a given date
    /// - Parameter date: The date to find sun times for
    /// - Returns: A tuple containing the sunrise and sunset times, or (nil, nil) if not found
    /// - Note: Matches dates using calendar day comparison, falling back to (nil, nil) if daily forecasts are unavailable
    public func sunTimes(for date: Date) -> (sunrise: Date?, sunset: Date?) {
        guard let dailyForecasts = forecast?.consensus.daily else {
            return (nil, nil)
        }

        let targetDate = Calendar.current.startOfDay(for: date)

        for dayForecast in dailyForecasts {
            let forecastDate = Calendar.current.startOfDay(for: dayForecast.date)
            if forecastDate == targetDate {
                return (dayForecast.forecast.sun.sunrise, dayForecast.forecast.sun.sunset)
            }
        }

        return (nil, nil)
    }
}
