import SharedKit
import SwiftUI

// MARK: - LocationListView

/// Apple Weather-style location stack view
/// Uses NavigationStack on iPhone, sidebar split on iPad
public struct LocationListView: View {
    @Bindable var viewModel: LocationListViewModel
    @Binding var deepLinkLocationId: UUID?
    @State private var showAddLocation = false
    @State private var editMode: EditMode = .inactive
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    public init(viewModel: LocationListViewModel, deepLinkLocationId: Binding<UUID?> = .constant(nil)) {
        self.viewModel = viewModel
        _deepLinkLocationId = deepLinkLocationId
    }

    public var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                iPadLayout
            } else {
                iPhoneLayout
            }
        }
        .sheet(isPresented: $showAddLocation) {
            AddLocationView(viewModel: viewModel, isPresented: $showAddLocation)
        }
        .onChange(of: deepLinkLocationId) { _, newLocationId in
            guard let locationId = newLocationId else {
                return
            }

            // Find and set the current location from the deep link
            if let matchingState = viewModel.locationStates.first(where: { $0.location.id == locationId }) {
                viewModel.setCurrentLocation(matchingState.location)
            }

            // Clear the deep link after handling
            deepLinkLocationId = nil
        }
    }

    // MARK: - iPhone Layout

    private var iPhoneLayout: some View {
        NavigationStack {
            locationList
                .navigationTitle("Weather")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        EditButton()
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        addButton
                    }
                }
                .environment(\.editMode, $editMode)
                .refreshable {
                    await viewModel.refreshAll()
                }
        }
    }

    // MARK: - iPad Layout

    private var iPadLayout: some View {
        NavigationSplitView {
            locationList
                .navigationTitle("Locations")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        EditButton()
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        addButton
                    }
                }
                .environment(\.editMode, $editMode)
        } detail: {
            if let firstState = viewModel.currentLocationState ?? viewModel.locationStates.first {
                LocationDetailView(viewModel: viewModel, stateId: firstState.id)
            } else {
                ContentUnavailableView(
                    "No Location Selected",
                    systemImage: "location.slash",
                    description: Text("Add a location to see weather details")
                )
            }
        }
        .refreshable {
            await viewModel.refreshAll()
        }
    }

    // MARK: - Location List

    private var locationList: some View {
        List {
            // Current Location Section
            if let currentState = viewModel.currentLocationState {
                Section {
                    LocationRowView(state: currentState, isCurrentLocation: true)
                } header: {
                    Label("Current Location", systemImage: "location.fill")
                }
            }

            // Favorites Section
            Section {
                ForEach(viewModel.locationStates) { state in
                    NavigationLink(value: state) {
                        LocationRowView(state: state, isCurrentLocation: false)
                    }
                }
                .onDelete(perform: deleteLocations)
                .onMove(perform: moveLocations)
            } header: {
                if !viewModel.locationStates.isEmpty {
                    Label("Favorites", systemImage: "star.fill")
                }
            }

            // Empty State
            if viewModel.locationStates.isEmpty, viewModel.currentLocationState == nil {
                ContentUnavailableView(
                    "No Locations",
                    systemImage: "cloud.sun",
                    description: Text("Tap + to add your first location")
                )
            }
        }
        .listStyle(.insetGrouped)
        .navigationDestination(for: LocationWeatherState.self) { state in
            LocationDetailView(viewModel: viewModel, stateId: state.id)
        }
        .overlay {
            if viewModel.isRefreshing {
                ProgressView()
                    .scaleEffect(1.5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.ultraThinMaterial)
            }
        }
    }

    // MARK: - Toolbar Items

    private var addButton: some View {
        Button {
            showAddLocation = true
        } label: {
            Image(systemName: "plus")
        }
        .accessibilityLabel("Add location")
    }

    // MARK: - Actions

    private func deleteLocations(at offsets: IndexSet) {
        for index in offsets {
            let state = viewModel.locationStates[index]
            viewModel.removeLocation(id: state.location.id)
        }
    }

    private func moveLocations(from source: IndexSet, to destination: Int) {
        viewModel.moveLocation(from: source, to: destination)
    }
}

// MARK: - LocationRowView

struct LocationRowView: View {
    let state: LocationWeatherState
    let isCurrentLocation: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Location Info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    if isCurrentLocation {
                        Image(systemName: "location.fill")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(state.location.name)
                        .font(.headline)
                }

