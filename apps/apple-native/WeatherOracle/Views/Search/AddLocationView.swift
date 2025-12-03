import SwiftUI
import SharedKit

// MARK: - Add Location View

/// Search and add location interface with geocoding
public struct AddLocationView: View {
    @Bindable var viewModel: LocationListViewModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isSearchFocused: Bool

    public init(viewModel: LocationListViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                searchBar
                    .padding()

                Divider()

                // Results
                searchResults
            }
            .navigationTitle("Add Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                isSearchFocused = true
            }
        }
    }

    // MARK: - Subviews

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search for a city", text: $viewModel.searchQuery)
                .textFieldStyle(.plain)
                .focused($isSearchFocused)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.search)

            if !viewModel.searchQuery.isEmpty {
                Button {
                    viewModel.clearSearch()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }

    @ViewBuilder
    private var searchResults: some View {
        switch viewModel.searchState {
        case .idle:
            idleView

        case .searching:
            searchingView

        case .results(let locations):
            if locations.isEmpty {
                emptyResultsView
            } else {
                resultsList(locations)
            }

        case .error(let message):
            errorView(message)
        }
    }

    private var idleView: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)

            Text("Search for a Location")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Enter a city name to find weather forecasts")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var searchingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text("Searching...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyResultsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 64))
                .foregroundStyle(.orange)

            Text("No Results")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Try searching with a different spelling")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func resultsList(_ locations: [GeocodingResult]) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(locations.enumerated()), id: \.element.name) { index, location in
                    resultRow(location)

                    if index < locations.count - 1 {
                        Divider()
                            .padding(.leading, 16)
                    }
                }
            }
        }
    }

    private func resultRow(_ location: GeocodingResult) -> some View {
        Button {
            addLocation(location)
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(location.name)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    HStack(spacing: 4) {
                        if let region = location.region {
                            Text(region)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            Text("•")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Text(location.country)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    // Coordinates
                    Text("Lat: \(String(format: "%.4f", location.coordinates.latitude.rawValue)), Lon: \(String(format: "%.4f", location.coordinates.longitude.rawValue))")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }

                Spacer()

                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.blue)
            }
            .padding(.horizontal)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 64))
                .foregroundStyle(.red)

            Text("Search Failed")
                .font(.title3)
                .fontWeight(.semibold)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                // Retry search
                Task {
                    // Trigger search by reassigning query
                    let query = viewModel.searchQuery
                    viewModel.searchQuery = ""
                    try? await Task.sleep(nanoseconds: 100_000_000)
                    viewModel.searchQuery = query
                }
            } label: {
                Label("Try Again", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Actions

    private func addLocation(_ result: GeocodingResult) {
        // Haptic feedback
        #if os(iOS)
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
        #endif

        // Add location
        viewModel.addLocation(result)

        // Clear search and dismiss
        viewModel.clearSearch()
        dismiss()
    }
}

// MARK: - Preview

#Preview {
    AddLocationView(viewModel: LocationListViewModel(
        store: CloudSyncStore(store: InMemoryKeyValueStore())
    ))
}
