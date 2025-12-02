import AppIntents
import SwiftUI

struct GetWeatherIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Weather"
    static var description = IntentDescription("Get the current weather forecast")

    @Parameter(title: "Location")
    var location: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Get weather for \(\.$location)")
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let locationName = location ?? "current location"
        let result = "72°F and sunny in \(locationName)"
        return .result(
            value: result,
            dialog: IntentDialog("It's \(result)")
        )
    }
}

struct WeatherOracleShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GetWeatherIntent(),
            phrases: [
                "Get weather from \(.applicationName)",
                "What's the weather in \(.applicationName)",
                "Check \(.applicationName) forecast"
            ],
            shortTitle: "Get Weather",
            systemImageName: "cloud.sun"
        )
    }
}
