import SwiftUI

/// Test view to verify Canvas API is working
struct CanvasTestView: View {
    @State private var animationProgress: Double = 0

    var body: some View {
        VStack(spacing: 20) {
            Text("Canvas API Test")
                .font(.title)

            // Test 1: Basic Canvas drawing
            Canvas { context, size in
                // Draw a simple circle
                let rect = CGRect(x: size.width/4, y: size.height/4,
                                width: size.width/2, height: size.height/2)
                context.fill(Path(ellipseIn: rect), with: .color(.blue))
            }
            .frame(height: 200)
            .border(Color.gray)

            // Test 2: TimelineView + Canvas animation
            TimelineView(.animation) { timeline in
                Canvas { context, size in
                    let time = timeline.date.timeIntervalSinceReferenceDate
                    let x = (sin(time) + 1) / 2 * size.width
                    let y = size.height / 2

                    // Animated moving circle
                    let rect = CGRect(x: x - 10, y: y - 10, width: 20, height: 20)
                    context.fill(Path(ellipseIn: rect), with: .color(.red))
                }
                .frame(height: 100)
                .border(Color.gray)
            }

            Text("✅ If you see a blue circle above and a red circle moving, Canvas API is working!")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding()
        }
        .padding()
    }
}

#Preview {
    CanvasTestView()
}
