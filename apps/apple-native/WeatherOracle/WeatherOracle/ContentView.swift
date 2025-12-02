import SwiftUI

struct ContentView: View {
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
            }
            .padding()
            .navigationTitle("Weather Oracle")
        }
    }
}

#Preview {
    ContentView()
}
