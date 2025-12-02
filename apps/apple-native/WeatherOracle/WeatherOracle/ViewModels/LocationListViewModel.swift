import Combine
import Foundation
import SharedKit

// MARK: - Location Weather State

/// Weather data state for a single location
public struct LocationWeatherState: Identifiable, Sendable, Hashable {
    public static func == (lhs: LocationWeatherState, rhs: LocationWeatherState) -> Bool {
        lhs.id == rhs.id
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    public let id: UUID
    public let location: LocationEntity
    public var forecast: AggregatedForecast?
    public var isLoading: Bool
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

    /// Current temperature from consensus hourly
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
}

// MARK: - Search State

/// Search state for geocoding
public enum SearchState: Sendable {
    case idle
    case searching
    case results([GeocodingResult])
    case error(String)
}

// MARK: - Location List View Model

/// View model for the location list, manages fetching and caching weather data
@MainActor
@Observable
public final class LocationListViewModel {
    // MARK: - Published Properties

    /// Weather states for all locations (pinned + favorites)
    public private(set) var locationStates: [LocationWeatherState] = []

    /// Current location (if available)
    public private(set) var currentLocationState: LocationWeatherState?

    /// Search state
    public private(set) var searchState: SearchState = .idle

    /// Search query text
    public var searchQuery: String = "" {
        didSet {
            searchQuerySubject.send(searchQuery)
        }
    }

    /// Loading state for refresh all
    public private(set) var isRefreshing: Bool = false

    /// Global error message
    public private(set) var errorMessage: String?

    // MARK: - Dependencies

    private let client: OpenMeteoClient
    private let store: CloudSyncStore
    private let models: [ModelName]

    // MARK: - Private Properties

    private let searchQuerySubject = PassthroughSubject<String, Never>()
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Creates a new LocationListViewModel
    /// - Parameters:
    ///   - client: OpenMeteo API client
    ///   - store: Cloud sync store for preferences
    ///   - models: Weather models to fetch (defaults to all)
    public init(
        client: OpenMeteoClient = OpenMeteoClient(),
        store: CloudSyncStore,
        models: [ModelName] = ModelName.allCases
    ) {
        self.client = client
        self.store = store
        self.models = models

        setupBindings()
        loadLocations()
    }

    // MARK: - Public Methods

    /// Refresh all locations
    public func refreshAll() async {
        isRefreshing = true
        errorMessage = nil

        await withTaskGroup(of: Void.self) { group in
            // Refresh current location if available
            if let currentState = currentLocationState {
                group.addTask {
                    await self.fetchWeather(for: currentState.location)
                }
            }

            // Refresh all saved locations
            for state in locationStates {
                group.addTask {
                    await self.fetchWeather(for: state.location)
                }
            }
        }

        isRefreshing = false
    }

    /// Fetch weather for a specific location
    public func fetchWeather(for location: LocationEntity) async {
        updateLoadingState(for: location.id, isLoading: true)

        do {
            let forecasts = try await client.fetchForecasts(
                models: models,
                coordinates: location.coordinates
            )

            let aggregated = try await AggregateService.aggregate(forecasts)

            updateForecast(for: location.id, forecast: aggregated)
        } catch {
            updateError(for: location.id, error: error)
        }
    }

    /// Add a location from geocoding result
    public func addLocation(_ result: GeocodingResult) {
        let entity = LocationEntity(
            query: result.name,
            resolved: result
        )

        store.addLocation(entity)
        loadLocations()

        // Immediately fetch weather for the new location
        Task {
            await fetchWeather(for: entity)
        }
    }

    /// Remove a location
    public func removeLocation(id: UUID) {
        store.removeLocation(id: id)
        locationStates.removeAll { $0.location.id == id }
    }

    /// Reorder locations
    public func moveLocation(from source: IndexSet, to destination: Int) {
        var locations = store.locations
        locations.move(fromOffsets: source, toOffset: destination)
        store.reorderLocations(locations)
        loadLocations()
    }

    /// Search for locations
    public func search(query: String) async {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            searchState = .idle
            return
        }

        searchState = .searching

        do {
            let results = try await client.searchLocations(query: query)
            searchState = .results(results)
        } catch {
            searchState = .error(error.localizedDescription)
        }
    }

    /// Clear search results
    public func clearSearch() {
        searchQuery = ""
        searchState = .idle
    }

    /// Set current location (from CoreLocation)
    public func setCurrentLocation(_ location: LocationEntity) {
        currentLocationState = LocationWeatherState(
            location: location,
            isLoading: false
        )

        Task {
            await fetchWeather(for: location)
        }
    }

