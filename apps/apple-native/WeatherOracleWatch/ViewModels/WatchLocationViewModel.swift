import Foundation
import SharedKit
import Combine

// MARK: - Watch Location View Model

/// Simplified view model for watchOS optimized for smaller screen and reduced interactions
@MainActor
@Observable
public final class WatchLocationViewModel {
    // MARK: - Properties

    private let client: OpenMeteoClient
    private let store: CloudSyncStore
    private let models: [ModelName]

    public private(set) var locations: [LocationEntity] = []
    public private(set) var selectedLocation: LocationEntity?
    public private(set) var forecast: AggregatedForecast?
    public private(set) var isLoading: Bool = false
    public private(set) var error: Error?
    public private(set) var lastUpdated: Date?

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(
        client: OpenMeteoClient = OpenMeteoClient(),
        store: CloudSyncStore,
        models: [ModelName] = [.ecmwf, .gfs, .icon]
    ) {
        self.client = client
        self.store = store
        self.models = models

        // Load locations from store
        loadLocations()

        // Observe location changes from iPhone
        store.changePublisher
            .sink { [weak self] change in
                if change.key == .locations {
                    self?.loadLocations()
                }
            }
            .store(in: &cancellables)

        // Select first location by default
        if let first = locations.first {
            selectLocation(first)
        }
    }

    // MARK: - Location Management

    private func loadLocations() {
        locations = store.locations

        // Reselect if current selection is gone
        if let selected = selectedLocation,
           !locations.contains(where: { $0.id == selected.id }) {
            selectedLocation = locations.first
        } else if selectedLocation == nil {
            selectedLocation = locations.first
        }

        // Fetch forecast for selected location
        if let location = selectedLocation {
            Task {
                await fetchForecast(for: location)
            }
        }
    }

    public func selectLocation(_ location: LocationEntity) {
        guard location.id != selectedLocation?.id else { return }

        selectedLocation = location
        forecast = nil
        error = nil

        Task {
            await fetchForecast(for: location)
        }
    }

    // MARK: - Weather Fetching

    public func fetchForecast(for location: LocationEntity) async {
        isLoading = true
        error = nil

        do {
            // Fetch forecasts from multiple models
            let forecasts = try await client.fetchForecasts(
                models: models,
                coordinates: location.coordinates,
                forecastDays: 3, // Fewer days for watch
                timezone: location.timezone.rawValue
            )

            // Aggregate forecasts
            let aggregated = try await AggregateService.aggregate(forecasts)

            forecast = aggregated
            lastUpdated = Date()
        } catch {
            self.error = error
        }

        isLoading = false
    }

    public func refresh() async {
        guard let location = selectedLocation else { return }
        await fetchForecast(for: location)
    }

    // MARK: - Computed Properties

    public var currentTemperature: Celsius? {
        forecast?.consensus.hourly.first?.metrics.temperature
    }

    public var currentWeatherCode: WeatherCode? {
        forecast?.consensus.hourly.first?.metrics.weatherCode
    }

    public var todayHigh: Celsius? {
        forecast?.consensus.daily.first?.forecast.temperature.max
    }

    public var todayLow: Celsius? {
        forecast?.consensus.daily.first?.forecast.temperature.min
    }

    public var todayCondition: String {
        guard let code = currentWeatherCode else { return "Unknown" }
        return weatherDescription(code)
    }

    // MARK: - Helpers

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
