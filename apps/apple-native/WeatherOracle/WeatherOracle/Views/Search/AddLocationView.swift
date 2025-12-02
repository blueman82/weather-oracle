import SharedKit
import SwiftUI

// MARK: - Add Location View

/// Search interface for adding new locations with geocoding
public struct AddLocationView: View {
    @Bindable var viewModel: LocationListViewModel
    @Binding var isPresented: Bool
    @FocusState private var isSearchFocused: Bool

    public init(viewModel: LocationListViewModel, isPresented: Binding<Bool>) {
        self.viewModel = viewModel
        self._isPresented = isPresented
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar

                Divider()

                searchResults
            }
            .navigationTitle("Add Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.clearSearch()
                        isPresented = false
                    }
                }
            }
            .onAppear {
                isSearchFocused = true
            }
            .onDisappear {
                viewModel.clearSearch()
            }
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search for a city or airport", text: $viewModel.searchQuery)
                .focused($isSearchFocused)
                .textFieldStyle(.plain)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.words)
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
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(Color(.systemGray6))
    }

    // MARK: - Search Results

    private var searchResults: some View {
        Group {
            switch viewModel.searchState {
            case .idle:
                idleState

            case .searching:
                searchingState

            case let .results(results):
                resultsState(results: results)

            case let .error(message):
                errorState(message: message)
            }
        }
    }

    private var idleState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("Search for a location")
                .font(.headline)
                .foregroundStyle(.secondary)

            Text("Enter a city name, address, or airport code")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .padding()
    }

    private var searchingState: some View {
        VStack {
            Spacer()
            ProgressView("Searching...")
            Spacer()
        }
    }

    private func resultsState(results: [GeocodingResult]) -> some View {
        Group {
            if results.isEmpty {
                emptyResultsState
            } else {
                List {
                    ForEach(results, id: \.coordinates) { result in
                        SearchResultRow(result: result) {
                            selectLocation(result)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
    }

    private var emptyResultsState: some View {
        ContentUnavailableView(
            "No Results",
            systemImage: "magnifyingglass",
            description: Text("Try a different search term")
        )
    }

    private func errorState(message: String) -> some View {
        ContentUnavailableView(
            "Search Failed",
            systemImage: "exclamationmark.triangle",
            description: Text(message)
        )
    }

    // MARK: - Actions

    private func selectLocation(_ result: GeocodingResult) {
        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        viewModel.addLocation(result)
        isPresented = false
    }
}

// MARK: - Search Result Row

struct SearchResultRow: View {
    let result: GeocodingResult
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Location icon
                Image(systemName: "mappin.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.blue)

                // Location details
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.name)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    locationSubtitle
                }

                Spacer()

                // Country flag (emoji)
                Text(flagEmoji(for: result.countryCode))
                    .font(.title2)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var locationSubtitle: some View {
        Group {
            if let region = result.region {
                Text("\(region), \(result.country)")
            } else {
                Text(result.country)
            }
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }

    private func flagEmoji(for countryCode: String) -> String {
        let base: UInt32 = 127397
        var emoji = ""
        for scalar in countryCode.uppercased().unicodeScalars {
            if let scalarValue = Unicode.Scalar(base + scalar.value) {
                emoji.append(String(scalarValue))
            }
        }
        return emoji
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Add Location") {
    @Previewable @State var isPresented = true
    let store = CloudSyncStore(store: InMemoryKeyValueStore())
    let viewModel = LocationListViewModel(store: store)

    return AddLocationView(viewModel: viewModel, isPresented: $isPresented)
}

#Preview("With Results") {
    @Previewable @State var isPresented = true
    let store = CloudSyncStore(store: InMemoryKeyValueStore())
    let viewModel = LocationListViewModel(store: store)

    return AddLocationView(viewModel: viewModel, isPresented: $isPresented)
        .onAppear {
            viewModel.searchQuery = "San Francisco"
        }
}
#endif
