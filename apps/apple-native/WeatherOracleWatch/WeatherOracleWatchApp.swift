import SwiftUI
import SharedKit

// MARK: - Weather Oracle Watch App

@main
struct WeatherOracleWatchApp: App {
    // MARK: - State

    @State private var store: CloudSyncStore
    @State private var viewModel: WatchLocationViewModel

    // MARK: - Initialization

    init() {
        // Initialize cloud sync store with NSUbiquitousKeyValueStore for iCloud sync
        let cloudStore = CloudSyncStore()
        _store = State(initialValue: cloudStore)

        // Initialize view model with store
        _viewModel = State(initialValue: WatchLocationViewModel(store: cloudStore))
    }

    // MARK: - Body

    var body: some Scene {
        WindowGroup {
            WatchLocationListView(viewModel: viewModel)
        }
    }
}
