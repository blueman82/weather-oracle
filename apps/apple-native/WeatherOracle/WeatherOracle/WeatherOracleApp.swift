import SharedKit
import SwiftUI

@main
struct WeatherOracleApp: App {
    @State private var viewModel: LocationListViewModel
    @State private var deepLinkLocationId: UUID?

    init() {
        // Use App Groups for data sharing between app and widgets
        // For production with paid Apple Developer account, switch to: NSUbiquitousKeyValueStore.default
        let userDefaults = UserDefaults(suiteName: "group.com.weatheroracle.app")!
        let store = CloudSyncStore(store: userDefaults)
        print("📱 iOS App - Using App Group: group.com.weatheroracle.app")
        print("📱 iOS App - Initial locations in store: \(store.locations.count)")

        let viewModel = LocationListViewModel(
            client: OpenMeteoClient(),
            store: store
        )
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some Scene {
        WindowGroup {
            LocationListView(viewModel: viewModel, deepLinkLocationId: $deepLinkLocationId)
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
    }

    /// Handle deep link URLs from widgets
    private func handleDeepLink(_ url: URL) {
        // Expected format: weatheroracle://forecast/{locationId}
        guard url.scheme == "weatheroracle",
              url.host == "forecast" || url.host() == "forecast",
              let locationIdString = url.pathComponents.last,
              let locationId = UUID(uuidString: locationIdString)
        else {
            print("Invalid deep link URL: \(url)")
            return
        }

        // Set the deep link location ID - LocationListView will handle navigation
        deepLinkLocationId = locationId
    }
}
