import SwiftUI

/// Animated weather background for clear sky conditions
/// Features a gradient sky, animated sun with rotating rays, and drifting clouds
struct ClearSkyDayBackground: View {
    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let time = timeline.date.timeIntervalSinceReferenceDate

                // Draw gradient background: light blue at top to white at bottom
                drawGradientBackground(context: context, size: size)

                // Draw sun with glow and rotating rays
                drawSun(context: context, size: size, time: time)

                // Draw drifting clouds
                drawClouds(context: context, size: size, time: time)
            }
            .ignoresSafeArea()
        }
    }

    // MARK: - Helper Methods

    /// Draws the gradient sky background from light blue to white
    private func drawGradientBackground(context: GraphicsContext, size: CGSize) {
        let topColor = Color(red: 0.53, green: 0.81, blue: 0.92)  // Light sky blue
        let bottomColor = Color(red: 0.98, green: 0.98, blue: 1.0) // Nearly white

        let gradientContext = context
        let gradientPath = Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 0)

        // Create gradient using stop points
        let gradient = Gradient(stops: [
            .init(color: topColor, location: 0.0),
            .init(color: bottomColor, location: 1.0)
        ])

        gradientContext.fill(gradientPath, with: .linearGradient(gradient, startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: 0, y: size.height)))
    }

    /// Draws the animated sun with glow effect and rotating rays
    private func drawSun(context: GraphicsContext, size: CGSize, time: TimeInterval) {
        let sunX = size.width * 0.75
        let sunY = size.height * 0.2
        let sunRadius: CGFloat = 40

        // Draw sun glow (outer aura)
        let glowRadius = sunRadius * 1.3
        let glowColor = Color(red: 1.0, green: 0.95, blue: 0.7).opacity(0.4)
        context.fill(
            Path(ellipseIn: CGRect(x: sunX - glowRadius, y: sunY - glowRadius, width: glowRadius * 2, height: glowRadius * 2)),
            with: .color(glowColor)
        )

        // Draw main sun circle
        let sunColor = Color(red: 1.0, green: 0.85, blue: 0.0) // Golden yellow
        context.fill(
            Path(ellipseIn: CGRect(x: sunX - sunRadius, y: sunY - sunRadius, width: sunRadius * 2, height: sunRadius * 2)),
            with: .color(sunColor)
        )

        // Draw rotating rays
        let rayCount = 12
        let rayLength: CGFloat = 55
        let rayWidth: CGFloat = 3
        let rotationSpeed = time * 0.3 // Slow rotation

        for i in 0..<rayCount {
            let angle = (Double(i) / Double(rayCount)) * .pi * 2 + rotationSpeed
            let rayStartX = sunX + cos(angle) * (sunRadius + 5)
            let rayStartY = sunY + sin(angle) * (sunRadius + 5)
            let rayEndX = sunX + cos(angle) * (sunRadius + rayLength)
            let rayEndY = sunY + sin(angle) * (sunRadius + rayLength)

            var rayPath = Path()
            rayPath.move(to: CGPoint(x: rayStartX, y: rayStartY))
            rayPath.addLine(to: CGPoint(x: rayEndX, y: rayEndY))

            let rayColor = Color(red: 1.0, green: 0.9, blue: 0.3).opacity(0.8)
            context.stroke(rayPath, with: .color(rayColor), lineWidth: rayWidth)
        }
    }

    /// Draws drifting clouds using bezier curves
    private func drawClouds(context: GraphicsContext, size: CGSize, time: TimeInterval) {
        let cloudSpeed = 0.15 // Speed of cloud drift

        // Cloud 1 - Upper left area
        let cloud1X = fmod(time * cloudSpeed * 30, size.width + 150) - 75
        let cloud1Y = size.height * 0.25
        drawCloud(context: context, x: cloud1X, y: cloud1Y, scale: 1.0, opacity: 0.85)

        // Cloud 2 - Middle area
        let cloud2X = fmod(time * cloudSpeed * 25 + 100, size.width + 150) - 75
        let cloud2Y = size.height * 0.35
        drawCloud(context: context, x: cloud2X, y: cloud2Y, scale: 0.75, opacity: 0.7)

        // Cloud 3 - Lower area
        let cloud3X = fmod(time * cloudSpeed * 20 + 200, size.width + 150) - 75
        let cloud3Y = size.height * 0.45
        drawCloud(context: context, x: cloud3X, y: cloud3Y, scale: 0.85, opacity: 0.75)
    }

    /// Helper to draw a single cloud using bezier curves
    private func drawCloud(context: GraphicsContext, x: CGFloat, y: CGFloat, scale: CGFloat, opacity: Double) {
        let cloudColor = Color.white.opacity(opacity)

        // Create cloud shape using bezier curves - multiple circles arranged
        let baseRadius: CGFloat = 20 * scale

        // Cloud puffs positioned to create natural cloud shape
        let puffs: [(offsetX: CGFloat, offsetY: CGFloat, radius: CGFloat)] = [
            (offsetX: -baseRadius * 0.7, offsetY: 0, radius: baseRadius * 0.75),
            (offsetX: 0, offsetY: -baseRadius * 0.3, radius: baseRadius),
            (offsetX: baseRadius * 0.7, offsetY: 0, radius: baseRadius * 0.75),
            (offsetX: baseRadius * 1.4, offsetY: baseRadius * 0.2, radius: baseRadius * 0.6)
        ]

        // Draw each puff of the cloud
        for puff in puffs {
            let puffX = x + puff.offsetX
            let puffY = y + puff.offsetY
            let rect = CGRect(
                x: puffX - puff.radius,
                y: puffY - puff.radius,
                width: puff.radius * 2,
                height: puff.radius * 2
            )
            context.fill(Path(ellipseIn: rect), with: .color(cloudColor))
        }
    }
}

#Preview {
    ClearSkyDayBackground()
}
