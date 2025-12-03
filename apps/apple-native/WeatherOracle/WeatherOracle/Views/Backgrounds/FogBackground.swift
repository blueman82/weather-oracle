import SwiftUI

/// An animated fog background view that creates a mysterious atmosphere
/// using Canvas with multiple fog layers at different heights and speeds.
///
/// Features:
/// - Multiple horizontal fog bands with varying opacity
/// - Slow continuous horizontal drift animation
/// - Gray gradient background with subtle blue tint
/// - Smooth blur effects for soft edges
/// - Optimized for performance using TimelineView
struct FogBackground: View {
    /// Configuration for individual fog layers
    private struct FogLayer {
        let heightOffset: CGFloat
        let opacity: Double
        let speed: CGFloat
        let width: CGFloat
        let blurRadius: CGFloat
    }

    /// Fog layer definitions with varying heights, opacities, and speeds
    private let fogLayers: [FogLayer] = [
        FogLayer(heightOffset: 0.1, opacity: 0.3, speed: 0.15, width: 1.5, blurRadius: 30),
        FogLayer(heightOffset: 0.35, opacity: 0.25, speed: 0.1, width: 1.8, blurRadius: 40),
        FogLayer(heightOffset: 0.55, opacity: 0.4, speed: 0.2, width: 2.0, blurRadius: 35),
        FogLayer(heightOffset: 0.75, opacity: 0.35, speed: 0.12, width: 1.6, blurRadius: 45),
    ]

    var body: some View {
        TimelineView(.animation(minimumInterval: 0.016, paused: false)) { timeline in
            Canvas { context, size in
                // Draw gradient background
                drawGradientBackground(context: &context, size: size)

                // Draw animated fog layers
                for layer in fogLayers {
                    drawFogLayer(
                        context: &context,
                        size: size,
                        layer: layer,
                        timelineDate: timeline.date
                    )
                }
            }
            .ignoresSafeArea()
        }
    }

    /// Draws the gray gradient background with subtle blue tint
    /// - Parameters:
    ///   - context: Canvas context for drawing
    ///   - size: Canvas size
    private func drawGradientBackground(context: inout GraphicsContext, size: CGSize) {
        let gradient = Gradient(colors: [
            Color(red: 0.65, green: 0.70, blue: 0.75),  // Light blue-gray top
            Color(red: 0.55, green: 0.62, blue: 0.68),  // Medium blue-gray middle
            Color(red: 0.50, green: 0.58, blue: 0.65),  // Darker blue-gray bottom
        ])

        let backgroundPath = Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 0)
        context.fill(backgroundPath, with: .linearGradient(gradient, startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: 0, y: size.height)))
    }

    /// Draws an animated fog layer with horizontal drift
    /// - Parameters:
    ///   - context: Canvas context for drawing
    ///   - size: Canvas size
    ///   - layer: Fog layer configuration
    ///   - timelineDate: Current animation time
    private func drawFogLayer(
        context: inout GraphicsContext,
        size: CGSize,
        layer: FogLayer,
        timelineDate: Date
    ) {
        let elapsedTime = timelineDate.timeIntervalSince(.distantPast)
        let offset = CGFloat(elapsedTime.truncatingRemainder(dividingBy: 30)) * layer.speed * 50

        let layerHeight: CGFloat = 80
        let yPosition = size.height * layer.heightOffset

        // Create repeating fog bands with seamless looping
        let bandWidth = size.width * layer.width
        let totalWidth = bandWidth + size.width

        var xPosition = offset.truncatingRemainder(dividingBy: totalWidth) - bandWidth
        while xPosition < size.width {
            drawFogBand(
                context: &context,
                xPosition: xPosition,
                yPosition: yPosition,
                bandWidth: bandWidth,
                height: layerHeight,
                opacity: layer.opacity,
                blurRadius: layer.blurRadius
            )
            xPosition += bandWidth
        }
    }

    /// Draws a single fog band with blur effect
    /// - Parameters:
    ///   - context: Canvas context for drawing
    ///   - xPosition: X coordinate of the band
    ///   - yPosition: Y coordinate of the band
    ///   - bandWidth: Width of the fog band
    ///   - height: Height of the fog band
    ///   - opacity: Opacity of the fog band
    ///   - blurRadius: Blur radius for soft edges
    private func drawFogBand(
        context: inout GraphicsContext,
        xPosition: CGFloat,
        yPosition: CGFloat,
        bandWidth: CGFloat,
        height: CGFloat,
        opacity: Double,
        blurRadius: CGFloat
    ) {
        let bandRect = CGRect(x: xPosition, y: yPosition, width: bandWidth, height: height)

        // Create gradient for more natural fog appearance
        let fogGradient = Gradient(colors: [
            Color.white.opacity(0),
            Color.white.opacity(opacity * 1.5),
            Color.white.opacity(opacity),
            Color.white.opacity(opacity * 0.8),
            Color.white.opacity(0),
        ])

        var bandContext = context
        bandContext.opacity = opacity

        // Draw the fog band with gradient
        let bandPath = Path(roundedRect: bandRect, cornerRadius: height / 2)
        bandContext.fill(
            bandPath,
            with: .linearGradient(
                fogGradient,
                startPoint: CGPoint(x: bandRect.minX, y: bandRect.midY),
                endPoint: CGPoint(x: bandRect.maxX, y: bandRect.midY)
            )
        )

        // Apply blur effect for softer edges
        bandContext.addFilter(.blur(radius: blurRadius / 2))
    }
}

#Preview {
    ZStack {
        FogBackground()

        VStack {
            Text("Foggy Conditions")
                .font(.title)
                .foregroundColor(.white)
                .shadow(radius: 2)

            Spacer()
        }
        .padding()
    }
}
