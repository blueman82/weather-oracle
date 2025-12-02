import AppIntents
import Foundation
import SharedKit

// MARK: - Location App Entity

/// AppEntity representing a saved location for Siri shortcuts
public struct LocationAppEntity: AppEntity, Identifiable {
    public var id: UUID
    public var name: String
    public var coordinates: Coordinates
    public var country: String

    public init(id: UUID, name: String, coordinates: Coordinates, country: String) {
        self.id = id
        self.name = name
        self.coordinates = coordinates
        self.country = country
    }

    public init(from location: LocationEntity) {
        self.id = location.id
        self.name = location.name
        self.coordinates = location.coordinates
        self.country = location.resolved.country
    }

    // MARK: - AppEntity Requirements

    public static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(name: "Location")
    }

    public var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(country)"
        )
    }

    public static var defaultQuery = LocationEntityQuery()
}

// MARK: - Location Entity Query

/// EntityQuery for retrieving saved locations from CloudSyncStore
public struct LocationEntityQuery: EntityQuery {
    public init() {}

    public func entities(for identifiers: [UUID]) async throws -> [LocationAppEntity] {
        let store = CloudSyncStore()
        let locations = store.locations

        return identifiers.compactMap { id in
            guard let location = locations.first(where: { $0.id == id }) else {
                return nil
            }
            return LocationAppEntity(from: location)
        }
    }

    public func suggestedEntities() async throws -> [LocationAppEntity] {
        let store = CloudSyncStore()
        let locations = store.locations

        // Return all saved locations for suggestions
        return locations.map { LocationAppEntity(from: $0) }
    }
}

// MARK: - Forecast Intent

/// App Intent for getting weather forecast via Siri
public struct ForecastIntent: AppIntent {
    public static var title: LocalizedStringResource = "Get Weather Forecast"

    public static var description: IntentDescription? = IntentDescription(
        "Get the current weather forecast for a location",
        categoryName: "Weather",
        searchKeywords: ["weather", "forecast", "temperature", "rain"]
    )

    // MARK: - Parameters

    @Parameter(title: "Location", description: "The location to get forecast for")
    public var location: LocationAppEntity?

    public init() {}

    public init(location: LocationAppEntity?) {
        self.location = location
    }

    // MARK: - Perform

    @MainActor
    public func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        // Use provided location or first saved location
        let store = CloudSyncStore()
        let targetLocation: LocationAppEntity

        if let location = location {
            targetLocation = location
        } else {
            // Use first saved location as default
            guard let firstLocation = store.locations.first else {
                return .result(
                    value: "No locations saved",
                    dialog: "You don't have any saved locations. Please add a location in the Weather Oracle app first."
                )
            }
            targetLocation = LocationAppEntity(from: firstLocation)
        }

        // Fetch forecasts from multiple models
        let client = OpenMeteoClient()
        let models: [ModelName] = [.ecmwf, .gfs, .icon]

        do {
            let forecasts = try await client.fetchForecasts(
                models: models,
                coordinates: targetLocation.coordinates,
                forecastDays: 7,
                timezone: "auto"
            )

            // Aggregate forecasts
            let aggregated = try await AggregateService.aggregate(forecasts)

            // Build narrative summary
            let narrative = NarrativeBuilder.generateNarrative(aggregated)

            // Get current conditions
            guard let currentHourly = aggregated.consensus.hourly.first,
                  let todayDaily = aggregated.consensus.daily.first else {
                return .result(
                    value: "Forecast unavailable",
                    dialog: "Unable to retrieve forecast data for \(targetLocation.name)."
                )
            }

            let temp = Int(currentHourly.metrics.temperature.rawValue.rounded())
            let feelsLike = Int(currentHourly.metrics.feelsLike.rawValue.rounded())
            let condition = weatherDescription(currentHourly.metrics.weatherCode)
            let high = Int(todayDaily.forecast.temperature.max.rawValue.rounded())
            let low = Int(todayDaily.forecast.temperature.min.rawValue.rounded())

            // Build speakable response
            let confidence = aggregated.overallConfidence
            let confidenceText = confidence.name == .high ? "High confidence" :
                                confidence.name == .medium ? "Moderate confidence" :
                                "Low confidence"

            let response = """
            \(targetLocation.name): \(narrative.headline)

            Currently \(temp)°C, feels like \(feelsLike)°C. \(condition).
            Today's high: \(high)°C, low: \(low)°C.

            \(confidenceText) forecast from \(models.count) weather models.
            """

            let spokenResponse = """
            The weather in \(targetLocation.name): \(narrative.headline.lowercased())
            Currently \(temp) degrees celsius, feels like \(feelsLike). \(condition).
            Today's high is \(high) degrees, low is \(low) degrees.
            """

            return .result(
                value: response,
                dialog: IntentDialog(stringLiteral: spokenResponse)
            )

        } catch {
            return .result(
                value: "Error: \(error.localizedDescription)",
                dialog: "Sorry, I couldn't retrieve the forecast for \(targetLocation.name). Please try again later."
            )
        }
    }

    // MARK: - Helpers

    private func weatherDescription(_ code: WeatherCode) -> String {
        switch code {
        case .clearSky: return "Clear skies"
        case .mainlyClear: return "Mostly clear"
        case .partlyCloudy: return "Partly cloudy"
        case .overcast: return "Overcast"
        case .fog, .depositingRimeFog: return "Foggy conditions"
        case .drizzleLight, .drizzleModerate, .drizzleDense: return "Drizzle"
        case .freezingDrizzleLight, .freezingDrizzleDense: return "Freezing drizzle"
        case .rainSlight, .rainModerate: return "Rain"
        case .rainHeavy: return "Heavy rain"
        case .freezingRainLight, .freezingRainHeavy: return "Freezing rain"
        case .snowFallSlight, .snowFallModerate, .snowFallHeavy: return "Snow"
        case .snowGrains: return "Snow grains"
        case .rainShowersSlight, .rainShowersModerate, .rainShowersViolent: return "Rain showers"
        case .snowShowersSlight, .snowShowersHeavy: return "Snow showers"
        case .thunderstorm, .thunderstormSlightHail, .thunderstormHeavyHail: return "Thunderstorms"
        }
    }
}

// MARK: - App Shortcuts Provider

@available(iOS 16.0, macOS 13.0, watchOS 9.0, *)
public struct ForecastShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ForecastIntent(),
            phrases: [
                "Get weather in \(.applicationName)",
                "What's the weather in \(.applicationName)",
                "Weather forecast from \(.applicationName)",
                "Check weather with \(.applicationName)"
            ],
            shortTitle: "Get Forecast",
            systemImageName: "cloud.sun.fill"
        )
    }
}
