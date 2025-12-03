import Foundation
import UserNotifications
import SharedKit

// MARK: - Notification Category

/// Notification categories for different alert types
public enum NotificationCategory: String {
    case severeWeather = "SEVERE_WEATHER"
    case modelDivergence = "MODEL_DIVERGENCE"
    case dailySummary = "DAILY_SUMMARY"

    var identifier: String { rawValue }
}

// MARK: - Notification Action

/// Actions available on notifications
public enum NotificationAction: String {
    case viewForecast = "VIEW_FORECAST"
    case compareModels = "COMPARE_MODELS"
    case dismiss = "DISMISS"

    var identifier: String { rawValue }
}

// MARK: - Alert Trigger

/// Trigger conditions for notifications
public struct AlertTrigger: Codable, Sendable {
    public let id: UUID
    public let locationId: UUID?
    public let condition: NotificationCondition
    public let threshold: Double
    public let isEnabled: Bool

    public init(
        id: UUID = UUID(),
        locationId: UUID? = nil,
        condition: NotificationCondition,
        threshold: Double,
        isEnabled: Bool = true
    ) {
        self.id = id
        self.locationId = locationId
        self.condition = condition
        self.threshold = threshold
        self.isEnabled = isEnabled
    }
}

// MARK: - Alert Result

/// Result of evaluating alert rules
public struct AlertResult {
    public let trigger: AlertTrigger
    public let location: LocationEntity
    public let forecast: AggregatedForecast
    public let matchedValue: Double
    public let description: String

    public init(
        trigger: AlertTrigger,
        location: LocationEntity,
        forecast: AggregatedForecast,
        matchedValue: Double,
        description: String
    ) {
        self.trigger = trigger
        self.location = location
        self.forecast = forecast
        self.matchedValue = matchedValue
        self.description = description
    }
}

// MARK: - Model Divergence Alert

/// Alert for significant model disagreement
public struct ModelDivergenceAlert {
    public let location: LocationEntity
    public let forecast: AggregatedForecast
    public let metric: String
    public let spread: Double
    public let timestamp: Date

    public init(
        location: LocationEntity,
        forecast: AggregatedForecast,
        metric: String,
        spread: Double,
        timestamp: Date
    ) {
        self.location = location
        self.forecast = forecast
        self.metric = metric
        self.spread = spread
        self.timestamp = timestamp
    }
}

// MARK: - Notification Engine

/// Rule engine for weather notifications
@MainActor
public final class NotificationEngine {
    // MARK: - Properties

    private let center: UNUserNotificationCenter
    private let store: CloudSyncStore

    /// Threshold for severe weather (temperature extremes, high precipitation, etc.)
    private static let severeTemperatureHigh: Double = 35.0 // Celsius
    private static let severeTemperatureLow: Double = -10.0 // Celsius
    private static let severePrecipitation: Double = 50.0 // mm
    private static let severeWindSpeed: Double = 15.0 // m/s (54 km/h)

    /// Threshold for model divergence alerting
    private static let divergenceThreshold: Double = 5.0 // Standard deviation in Celsius

    // MARK: - Initialization

    public init(
        center: UNUserNotificationCenter = .current(),
        store: CloudSyncStore
    ) {
        self.center = center
        self.store = store
    }

    // MARK: - Setup

