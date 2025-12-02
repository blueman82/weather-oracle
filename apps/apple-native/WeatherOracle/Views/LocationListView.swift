import SwiftUI
import SharedKit

// MARK: - Location List View

/// Apple Weather-style location list with stack layout
public struct LocationListView: View {
    @Bindable var viewModel: LocationListViewModel
    @State private var showingAddLocation = false

    public init(viewModel: LocationListViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Current location section
                    if let currentState = viewModel.currentLocationState {
                        currentLocationCard(currentState)
                            .padding(.horizontal)
                            .padding(.top)
                    }

                    // Saved locations
                    if !viewModel.locationStates.isEmpty {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.locationStates) { state in
                                locationCard(state)
                            }
                        }
                        .padding()
                    } else {
                        emptyState
                            .padding(.top, 60)
                    }
                }
            }
            .refreshable {
                await viewModel.refreshAll()
            }
            .navigationTitle("Weather Oracle")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddLocation = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }

                ToolbarItem(placement: .secondaryAction) {
                    EditButton()
                }
            }
            .sheet(isPresented: $showingAddLocation) {
                AddLocationView(viewModel: viewModel)
            }
        }
    }

    // MARK: - Subviews

    private func currentLocationCard(_ state: LocationWeatherState) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "location.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text("Current Location")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()
            }

            weatherCard(state, isPrimary: true)
        }
    }

    private func locationCard(_ state: LocationWeatherState) -> some View {
        weatherCard(state, isPrimary: false)
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                Button(role: .destructive) {
                    withAnimation {
                        viewModel.removeLocation(id: state.id)
                    }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
    }

    private func weatherCard(_ state: LocationWeatherState, isPrimary: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Location name and time
            HStack {
                Text(state.location.name)
                    .font(isPrimary ? .title : .headline)
                    .fontWeight(isPrimary ? .bold : .semibold)

                Spacer()

                if let updated = state.lastUpdated {
                    Text(updated, style: .time)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if state.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 40)
            } else if let error = state.error {
                errorView(error)
            } else if let forecast = state.forecast {
                forecastSummary(forecast)
            } else {
                Text("Tap to load weather")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 40)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }

    private func forecastSummary(_ forecast: AggregatedForecast) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Current conditions
            if let current = forecast.consensus.hourly.first {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(Int(current.metrics.temperature.rawValue.rounded()))°")
                            .font(.system(size: 64, weight: .thin))

                        Text(weatherDescription(current.metrics.weatherCode))
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 8) {
                        if let daily = forecast.consensus.daily.first {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.up")
                                    .font(.caption)
                                Text("\(Int(daily.forecast.temperature.max.rawValue.rounded()))°")
                            }
                            .foregroundStyle(.red)

                            HStack(spacing: 4) {
                                Image(systemName: "arrow.down")
                                    .font(.caption)
                                Text("\(Int(daily.forecast.temperature.min.rawValue.rounded()))°")
                            }
                            .foregroundStyle(.blue)
                        }
                    }
                }
            }

            // Hourly preview (next 6 hours)
            if !forecast.consensus.hourly.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 16) {
                        ForEach(forecast.consensus.hourly.prefix(6)) { hourly in
                            hourlyCell(hourly)
                        }
                    }
                }
            }

            // Daily preview
            if forecast.consensus.daily.count > 1 {
                Divider()

                VStack(spacing: 8) {
                    ForEach(forecast.consensus.daily.prefix(5)) { daily in
                        dailyRow(daily)
                    }
                }
            }
        }
    }

    private func hourlyCell(_ hourly: AggregatedHourlyForecast) -> some View {
        VStack(spacing: 8) {
            Text(hourly.timestamp, style: .time)
                .font(.caption)
                .foregroundStyle(.secondary)

            Image(systemName: weatherIcon(hourly.metrics.weatherCode))
                .font(.title3)
                .symbolRenderingMode(.multicolor)

            Text("\(Int(hourly.metrics.temperature.rawValue.rounded()))°")
                .font(.subheadline)
        }
        .frame(width: 60)
    }

    private func dailyRow(_ daily: AggregatedDailyForecast) -> some View {
        HStack {
            Text(daily.date, format: .dateTime.weekday(.abbreviated))
                .font(.subheadline)
                .frame(width: 40, alignment: .leading)

            Image(systemName: weatherIcon(daily.forecast.weatherCode))
                .font(.body)
                .symbolRenderingMode(.multicolor)
                .frame(width: 30)

            Spacer()

            // Temperature bar
            HStack(spacing: 4) {
                Text("\(Int(daily.forecast.temperature.min.rawValue.rounded()))°")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(width: 35, alignment: .trailing)

                temperatureBar(min: daily.forecast.temperature.min.rawValue,
                             max: daily.forecast.temperature.max.rawValue)
                    .frame(width: 80)

                Text("\(Int(daily.forecast.temperature.max.rawValue.rounded()))°")
                    .font(.subheadline)
                    .frame(width: 35, alignment: .leading)
            }
        }
    }

    private func temperatureBar(min: Double, max: Double) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background
                Capsule()
                    .fill(Color.secondary.opacity(0.2))

                // Temperature range indicator
                Capsule()
                    .fill(LinearGradient(
                        colors: [.blue, .orange, .red],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: geometry.size.width * 0.7)
            }
        }
        .frame(height: 4)
    }

    private func errorView(_ error: Error) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)

            Text("Failed to load weather")
                .font(.headline)

            Text(error.localizedDescription)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 20)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "location.slash")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)

            Text("No Locations")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Add a location to see weather forecasts")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                showingAddLocation = true
            } label: {
                Label("Add Location", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding()
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

    private func weatherIcon(_ code: WeatherCode) -> String {
        switch code {
        case .clearSky: return "sun.max.fill"
        case .mainlyClear: return "sun.max"
        case .partlyCloudy: return "cloud.sun.fill"
        case .overcast: return "cloud.fill"
        case .fog, .depositingRimeFog: return "cloud.fog.fill"
        case .drizzleLight, .drizzleModerate, .drizzleDense: return "cloud.drizzle.fill"
        case .freezingDrizzleLight, .freezingDrizzleDense: return "cloud.sleet.fill"
        case .rainSlight, .rainModerate: return "cloud.rain.fill"
        case .rainHeavy: return "cloud.heavyrain.fill"
        case .freezingRainLight, .freezingRainHeavy: return "cloud.sleet.fill"
        case .snowFallSlight, .snowFallModerate, .snowFallHeavy: return "cloud.snow.fill"
        case .snowGrains: return "cloud.snow"
        case .rainShowersSlight, .rainShowersModerate, .rainShowersViolent: return "cloud.rain.fill"
        case .snowShowersSlight, .snowShowersHeavy: return "cloud.snow.fill"
        case .thunderstorm, .thunderstormSlightHail, .thunderstormHeavyHail: return "cloud.bolt.rain.fill"
        }
    }
}

// MARK: - Preview

#Preview {
    LocationListView(viewModel: LocationListViewModel(
        store: CloudSyncStore(store: InMemoryKeyValueStore())
    ))
}
