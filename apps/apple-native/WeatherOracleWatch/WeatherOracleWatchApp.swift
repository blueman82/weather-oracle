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
        // Use iCloud Key-Value Store for production sync between iOS/watchOS
        let cloudStore = CloudSyncStore(store: NSUbiquitousKeyValueStore.default)
        print("⌚ Watch App - Using iCloud Key-Value Store")
        print("⌚ Watch App - Initial locations in store: \(cloudStore.locations.count)")
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