    // MARK: - Private Methods

    private func setupBindings() {
        // Debounce search queries
        searchQuerySubject
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .removeDuplicates()
            .sink { [weak self] query in
                guard let self else { return }
                Task {
                    await self.search(query: query)
                }
            }
            .store(in: &cancellables)

        // Listen for preference changes
        store.changePublisher
            .filter { $0.key == .locations }
            .sink { [weak self] _ in
                self?.loadLocations()
            }
            .store(in: &cancellables)
    }

    private func loadLocations() {
        let storedLocations = store.locations

        // Update or create states for stored locations
        var newStates: [LocationWeatherState] = []

        for location in storedLocations {
            if let existingState = locationStates.first(where: { $0.location.id == location.id }) {
                newStates.append(existingState)
            } else {
                newStates.append(LocationWeatherState(location: location))
            }
        }

        locationStates = newStates
    }

    private func updateLoadingState(for locationId: UUID, isLoading: Bool) {
        if let index = locationStates.firstIndex(where: { $0.location.id == locationId }) {
            locationStates[index] = LocationWeatherState(
                id: locationStates[index].id,
                location: locationStates[index].location,
                forecast: locationStates[index].forecast,
                isLoading: isLoading,
                error: nil,
                lastUpdated: locationStates[index].lastUpdated
            )
        } else if currentLocationState?.location.id == locationId {
            currentLocationState = LocationWeatherState(
                id: currentLocationState!.id,
                location: currentLocationState!.location,
                forecast: currentLocationState!.forecast,
                isLoading: isLoading,
                error: nil,
                lastUpdated: currentLocationState!.lastUpdated
            )
        }
    }

    private func updateForecast(for locationId: UUID, forecast: AggregatedForecast) {
        if let index = locationStates.firstIndex(where: { $0.location.id == locationId }) {
            locationStates[index] = LocationWeatherState(
                id: locationStates[index].id,
                location: locationStates[index].location,
                forecast: forecast,
                isLoading: false,
                error: nil,
                lastUpdated: Date()
            )
        } else if currentLocationState?.location.id == locationId {
            currentLocationState = LocationWeatherState(
                id: currentLocationState!.id,
                location: currentLocationState!.location,
                forecast: forecast,
                isLoading: false,
                error: nil,
                lastUpdated: Date()
            )
        }
    }

    private func updateError(for locationId: UUID, error: Error) {
        if let index = locationStates.firstIndex(where: { $0.location.id == locationId }) {
            locationStates[index] = LocationWeatherState(
                id: locationStates[index].id,
                location: locationStates[index].location,
                forecast: locationStates[index].forecast,
                isLoading: false,
                error: error,
                lastUpdated: locationStates[index].lastUpdated
            )
        } else if currentLocationState?.location.id == locationId {
            currentLocationState = LocationWeatherState(
                id: currentLocationState!.id,
                location: currentLocationState!.location,
                forecast: currentLocationState!.forecast,
                isLoading: false,
                error: error,
                lastUpdated: currentLocationState!.lastUpdated
            )
        }
    }
}

// MARK: - Sample Data Provider

#if DEBUG
public extension LocationListViewModel {
    /// Creates a view model with sample data for previews
    static func preview(store: CloudSyncStore) -> LocationListViewModel {
        let viewModel = LocationListViewModel(store: store)

        // Add sample location states
        let sampleLocations = [
            sampleLocationEntity(name: "San Francisco", lat: 37.7749, lon: -122.4194),
            sampleLocationEntity(name: "New York", lat: 40.7128, lon: -74.0060),
            sampleLocationEntity(name: "London", lat: 51.5074, lon: -0.1278),
        ]

        viewModel.locationStates = sampleLocations.map { location in
            LocationWeatherState(
                location: location,
                forecast: nil,
                isLoading: false,
                error: nil,
                lastUpdated: Date()
            )
        }

        return viewModel
    }

    private static func sampleLocationEntity(name: String, lat: Double, lon: Double) -> LocationEntity {
        LocationEntity(
            query: name,
            resolved: GeocodingResult(
                name: name,
                coordinates: Coordinates(
                    latitude: Latitude(rawValue: lat)!,
                    longitude: Longitude(rawValue: lon)!
                ),
                country: "Sample Country",
                countryCode: "SC",
                timezone: TimezoneId(rawValue: "UTC")
            )
        )
    }
}
#endif
