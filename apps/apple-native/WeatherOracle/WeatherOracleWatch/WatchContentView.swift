import SwiftUI

struct WatchContentView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "cloud.sun.fill")
                .font(.system(size: 40))
                .foregroundStyle(.blue, .yellow)

            Text("Weather Oracle")
                .font(.headline)

            Text("72°F")
                .font(.largeTitle)
                .fontWeight(.bold)
        }
        .padding()
    }
}

#Preview {
    WatchContentView()
}
