import Foundation

// MARK: - Preference Keys

/// All preference keys used by CloudSyncStore.
/// Each key has a defined type and default value.
public enum PreferenceKey: String, CaseIterable, Sendable {
    /// Ordered array of saved locations (stored as JSON-encoded [LocationEntity])
    case locations = "weather_oracle_locations"

    /// Temperature unit preference
    case temperatureUnit = "weather_oracle_temperature_unit"

    /// Wind speed unit preference
    case windSpeedUnit = "weather_oracle_wind_speed_unit"

    /// Pressure unit preference
    case pressureUnit = "weather_oracle_pressure_unit"

    /// Precipitation unit preference
    case precipitationUnit = "weather_oracle_precipitation_unit"

    /// Widget layout configuration (stored as JSON-encoded WidgetLayout)
    case widgetLayout = "weather_oracle_widget_layout"

    /// Notification rules (stored as JSON-encoded [NotificationRule])
    case notificationRules = "weather_oracle_notification_rules"

    /// Last sync timestamp
    case lastSyncTimestamp = "weather_oracle_last_sync"

    /// Schema version for migrations
    case schemaVersion = "weather_oracle_schema_version"
}

// MARK: - Unit Types

// Note: TemperatureUnit is defined in SharedKit.swift

/// Wind speed display units.
public enum WindSpeedUnit: String, Codable, Sendable, CaseIterable {
    case metersPerSecond
    case kilometersPerHour
    case milesPerHour
    case knots

    public static let `default`: WindSpeedUnit = .metersPerSecond
}

/// Pressure display units.
public enum PressureUnit: String, Codable, Sendable, CaseIterable {
    case hectopascals
    case millibars
    case inchesOfMercury

    public static let `default`: PressureUnit = .hectopascals
}

/// Precipitation display units.
public enum PrecipitationUnit: String, Codable, Sendable, CaseIterable {
    case millimeters
    case inches

    public static let `default`: PrecipitationUnit = .millimeters
}

// MARK: - Widget Layout

/// Widget layout configuration.
public struct WidgetLayout: Codable, Sendable, Hashable {
    /// Which models to show in widget
    public var visibleModels: [ModelName]

    /// Number of days to display
    public var forecastDays: Int

    /// Show hourly detail
    public var showHourlyDetail: Bool

    /// Compact mode for smaller widgets
    public var compactMode: Bool

    public init(
        visibleModels: [ModelName] = ModelName.allCases,
        forecastDays: Int = 7,
        showHourlyDetail: Bool = true,
        compactMode: Bool = false
    ) {
        self.visibleModels = visibleModels
        self.forecastDays = forecastDays
        self.showHourlyDetail = showHourlyDetail
        self.compactMode = compactMode
    }

    public static let `default` = WidgetLayout()
}

// MARK: - Notification Rules

/// Condition type for notifications.
public enum NotificationCondition: String, Codable, Sendable {
    case temperatureAbove
    case temperatureBelow
    case precipitationProbabilityAbove
    case windSpeedAbove
    case uvIndexAbove
    case severeWeather
}

/// A rule for when to send notifications.
public struct NotificationRule: Codable, Sendable, Hashable, Identifiable {
    public let id: UUID
    public var condition: NotificationCondition
    public var threshold: Double
    public var locationId: UUID?
    public var isEnabled: Bool

    public init(
        id: UUID = UUID(),
        condition: NotificationCondition,
        threshold: Double,
        locationId: UUID? = nil,
        isEnabled: Bool = true
    ) {
        self.id = id
        self.condition = condition
        self.threshold = threshold
        self.locationId = locationId
        self.isEnabled = isEnabled
    }
}

// MARK: - User Preferences Bundle

/// Complete user preferences bundle for sync.
public struct UserPreferences: Codable, Sendable, Hashable {
    public var locations: [LocationEntity]
    public var temperatureUnit: TemperatureUnit
    public var windSpeedUnit: WindSpeedUnit
    public var pressureUnit: PressureUnit
    public var precipitationUnit: PrecipitationUnit
    public var widgetLayout: WidgetLayout
    public var notificationRules: [NotificationRule]
    public var lastModified: Date

    public init(
        locations: [LocationEntity] = [],
        temperatureUnit: TemperatureUnit = .default,
        windSpeedUnit: WindSpeedUnit = .default,
        pressureUnit: PressureUnit = .default,
        precipitationUnit: PrecipitationUnit = .default,
        widgetLayout: WidgetLayout = .default,
        notificationRules: [NotificationRule] = [],
        lastModified: Date = Date()
    ) {
        self.locations = locations
        self.temperatureUnit = temperatureUnit
        self.windSpeedUnit = windSpeedUnit
        self.pressureUnit = pressureUnit
        self.precipitationUnit = precipitationUnit
        self.widgetLayout = widgetLayout
        self.notificationRules = notificationRules
        self.lastModified = lastModified
    }

    public static let `default` = UserPreferences()
}

// MARK: - Preference Change

/// Represents a change in preferences for the publisher.
public struct PreferenceChange: Sendable {
    public let key: PreferenceKey
    public let timestamp: Date

    public init(key: PreferenceKey, timestamp: Date = Date()) {
        self.key = key
        self.timestamp = timestamp
    }
}

// MARK: - Schema Version

/// Current schema version for migrations.
public enum PreferenceSchemaVersion: Int, Codable, Sendable {
    case v1 = 1

    public static let current: PreferenceSchemaVersion = .v1
}
