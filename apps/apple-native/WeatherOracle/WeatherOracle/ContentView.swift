import SharedKit
import SwiftUI

struct ContentView: View {
    @Binding var deepLinkLocationId: UUID?
    @State private var selectedLocationText: String = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "cloud.sun.fill")
                    .font(.system(size: 80))
                    .foregroundStyle(.blue, .yellow)

                Text("Weather Oracle")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Your AI-powered weather forecast")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                // Display deep link location ID when widget is tapped
                if !selectedLocationText.isEmpty {
                    Text("Widget tapped: \(selectedLocationText)")
                        .font(.caption)
                        .foregroundStyle(.blue)
                        .padding()
                        .background(Color.blue.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding()
            .navigationTitle("Weather Oracle")
            .onChange(of: deepLinkLocationId) { _, newLocationId in
                guard let locationId = newLocationId else {
                    return
                }

                // Deep link handling - in production this would navigate to ForecastDetailView
                // For now, we demonstrate the URL handling is working by displaying the location ID
                selectedLocationText = "Location ID: \(locationId.uuidString)"

                // Reset the deep link after handling
                // Clear after 3 seconds for demo purposes
                Task {
                    try? await Task.sleep(for: .seconds(3))
                    selectedLocationText = ""
                    deepLinkLocationId = nil
                }
            }
        }
    }
}

#Preview {
    ContentView(deepLinkLocationId: .constant(nil))
}