                if let region = state.location.resolved.region {
                    Text("\(region), \(state.location.resolved.country)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text(state.location.resolved.country)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Weather Info
            if state.isLoading {
                ProgressView()
            } else if state.error != nil {
                Image(systemName: "exclamationmark.triangle")
                    .foregroundStyle(.orange)
            } else {
                weatherInfo
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var weatherInfo: some View {
        HStack(spacing: 16) {
            // Weather Icon
            if let code = state.currentWeatherCode {
                // Get sunrise/sunset from today's daily forecast for time-aware icons
                let todaySun = state.forecast?.consensus.daily.first?.forecast.sun
                Image(systemName: code.systemImageName(at: Date(), sunrise: todaySun?.sunrise, sunset: todaySun?.sunset))
                    .font(.title2)
                    .symbolRenderingMode(.multicolor)
            }

            // Temperature
            VStack(alignment: .trailing, spacing: 2) {
                if let temp = state.currentTemperature {
                    Text(formatTemperature(temp))
                        .font(.title2)
                        .fontWeight(.medium)
                }

                if let high = state.todayHigh, let low = state.todayLow {
                    Text("H: \(formatTemperature(high)) L: \(formatTemperature(low))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func formatTemperature(_ celsius: Celsius) -> String {
        "\(Int(celsius.rawValue.rounded()))\u{00B0}"
    }
}

// MARK: - LocationDetailView

struct LocationDetailView: View {
    @Bindable var viewModel: LocationListViewModel
    let stateId: UUID

    private var state: LocationWeatherState? {
        viewModel.locationStates.first(where: { $0.id == stateId })
            ?? viewModel.currentLocationState
    }

    var body: some View {
        ZStack {
            // Background layer - animated weather background
            if let currentState = state, let weatherCode = currentState.currentWeatherCode {
                let todaySun = currentState.forecast?.consensus.daily.first?.forecast.sun
                WeatherBackgroundView(
                    weatherCode: weatherCode,
                    timestamp: Date(),
                    sunrise: todaySun?.sunrise,
                    sunset: todaySun?.sunset
                )
                .ignoresSafeArea()
            }

            // Foreground layer - existing ScrollView with forecast data
            ScrollView {
                VStack(spacing: 24) {
                    if let state, state.isLoading {
                        // Loading state
                        VStack(spacing: 16) {
                            ProgressView()
                                .scaleEffect(1.5)
                            Text("Loading forecast...")
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 100)
                    } else if let state, let error = state.error {
                        // Error state
                        VStack(spacing: 16) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 48))
                                .foregroundStyle(.orange)
                            Text("Failed to load forecast")
                                .font(.headline)
                            Text(error.localizedDescription)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 100)
                    } else if let currentState = state, currentState.forecast != nil {
                        // Header
                        headerSection(state: currentState)

                        // Hourly Forecast
                        if let hourly = currentState.forecast?.consensus.hourly, !hourly.isEmpty {
                            hourlySection(hourly: hourly)
                        }

                        // Daily Forecast
                        if let daily = currentState.forecast?.consensus.daily, !daily.isEmpty {
                            dailySection(daily: daily)
                        }

                        // Confidence Indicator
                        if let confidence = currentState.forecast?.overallConfidence {
                            confidenceSection(confidence: confidence)
                        }
                    } else {
                        // No data yet - show placeholder
                        VStack(spacing: 16) {
                            Image(systemName: "cloud.sun")
                                .font(.system(size: 48))
                                .foregroundStyle(.secondary)
                            Text("No forecast data")
                                .font(.headline)
                            Text("Pull to refresh")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 100)
                    }
                }
                .padding()
            }
        }
        .navigationTitle(state?.location.name ?? "Location")
        .navigationBarTitleDisplayMode(.large)
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Sections

    private func headerSection(state: LocationWeatherState) -> some View {
        VStack(spacing: 8) {
            if let code = state.currentWeatherCode {
                // Get sunrise/sunset from today's daily forecast for time-aware icons
                let todaySun = state.forecast?.consensus.daily.first?.forecast.sun
                Image(systemName: code.systemImageName(at: Date(), sunrise: todaySun?.sunrise, sunset: todaySun?.sunset))
                    .font(.system(size: 64))
                    .symbolRenderingMode(.multicolor)
            }

            if let temp = state.currentTemperature {
                Text("\(Int(temp.rawValue.rounded()))\u{00B0}")
                    .font(.system(size: 72, weight: .thin))
            }

            if let code = state.currentWeatherCode {
                Text(code.description)
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            if let high = state.todayHigh, let low = state.todayLow {
                Text("H: \(Int(high.rawValue.rounded()))\u{00B0}  L: \(Int(low.rawValue.rounded()))\u{00B0}")
                    .font(.title3)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }

    private func hourlySection(hourly: [AggregatedHourlyForecast]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Hourly Forecast", systemImage: "clock")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 20) {
                    ForEach(hourly.prefix(24)) { hour in
                        VStack(spacing: 8) {
                            Text(formatHour(hour.timestamp))
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            // Find the daily forecast for this hour's date to get sunrise/sunset
                            if let state, let daily = state.forecast?.consensus.daily {
                                let hourDate = Calendar.current.startOfDay(for: hour.timestamp)
                                let matchingDay = daily.first { Calendar.current.startOfDay(for: $0.date) == hourDate }
                                let sunTimes = matchingDay?.forecast.sun
                                Image(systemName: hour.metrics.weatherCode.systemImageName(at: hour.timestamp, sunrise: sunTimes?.sunrise, sunset: sunTimes?.sunset))
                                    .symbolRenderingMode(.multicolor)
                            } else {
                                Image(systemName: hour.metrics.weatherCode.systemImageName)
                                    .symbolRenderingMode(.multicolor)
                            }

                            Text("\(Int(hour.metrics.temperature.rawValue.rounded()))\u{00B0}")
                                .font(.callout)
                                .fontWeight(.medium)
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func dailySection(daily: [AggregatedDailyForecast]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("10-Day Forecast", systemImage: "calendar")
                .font(.headline)

            VStack(spacing: 0) {
                ForEach(daily) { day in
                    HStack {
                        Text(formatDay(day.date))
                            .frame(width: 80, alignment: .leading)

                        // Use midday for daily forecast icon with day's sunrise/sunset
                        let middayDate = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: day.date) ?? day.date
                        Image(systemName: day.forecast.weatherCode.systemImageName(at: middayDate, sunrise: day.forecast.sun.sunrise, sunset: day.forecast.sun.sunset))
                            .symbolRenderingMode(.multicolor)
                            .frame(width: 30)

                        Spacer()

                        Text("\(Int(day.forecast.temperature.min.rawValue.rounded()))\u{00B0}")
                            .foregroundStyle(.secondary)
                            .frame(width: 40, alignment: .trailing)

                        temperatureBar(
                            low: day.forecast.temperature.min.rawValue,
                            high: day.forecast.temperature.max.rawValue
                        )
                        .frame(width: 100)

                        Text("\(Int(day.forecast.temperature.max.rawValue.rounded()))\u{00B0}")
                            .frame(width: 40, alignment: .trailing)
                    }
                    .padding(.vertical, 8)

                    if day.id != daily.last?.id {
                        Divider()
                    }
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func confidenceSection(confidence: ConfidenceLevel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Forecast Confidence", systemImage: "chart.bar.fill")
                .font(.headline)

            HStack {
                Text(confidence.level.rawValue.capitalized)
                    .font(.title3)
                    .fontWeight(.medium)

                Spacer()

                Text("\(Int(confidence.score * 100))%")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: confidence.score)
                .tint(confidenceColor(for: confidence.level))
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Helpers

    private func formatHour(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "ha"
        return formatter.string(from: date)
    }

    private func formatDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            return "Today"
        }

        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    private func temperatureBar(low: Double, high: Double) -> some View {
        GeometryReader { geometry in
            RoundedRectangle(cornerRadius: 3)
                .fill(
                    LinearGradient(
                        colors: [.blue, .green, .yellow, .orange],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: geometry.size.width * 0.6)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .frame(height: 6)
    }

    private func confidenceColor(for level: ConfidenceLevelName) -> Color {
        switch level {
        case .high: .green
        case .medium: .yellow
        case .low: .orange
        }
    }
}

// MARK: - Previews

#if DEBUG
    #Preview("iPhone") {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel.preview(store: store)
        return LocationListView(viewModel: viewModel)
    }

    #Preview("iPad") {
        let store = CloudSyncStore(store: InMemoryKeyValueStore())
        let viewModel = LocationListViewModel.preview(store: store)
        return LocationListView(viewModel: viewModel)
    }
#endif
