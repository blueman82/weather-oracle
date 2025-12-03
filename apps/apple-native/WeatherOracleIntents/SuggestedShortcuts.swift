import AppIntents
import Foundation

// MARK: - App Shortcuts Provider

/// Provides a catalog of suggested shortcuts for common weather queries
@available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
public struct WeatherOracleShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        [
            // Daily Forecast Shortcut
            AppShortcut(
                intent: ForecastIntent(),
                phrases: [
                    "Get weather from \(.applicationName)",
                    "What's the weather in \(.applicationName)",
                    "Check the forecast in \(.applicationName)",
                    "Weather forecast from \(.applicationName)",
                    "Tell me the weather with \(.applicationName)"
                ],
                shortTitle: "Daily Forecast",
                systemImageName: "cloud.sun.fill",
                parameterSummary: "Get weather forecast for \(\.$location)"
            ),

            // Model Comparison Shortcut
            AppShortcut(
                intent: CompareIntent(),
                phrases: [
                    "Compare weather models in \(.applicationName)",
                    "Compare forecasts in \(.applicationName)",
                    "Check model agreement in \(.applicationName)",
                    "Model comparison from \(.applicationName)"
                ],
                shortTitle: "Compare Models",
                systemImageName: "chart.bar.xaxis",
                parameterSummary: "Compare \(\.$metric) for \(\.$location)"
            ),

            // Temperature Comparison
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .temperature),
                phrases: [
                    "Compare temperature forecasts in \(.applicationName)",
                    "Check temperature models in \(.applicationName)"
                ],
                shortTitle: "Compare Temperature",
                systemImageName: "thermometer",
                parameterSummary: "Compare temperature models for \(\.$location)"
            ),

            // Precipitation Comparison
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .precipitation),
                phrases: [
                    "Compare rain forecasts in \(.applicationName)",
                    "Check precipitation models in \(.applicationName)",
                    "Will it rain according to \(.applicationName)"
                ],
                shortTitle: "Compare Precipitation",
                systemImageName: "cloud.rain.fill",
                parameterSummary: "Compare precipitation models for \(\.$location)"
            ),

            // Wind Comparison
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .wind),
                phrases: [
                    "Compare wind forecasts in \(.applicationName)",
                    "Check wind models in \(.applicationName)",
                    "How windy will it be in \(.applicationName)"
                ],
                shortTitle: "Compare Wind",
                systemImageName: "wind",
                parameterSummary: "Compare wind models for \(\.$location)"
            )
        ]
    }

    public static var shortcutTileColor: ShortcutTileColor {
        .sky
    }
}

// MARK: - Shortcut Intent Categories

/// Extension for categorizing intents in Shortcuts app
public extension ForecastIntent {
    static var categoryName: String { "Weather" }

    static var suggestedInvocationPhrase: String {
        "Get my weather forecast"
    }
}

public extension CompareIntent {
    static var categoryName: String { "Weather" }

    static var suggestedInvocationPhrase: String {
        "Compare weather models"
    }
}

// MARK: - Quick Actions

/// Provides quick action suggestions for the Shortcuts widget
@available(iOS 16.4, macOS 13.3, *)
public extension WeatherOracleShortcuts {
    /// Quick actions that appear in the Shortcuts widget
    static var quickActions: [AppShortcut] {
        [
            // Quick forecast check
            AppShortcut(
                intent: ForecastIntent(),
                phrases: ["Quick forecast"],
                shortTitle: "Forecast",
                systemImageName: "cloud.sun"
            ),

            // Quick model comparison
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .temperature),
                phrases: ["Quick compare"],
                shortTitle: "Compare",
                systemImageName: "chart.bar"
            )
        ]
    }
}

// MARK: - Shortcut Groups

/// Logical grouping of shortcuts for better organization in Shortcuts app
@available(iOS 16.0, macOS 13.0, *)
public struct ShortcutGroups {
    /// Basic weather information shortcuts
    public static var basicWeather: [AppShortcut] {
        [
            AppShortcut(
                intent: ForecastIntent(),
                phrases: ["Get weather"],
                shortTitle: "Forecast",
                systemImageName: "cloud.sun.fill"
            )
        ]
    }

    /// Advanced model comparison shortcuts
    public static var modelComparison: [AppShortcut] {
        [
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .temperature),
                phrases: ["Compare temperature"],
                shortTitle: "Temperature",
                systemImageName: "thermometer"
            ),
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .precipitation),
                phrases: ["Compare rain"],
                shortTitle: "Precipitation",
                systemImageName: "cloud.rain"
            ),
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .wind),
                phrases: ["Compare wind"],
                shortTitle: "Wind",
                systemImageName: "wind"
            )
        ]
    }
}

// MARK: - Spotlight Integration

/// Makes intents discoverable through Spotlight search
@available(iOS 16.0, macOS 13.0, *)
public extension ForecastIntent {
    /// Donation for Spotlight indexing
    func donate() {
        // Donate this intent so it appears in Spotlight and Siri suggestions
        // The system will automatically handle this when the intent is performed
    }
}

@available(iOS 16.0, macOS 13.0, *)
public extension CompareIntent {
    /// Donation for Spotlight indexing
    func donate() {
        // Donate this intent so it appears in Spotlight and Siri suggestions
        // The system will automatically handle this when the intent is performed
    }
}
