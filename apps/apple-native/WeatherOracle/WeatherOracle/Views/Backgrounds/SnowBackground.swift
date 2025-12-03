import SwiftUI

/// Enum representing snow intensity levels for visual effect variety
enum SnowIntensity {
    case light
    case moderate
    case heavy

    /// Returns the number of snowflakes to render based on intensity
    var flakeCount: Int {
        switch self {
        case .light:
            return Int.random(in: 20...30)
        case .moderate:
            return Int.random(in: 40...60)
        case .heavy:
            return Int.random(in: 80...100)
        }
    }
}

/// Represents a single snowflake particle in the animation system
private struct Snowflake: Identifiable {
    let id: UUID
    let xOffset: Double
    let yStartOffset: Double
    let size: Double
    let driftAmplitude: Double
    let driftFrequency: Double
    let rotationSpeed: Double
    let fallSpeed: Double

    /// Initializes a snowflake with random parameters
    init() {
        id = UUID()
        xOffset = Double.random(in: 0...1)
        yStartOffset = Double.random(in: -0.1...0)
        size = Double.random(in: 2...6)
        driftAmplitude = Double.random(in: 20...40)
        driftFrequency = Double.random(in: 0.8...1.5)
        rotationSpeed = Double.random(in: 0.3...0.8)
        fallSpeed = Double.random(in: 20...40)
    }
}

/// A scenic snow background view with animated falling snowflakes
///
/// This view uses SwiftUI's Canvas API combined with TimelineView to create
/// a performant particle system for rendering falling snow. Each snowflake
/// has its own trajectory, rotation, and drift pattern for a natural appearance.
///
/// The background features:
/// - A light gray-to-white gradient (day) or dark blue-gray gradient (night)
/// - Customizable snowflake density based on intensity
/// - Smooth horizontal drift using sine wave calculations
/// - Gentle rotation for each flake
/// - Size variation for depth perception
/// - Day/night color palette support
///
/// Example usage:
/// ```swift
/// SnowBackground(intensity: .moderate, isDaytime: true)
///     .frame(maxWidth: .infinity, maxHeight: .infinity)
///     .ignoresSafeArea()
/// ```
struct SnowBackground: View {
    /// The intensity level determining snowflake density
    let intensity: SnowIntensity

    /// Whether it's currently daytime (affects background colors)
    let isDaytime: Bool

    /// Array of snowflakes to render
    @State private var snowflakes: [Snowflake] = []

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                // Draw gradient background
                let gradient = isDaytime
                    ? Gradient(colors: [
                        Color(red: 0.95, green: 0.95, blue: 0.98),  // Very light blue-white top
                        Color(red: 0.88, green: 0.90, blue: 0.95)   // Light blue-white bottom
                    ])
                    : Gradient(colors: [
                        Color(red: 0.22, green: 0.26, blue: 0.35),  // Dark blue-gray top
                        Color(red: 0.28, green: 0.32, blue: 0.40)   // Slightly lighter dark blue-gray bottom
                    ])

