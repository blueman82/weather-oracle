import SwiftUI

/// Enumeration defining rain intensity levels for weather visualization
enum RainIntensity {
    case light
    case moderate
    case heavy

    /// Returns the number of raindrops to render based on intensity
    var dropCount: Int {
        switch self {
        case .light:
            return Int.random(in: 30...50)
        case .moderate:
            return Int.random(in: 60...80)
        case .heavy:
            return Int.random(in: 100...150)
        }
    }

    /// Returns the base speed multiplier for raindrops
    var speedMultiplier: CGFloat {
        switch self {
        case .light:
            return 1.0
        case .moderate:
            return 1.5
        case .heavy:
            return 2.0
        }
    }

    /// Returns opacity value for rainfall effect
    var opacity: Double {
        switch self {
        case .light:
            return 0.5
        case .moderate:
            return 0.7
        case .heavy:
            return 0.85
        }
    }
}

/// Represents a single raindrop particle with position and velocity information
struct Raindrop {
    /// Unique identifier for the raindrop
    let id: UUID
    /// Horizontal position (0.0 to 1.0)
    var x: CGFloat
    /// Vertical position (0.0 to 1.0)
    var y: CGFloat
    /// Vertical speed multiplier for this drop
    let speedVariation: CGFloat
    /// Drop length as percentage of canvas height
    let length: CGFloat

    /// Initializes a raindrop with random properties
    init() {
        self.id = UUID()
        self.x = CGFloat.random(in: 0...1)
        self.y = CGFloat.random(in: -0.1...1)
        self.speedVariation = CGFloat.random(in: 0.8...1.2)
        self.length = CGFloat.random(in: 0.02...0.05)
    }
}

/// Animated weather background for rainy conditions using Canvas API
struct RainBackground: View {
    /// The intensity level of the rainfall
    let intensity: RainIntensity

    /// State for tracking raindrops
    @State private var raindrops: [Raindrop] = []

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                // Draw cloudy gradient background
                let gradient = Gradient(colors: [
                    Color(red: 0.4, green: 0.45, blue: 0.5),
                    Color(red: 0.35, green: 0.4, blue: 0.45),
                    Color(red: 0.3, green: 0.35, blue: 0.4)
                ])

                context.fill(
                    Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 0),
                    with: .linearGradient(gradient, startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: size.width, y: size.height))
                )

                // Draw animated raindrops
                drawRaindrops(context: &context, timeline: timeline, size: size)

                // Draw subtle vignette effect
                drawVignetteEffect(context: &context, size: size)
            }
            .onAppear {
                initializeRaindrops()
            }
        }
        .ignoresSafeArea()
        .background(Color.black.opacity(0.1))
    }

    /// Initializes the raindrop particle system
    private func initializeRaindrops() {
        raindrops = (0..<intensity.dropCount).map { _ in Raindrop() }
    }

    /// Draws raindrops with physics simulation
    /// - Parameters:
    ///   - context: Canvas drawing context
    ///   - timeline: Timeline providing animation time
    ///   - size: Canvas size
    private func drawRaindrops(context: inout GraphicsContext, timeline: TimelineViewDefaultContext, size: CGSize) {
        let totalTime = timeline.date.timeIntervalSince1970
        let speed = 0.3 * intensity.speedMultiplier

        for raindrop in raindrops {
            // Calculate Y position with continuous looping
            let baseY = raindrop.y + (speed * raindrop.speedVariation * totalTime)
            let normalizedY = baseY.truncatingRemainder(dividingBy: 1.2)

            // Skip if drop is above visible area
            guard normalizedY > -0.1 else { continue }
            guard normalizedY < 1.1 else { continue }

            // Calculate raindrop color with slight variation
            let colorVariation = raindrop.speedVariation
            let colorIntensity = 0.85 + (0.15 * colorVariation)
            let dropColor = Color(
                red: colorIntensity * 0.95,
                green: colorIntensity * 0.95,
                blue: colorIntensity
            )

            // Draw raindrop as a thin vertical line
            var dropPath = Path()
            let xPosition = raindrop.x
            let yStart = normalizedY
            let yEnd = yStart + raindrop.length

            dropPath.move(to: CGPoint(x: xPosition, y: yStart))
            dropPath.addLine(to: CGPoint(x: xPosition, y: yEnd))

            // Apply stroke with slight blur for depth
            let dropStroke = StrokeStyle(lineWidth: 0.003, lineCap: .round)
            context.stroke(dropPath, with: .color(dropColor.opacity(intensity.opacity)), style: dropStroke)

            // Optional: Add subtle splash effect at bottom
            if normalizedY > 0.9 && normalizedY < 1.0 {
                drawSplashEffect(context: &context, at: CGPoint(x: xPosition, y: 1.0), intensity: raindrop.speedVariation)
            }
        }
    }

    /// Draws a subtle splash effect where raindrops hit the bottom
    /// - Parameters:
    ///   - context: Canvas drawing context
    ///   - position: The position of the splash
    ///   - intensity: Visual intensity based on raindrop speed
    private func drawSplashEffect(context: inout GraphicsContext, at position: CGPoint, intensity: CGFloat) {
        // Create small radial splash pattern
        let splashRadius = 0.005 * intensity
        let splashOpacity = 0.3 * intensity

        var splashPath = Path()
        splashPath.addEllipse(in: CGRect(
            x: position.x - splashRadius,
            y: position.y - splashRadius,
            width: splashRadius * 2,
            height: splashRadius * 2
        ))

        let splashColor = Color.white.opacity(splashOpacity)
        context.fill(splashPath, with: .color(splashColor))
    }

    /// Draws a subtle vignette effect for visual depth
    /// - Parameters:
    ///   - context: Canvas drawing context
    ///   - size: Canvas size
    private func drawVignetteEffect(context: inout GraphicsContext, size: CGSize) {
        let vignetteGradient = Gradient(colors: [
            Color.black.opacity(0),
            Color.black.opacity(0.15)
        ])

        let centerPoint = CGPoint(x: size.width / 2, y: size.height / 2)
        context.fill(
            Path(ellipseIn: CGRect(origin: .zero, size: size)),
            with: .radialGradient(vignetteGradient, center: centerPoint, startRadius: 0, endRadius: max(size.width, size.height) / 2)
        )
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        VStack {
            Text("Light Rain")
                .font(.caption)
                .foregroundColor(.white)
            RainBackground(intensity: .light)
        }

        VStack {
            Text("Moderate Rain")
                .font(.caption)
                .foregroundColor(.white)
            RainBackground(intensity: .moderate)
        }

        VStack {
            Text("Heavy Rain")
                .font(.caption)
                .foregroundColor(.white)
            RainBackground(intensity: .heavy)
        }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
}
