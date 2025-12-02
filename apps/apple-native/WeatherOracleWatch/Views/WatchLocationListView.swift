import SwiftUI
import SharedKit

// MARK: - Watch Location List View

/// Simplified location list for watchOS with Digital Crown navigation
public struct WatchLocationListView: View {
    @Bindable var viewModel: WatchLocationViewModel
    @State private var selectedIndex: Int = 0

    public init(viewModel: WatchLocationViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            Group {
                if viewModel.locations.isEmpty {
                    emptyStateView
                } else {
                    locationList
                }
            }
            .navigationTitle("Locations")
            .navigationBarTitleDisplayMode(.inline)
            .accessibilityLabel("Weather Locations")
        }
    }

    // MARK: - Location List

    private var locationList: some View {
        List {
            ForEach(Array(viewModel.locations.enumerated()), id: \.element.id) { index, location in
                NavigationLink(value: location) {
                    locationRow(location)
                }
                .listRowBackground(
                    selectedIndex == index ? Color.blue.opacity(0.2) : Color.clear
                )
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Location: \(location.name)")
                .accessibilityValue(
                    location.id == viewModel.selectedLocation?.id ? "Selected" : "Not selected"
                )
                .accessibilityHint("Double tap to view detailed forecast")
            }
        }
        .focusable()
        .digitalCrownRotation(
            $selectedIndex,
            from: 0,
            through: max(0, viewModel.locations.count - 1),
            by: 1,
            sensitivity: .medium,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .onChange(of: selectedIndex) { oldValue, newValue in
            if newValue >= 0 && newValue < viewModel.locations.count {
                let location = viewModel.locations[newValue]
                viewModel.selectLocation(location)
                // Haptic feedback on selection change
                WKInterfaceDevice.current().play(.click)
            }
        }
        .navigationDestination(for: LocationEntity.self) { location in
            WatchForecastDetailView(viewModel: viewModel, location: location)
        }
        .accessibilityHint("Use Digital Crown to navigate locations. Double tap to view details.")
    }

    private func locationRow(_ location: LocationEntity) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(location.name)
                .font(.headline)
                .accessibilityLabel("Location name")
                .accessibilityValue(location.name)

            if location.id == viewModel.selectedLocation?.id {
                HStack(spacing: 4) {
                    if let temp = viewModel.currentTemperature {
                        Text("\(Int(temp.rawValue.rounded()))°")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .accessibilityLabel("Current temperature")
                            .accessibilityValue("\(Int(temp.rawValue.rounded())) degrees")
                    }

                    if let condition = viewModel.todayCondition as String? {
                        Text(condition)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel("Weather condition")
                            .accessibilityValue(condition)
                    }
                }
                .accessibilityElement(children: .combine)
            } else {
                Text("Tap to load")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Status")
                    .accessibilityValue("Tap to load forecast")
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 12) {
            Image(systemName: "location.slash")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
                .accessibilityLabel("No location icon")
                .accessibilityHidden(true)

            Text("No Locations")
                .font(.headline)
                .accessibilityLabel("No locations available")

            Text("Add locations on your iPhone")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .accessibilityLabel("Instructions")
                .accessibilityValue("Add locations using your iPhone app")
        }
        .padding()
        .accessibilityElement(children: .combine)
        .accessibilityHint("Locations you add on your iPhone will appear here")
    }
}