                let backgroundPath = Path(
                    roundedRect: CGRect(origin: .zero, size: size),
                    cornerRadius: 0
                )
                context.fill(backgroundPath, with: .linearGradient(gradient, startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: size.width, y: size.height)))

                // Get current time for animation
                let time = timeline.date.timeIntervalSinceReferenceDate

                // Draw each snowflake
                for flake in snowflakes {
                    // Calculate vertical position with wrap-around
                    let normalizedTime = time.truncatingRemainder(dividingBy: (size.height / flake.fallSpeed + 5))
                    let yProgress = normalizedTime / (size.height / flake.fallSpeed + 5)
                    let y = yProgress * (size.height + 20) + flake.yStartOffset * size.height - 10

                    // Skip flake if it's completely out of view
                    if y > size.height + 20 {
                        continue
                    }

                    // Calculate horizontal drift using sine wave
                    let drift = sin((time * flake.driftFrequency) + flake.xOffset * .pi * 2) * flake.driftAmplitude

                    // Calculate x position with drift and wrapping
                    let baseX = flake.xOffset * size.width
                    var x = baseX + drift

                    // Wrap around horizontally
                    if x < -20 {
                        x += size.width + 40
                    } else if x > size.width + 20 {
                        x -= size.width + 40
                    }

                    // Calculate rotation
                    let rotation = (time * flake.rotationSpeed * 2 * .pi).truncatingRemainder(dividingBy: .pi * 2)

                    // Draw snowflake (simple six-pointed star shape)
                    drawSnowflake(
                        context: &context,
                        at: CGPoint(x: x, y: y),
                        size: flake.size,
                        rotation: rotation
                    )
                }
            }
            .background(isDaytime
                ? Color(red: 0.95, green: 0.95, blue: 0.98)
                : Color(red: 0.22, green: 0.26, blue: 0.35)
            )
            .onAppear {
                initializeSnowflakes()
            }
        }
    }

    /// Initializes the snowflake array based on intensity
    private func initializeSnowflakes() {
        snowflakes = (0..<intensity.flakeCount).map { _ in
            Snowflake()
        }
    }

    /// Draws a simple six-pointed snowflake at the specified position
    ///
    /// - Parameters:
    ///   - context: The Canvas drawing context
    ///   - point: The center position of the snowflake
    ///   - size: The size of the snowflake
    ///   - rotation: The rotation angle in radians
    private func drawSnowflake(
        context: inout GraphicsContext,
        at point: CGPoint,
        size: Double,
        rotation: Double
    ) {
        // Create a snowflake using multiple line segments for a simple six-pointed star
        var contextCopy = context
        let radius = size / 2

        // Adjust snowflake opacity based on time of day
        // Snowflakes are more opaque at night for visibility against dark sky
        let snowflakeOpacity = isDaytime ? 0.8 : 0.95
        let centerOpacity = isDaytime ? 0.9 : 1.0

        // Translate to the snowflake position
        var transform = CGAffineTransform(translationX: point.x, y: point.y)
        transform = transform.rotated(by: rotation)

        // Draw six points
        for i in 0..<6 {
            let angle = Double(i) * (.pi / 3)
            let endPoint = CGPoint(
                x: cos(angle) * radius * 1.5,
                y: sin(angle) * radius * 1.5
            ).applying(transform)

            let startPoint = CGPoint(x: point.x, y: point.y)

            // Create path for the line
            let path = Path()
            var pointPath = path
            pointPath.move(to: startPoint)
            pointPath.addLine(to: endPoint)

            // Draw the line
            contextCopy.stroke(
                pointPath,
                with: .color(Color.white.opacity(snowflakeOpacity)),
                lineWidth: max(0.5, size / 8)
            )
        }

        // Draw center circle
        let centerCircle = Path(
            ellipseIn: CGRect(
                x: point.x - size / 3,
                y: point.y - size / 3,
                width: size * 2 / 3,
                height: size * 2 / 3
            )
        )
        contextCopy.fill(centerCircle, with: .color(Color.white.opacity(centerOpacity)))

        context = contextCopy
    }
}

#Preview("Snow - Day") {
    ZStack {
        SnowBackground(intensity: .moderate, isDaytime: true)
            .ignoresSafeArea()

        VStack {
            Text("Snow Background - Day")
                .font(.title)
                .foregroundStyle(.black)
                .padding()
                .background(Color.black.opacity(0.1))
                .cornerRadius(8)

            Spacer()
        }
        .padding()
    }
}

#Preview("Snow - Night") {
    ZStack {
        SnowBackground(intensity: .moderate, isDaytime: false)
            .ignoresSafeArea()

        VStack {
            Text("Snow Background - Night")
                .font(.title)
                .foregroundStyle(.white)
                .padding()
                .background(Color.white.opacity(0.2))
                .cornerRadius(8)

            Spacer()
        }
        .padding()
    }
}
