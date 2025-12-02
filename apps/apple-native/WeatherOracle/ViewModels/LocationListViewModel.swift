import Foundation
import SharedKit
import SwiftUI
import Combine

// MARK: - Location Weather State

/// State for a single location's weather data
@Observable
public final class LocationWeatherState: Identifiable, Hashable {
    public let id: UUID
    public let location: LocationEntity
    public var forecast: AggregatedForecast?
    public var isLoading: Bool = false
    public var error: Error?
    public var lastUpdated: Date?

    public init(
        id: UUID = UUID(),
        location: LocationEntity,
        forecast: AggregatedForecast? = nil,
        isLoading: Bool = false,
        error: Error? = nil,
        lastUpdated: Date? = nil
    ) {
        self.id = id
        self.location = location
        self.forecast = forecast
        self.isLoading = isLoading
        self.error = error
        self.lastUpdated = lastUpdated
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

    // MARK: - Hashable & Equatable

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: LocationWeatherState, rhs: LocationWeatherState) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Search State

public enum SearchState: Equatable {
    case idle
    case searching
    case results([GeocodingResult])
    case error(String)
}

// MARK: - Location List View Model

/// View model for managing location list and weather data
@MainActor
@Observable
public final class LocationListViewModel {
    // MARK: - Properties

    private let client: OpenMeteoClient
    private let store: CloudSyncStore
    private let models: [ModelName]

    public private(set) var locationStates: [LocationWeatherState] = []
    public private(set) var currentLocationState: LocationWeatherState?
    public private(set) var isRefreshing: Bool = false

    // Search
    public var searchQuery: String = "" {
        didSet {
            if searchQuery != oldValue {
                scheduleSearch()
            }
        }
    }
    public private(set) var searchState: SearchState = .idle

    private var searchTask: Task<Void, Never>?
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

        // Load existing locations from store
        loadLocations()

        // Observe preference changes
        store.changePublisher
            .sink { [weak self] change in
                if change.key == .locations {
                    self?.loadLocations()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Location Management

    public func addLocation(_ result: GeocodingResult) {
        let location = LocationEntity(query: result.name, resolved: result)
        store.addLocation(location)

        let state = LocationWeatherState(location: location)
        locationStates.append(state)

        // Fetch weather for new location
        Task {
            await fetchWeather(for: location)
        }
    }

    public func removeLocation(id: UUID) {
        store.removeLocation(id: id)
        locationStates.removeAll { $0.id == id }
    }

    public func moveLocation(from source: IndexSet, to destination: Int) {
        locationStates.move(fromOffsets: source, toOffset: destination)

        // Update store order
        let locations = locationStates.map { $0.location }
        store.reorderLocations(locations)
    }

    public func setCurrentLocation(_ location: LocationEntity) {
        currentLocationState = LocationWeatherState(location: location)

        Task {
            await fetchWeather(for: location, isCurrent: true)
        }
    }

    private func loadLocations() {
        let storedLocations = store.locations

        // Update states, preserving existing forecasts where possible
        let newStates: [LocationWeatherState] = storedLocations.map { location in
            if let existing = locationStates.first(where: { $0.location.id == location.id }) {
                return existing
            } else {
                return LocationWeatherState(location: location)
            }
        }

        locationStates = newStates

        // Fetch weather for any locations without data
        Task {
            for state in locationStates where state.forecast == nil && !state.isLoading {
                await fetchWeather(for: state.location)
            }
        }
    }

    // MARK: - Weather Fetching

    public func fetchWeather(for location: LocationEntity, isCurrent: Bool = false) async {
        let state = isCurrent ? currentLocationState : locationStates.first { $0.location.id == location.id }
        guard let state else { return }

        state.isLoading = true
        state.error = nil

        do {
            // Fetch forecasts from multiple models
            let forecasts = try await client.fetchForecasts(
                models: models,
                coordinates: location.coordinates,
                forecastDays: 7,
                timezone: location.timezone.rawValue
            )

            // Aggregate forecasts
            let aggregated = try await AggregateService.aggregate(forecasts)

            state.forecast = aggregated
            state.lastUpdated = Date()
        } catch {
            state.error = error
        }

        state.isLoading = false
    }

    public func refreshAll() async {
        isRefreshing = true

        // Refresh current location if set
        if let current = currentLocationState {
            await fetchWeather(for: current.location, isCurrent: true)
        }

        // Refresh all saved locations concurrently
        await withTaskGroup(of: Void.self) { group in
            for state in locationStates {
                group.addTask {
                    await self.fetchWeather(for: state.location)
                }
            }
        }

        isRefreshing = false
    }

    // MARK: - Search

    private func scheduleSearch() {
        // Cancel existing search
        searchTask?.cancel()

        guard !searchQuery.isEmpty else {
            searchState = .idle
            return
        }

        // Debounce search with 300ms delay
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)

            guard !Task.isCancelled else { return }

            await performSearch()
        }
    }

    private func performSearch() async {
        guard !searchQuery.isEmpty else {
            searchState = .idle
            return
        }

        searchState = .searching

        do {
            let results = try await client.searchLocations(query: searchQuery, count: 10)
            searchState = .results(results)
        } catch {
            searchState = .error(error.localizedDescription)
        }
    }

    public func clearSearch() {
        searchTask?.cancel()
        searchQuery = ""
        searchState = .idle
    }
}