    /// Register notification categories and actions
    public func registerCategories() {
        let viewAction = UNNotificationAction(
            identifier: NotificationAction.viewForecast.identifier,
            title: "View Forecast",
            options: [.foreground]
        )

        let compareAction = UNNotificationAction(
            identifier: NotificationAction.compareModels.identifier,
            title: "Compare Models",
            options: [.foreground]
        )

        let dismissAction = UNNotificationAction(
            identifier: NotificationAction.dismiss.identifier,
            title: "Dismiss",
            options: []
        )

        let severeCategory = UNNotificationCategory(
            identifier: NotificationCategory.severeWeather.identifier,
            actions: [viewAction, dismissAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        let divergenceCategory = UNNotificationCategory(
            identifier: NotificationCategory.modelDivergence.identifier,
            actions: [compareAction, dismissAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        let summaryCategory = UNNotificationCategory(
            identifier: NotificationCategory.dailySummary.identifier,
            actions: [viewAction, dismissAction],
            intentIdentifiers: [],
            options: []
        )

        center.setNotificationCategories([severeCategory, divergenceCategory, summaryCategory])
    }

    /// Request notification permissions
    public func requestAuthorization() async throws -> Bool {
        try await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    // MARK: - Rule Evaluation

    /// Evaluate all rules for a location and forecast
    public func evaluateRules(
        location: LocationEntity,
        forecast: AggregatedForecast
    ) -> [AlertResult] {
        let rules = store.enabledNotificationRules(for: location.id)
        var results: [AlertResult] = []

        for rule in rules {
            if let result = evaluateRule(rule, location: location, forecast: forecast) {
                results.append(result)
            }
        }

        return results
    }

    /// Evaluate a single rule
    private func evaluateRule(
        _ rule: NotificationRule,
        location: LocationEntity,
        forecast: AggregatedForecast
    ) -> AlertResult? {
        guard let firstHourly = forecast.consensus.hourly.first else { return nil }

        let trigger = AlertTrigger(
            id: rule.id,
            locationId: rule.locationId,
            condition: rule.condition,
            threshold: rule.threshold,
            isEnabled: rule.isEnabled
        )

        switch rule.condition {
        case .temperatureAbove:
            let temp = firstHourly.metrics.temperature.rawValue
            if temp > rule.threshold {
                return AlertResult(
                    trigger: trigger,
                    location: location,
                    forecast: forecast,
                    matchedValue: temp,
                    description: "Temperature exceeds \(Int(rule.threshold))°C at \(Int(temp))°C"
                )
            }

        case .temperatureBelow:
            let temp = firstHourly.metrics.temperature.rawValue
            if temp < rule.threshold {
                return AlertResult(
                    trigger: trigger,
                    location: location,
                    forecast: forecast,
                    matchedValue: temp,
                    description: "Temperature drops below \(Int(rule.threshold))°C at \(Int(temp))°C"
                )
            }

        case .precipitationProbabilityAbove:
            let prob = firstHourly.metrics.precipitationProbability * 100
            if prob > rule.threshold {
                return AlertResult(
                    trigger: trigger,
                    location: location,
                    forecast: forecast,
                    matchedValue: prob,
                    description: "Precipitation probability \(Int(prob))%"
                )
            }

        case .windSpeedAbove:
            let wind = firstHourly.metrics.windSpeed.rawValue
            if wind > rule.threshold {
                return AlertResult(
                    trigger: trigger,
                    location: location,
                    forecast: forecast,
                    matchedValue: wind,
                    description: "Wind speed \(Int(wind * 3.6)) km/h"
                )
            }

        case .uvIndexAbove:
            let uv = firstHourly.metrics.uvIndex.rawValue
            if Double(uv) > rule.threshold {
                return AlertResult(
                    trigger: trigger,
                    location: location,
                    forecast: forecast,
                    matchedValue: Double(uv),
                    description: "High UV index: \(uv)"
                )
            }

        case .severeWeather:
            if let alert = checkSevereWeather(forecast: forecast) {
                return AlertResult(
                    trigger: trigger,
                    location: location,
                    forecast: forecast,
                    matchedValue: 1.0,
                    description: alert
                )
            }
        }

        return nil
    }

    /// Check for severe weather conditions
    private func checkSevereWeather(forecast: AggregatedForecast) -> String? {
        guard let firstHourly = forecast.consensus.hourly.first,
              let firstDaily = forecast.consensus.daily.first else {
            return nil
        }

        // Check temperature extremes
        if firstHourly.metrics.temperature.rawValue > Self.severeTemperatureHigh {
            return "Extreme heat warning"
        }
        if firstHourly.metrics.temperature.rawValue < Self.severeTemperatureLow {
            return "Extreme cold warning"
        }

        // Check precipitation
        if firstDaily.forecast.precipitation.total.rawValue > Self.severePrecipitation {
            return "Heavy precipitation alert"
        }

        // Check wind
        if firstHourly.metrics.windSpeed.rawValue > Self.severeWindSpeed {
            return "High wind warning"
        }

        // Check severe weather codes
        let code = firstHourly.metrics.weatherCode.rawValue
        if code >= 95 { // Thunderstorms
            return "Thunderstorm alert"
        }

        return nil
    }

    /// Detect model divergence
    public func detectModelDivergence(forecast: AggregatedForecast) -> ModelDivergenceAlert? {
        guard let firstHourly = forecast.consensus.hourly.first else { return nil }

        let tempSpread = firstHourly.modelAgreement.temperatureStats.stdDev
        if tempSpread > Self.divergenceThreshold {
            return ModelDivergenceAlert(
                location: LocationEntity(
                    query: "Unknown",
                    resolved: GeocodingResult(
                        name: "Unknown",
                        coordinates: forecast.coordinates,
                        country: "",
                        countryCode: "",
                        region: nil,
                        timezone: TimezoneId(rawValue: "UTC"),
                        elevation: nil,
                        population: nil
                    )
                ),
                forecast: forecast,
                metric: "temperature",
                spread: tempSpread,
                timestamp: Date()
            )
        }

        return nil
    }

    // MARK: - Notification Scheduling

    /// Schedule notification for alert result
    public func scheduleNotification(for result: AlertResult) async throws {
        let content = UNMutableNotificationContent()
        content.title = result.location.name
        content.body = result.description
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.severeWeather.identifier

        // Add user info for deep linking
        content.userInfo = [
            "locationId": result.location.id.uuidString,
            "action": "viewForecast"
        ]

        // Trigger immediately for condition alerts
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)

        let request = UNNotificationRequest(
            identifier: "alert_\(result.trigger.id.uuidString)",
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    /// Schedule model divergence notification
    public func scheduleModelDivergenceNotification(for alert: ModelDivergenceAlert) async throws {
        let content = UNMutableNotificationContent()
        content.title = "Model Disagreement"
        content.body = "Weather models show significant disagreement for \(alert.location.name). \(alert.metric.capitalized) spread: ±\(Int(alert.spread))°C"
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.modelDivergence.identifier

        content.userInfo = [
            "locationId": alert.location.id.uuidString,
            "action": "compareModels"
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)

        let request = UNNotificationRequest(
            identifier: "divergence_\(alert.location.id.uuidString)_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    /// Schedule daily summary notification
    public func scheduleDailySummary(
        location: LocationEntity,
        forecast: AggregatedForecast,
        at time: DateComponents = DateComponents(hour: 7, minute: 0)
    ) async throws {
        guard let today = forecast.consensus.daily.first else { return }

        let narrative = NarrativeBuilder.generateNarrative(forecast)

        let content = UNMutableNotificationContent()
        content.title = "Daily Forecast: \(location.name)"
        content.body = narrative.headline
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.dailySummary.identifier

        content.userInfo = [
            "locationId": location.id.uuidString,
            "action": "viewForecast"
        ]

        let trigger = UNCalendarNotificationTrigger(dateMatching: time, repeats: true)

        let request = UNNotificationRequest(
            identifier: "daily_\(location.id.uuidString)",
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    /// Cancel all notifications for a location
    public func cancelNotifications(for locationId: UUID) {
        center.getPendingNotificationRequests { requests in
            let identifiers = requests
                .filter { request in
                    guard let userInfo = request.content.userInfo as? [String: String],
                          let locId = userInfo["locationId"] else {
                        return false
                    }
                    return locId == locationId.uuidString
                }
                .map { $0.identifier }

            self.center.removePendingNotificationRequests(withIdentifiers: identifiers)
        }
    }

    /// Cancel all notifications
    public func cancelAllNotifications() {
        center.removeAllPendingNotificationRequests()
    }

    // MARK: - Preview Notifications (for testing)

    /// Schedule preview notification for testing
    public func schedulePreviewNotification(
        title: String,
        body: String,
        category: NotificationCategory = .severeWeather,
        delay: TimeInterval = 5
    ) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = category.identifier

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)

        let request = UNNotificationRequest(
            identifier: "preview_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }
}

// MARK: - Deep Link Handling

/// Deep link handler for notification actions
public enum DeepLink {
    case viewForecast(locationId: UUID)
    case compareModels(locationId: UUID)

    /// Parse deep link from notification user info
    public static func parse(userInfo: [AnyHashable: Any]) -> DeepLink? {
        guard let action = userInfo["action"] as? String,
              let locationIdString = userInfo["locationId"] as? String,
              let locationId = UUID(uuidString: locationIdString) else {
            return nil
        }

        switch action {
        case "viewForecast":
            return .viewForecast(locationId: locationId)
        case "compareModels":
            return .compareModels(locationId: locationId)
        default:
            return nil
        }
    }
}
