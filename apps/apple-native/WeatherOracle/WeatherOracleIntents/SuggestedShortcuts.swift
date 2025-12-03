import AppIntents

// MARK: - Weather Oracle Shortcuts Provider

/// Provides suggested shortcuts for the Shortcuts app
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
                    "Check weather with \(.applicationName)",
                    "Weather forecast from \(.applicationName)",
                    "Show me the \(.applicationName) forecast"
                ],
                shortTitle: "Daily Forecast",
                systemImageName: "cloud.sun.fill"
            ),

            // Model Comparison Shortcut - Temperature
            AppShortcut(
                intent: CompareIntent(),
                phrases: [
                    "Compare models in \(.applicationName)",
                    "Show model comparison in \(.applicationName)",
                    "Compare weather models in \(.applicationName)",
                    "Model disagreement in \(.applicationName)"
                ],
                shortTitle: "Compare Models",
                systemImageName: "chart.bar.xaxis"
            ),

            // Model Comparison - Temperature Specific
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .temperature),
                phrases: [
                    "Compare temperature models in \(.applicationName)",
                    "Temperature model comparison in \(.applicationName)"
                ],
                shortTitle: "Compare Temperatures",
                systemImageName: "thermometer"
            ),

            // Model Comparison - Precipitation Specific
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .precipitation),
                phrases: [
                    "Compare rain models in \(.applicationName)",
                    "Precipitation model comparison in \(.applicationName)",
                    "Will it rain according to \(.applicationName) models"
                ],
                shortTitle: "Compare Rain",
                systemImageName: "cloud.rain.fill"
            ),

            // Model Comparison - Wind Specific
            AppShortcut(
                intent: CompareIntent(location: nil, metric: .wind),
                phrases: [
                    "Compare wind models in \(.applicationName)",
                    "Wind model comparison in \(.applicationName)",
                    "How windy will it be in \(.applicationName)"
                ],
                shortTitle: "Compare Wind",
                systemImageName: "wind"
            )
        ]
    }

    // MARK: - Shortcut Groups

    public static var shortcutTileColor: ShortcutTileColor {
        .lightBlue
    }
}

// MARK: - Quick Actions (for Widgets)

/// Quick action intents for widget integration
@available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
extension WeatherOracleShortcuts {
    /// Quick actions that can be used in widgets or Spotlight
    public static var quickActions: [AppShortcut] {
        [
            AppShortcut(
                intent: ForecastIntent(),
                phrases: ["Quick forecast"],
                shortTitle: "Quick Forecast",
                systemImageName: "cloud.fill"
            )
        ]
    }
}
