import SwiftUI

/// An animated clear night sky background using Canvas API and TimelineView
/// Features a gradient background, glowing moon, twinkling stars, and occasional shooting stars
struct ClearSkyNightBackground: View {
    /// Container for star position and animation properties
    private struct Star {
        let id: UUID
        let x: CGFloat
        let y: CGFloat
        let size: CGFloat
        let phaseOffset: CGFloat
        let minBrightness: CGFloat

        /// Calculate opacity based on time and phase offset
        func opacity(at time: TimeInterval) -> CGFloat {
            let wave = sin((time + phaseOffset) * 2.0) * 0.5 + 0.5
            return minBrightness + (1.0 - minBrightness) * wave
        }
    }

    /// Container for shooting star animation
    private struct ShootingStar {
        let id: UUID
        let startX: CGFloat
        let startY: CGFloat
        let endX: CGFloat
        let endY: CGFloat
        let duration: CGFloat
        let startTime: TimeInterval

        /// Calculate current position along trajectory
        func position(at currentTime: TimeInterval) -> CGPoint? {
            let elapsed = currentTime - startTime
            guard elapsed >= 0, elapsed < TimeInterval(duration) else { return nil }

            let progress = CGFloat(elapsed) / duration
            let x = startX + (endX - startX) * progress
            let y = startY + (endY - startY) * progress
            let opacity = 1.0 - (progress * progress) // Fade out quadratically

            return opacity > 0.01 ? CGPoint(x: x, y: y) : nil
        }

        /// Calculate opacity of shooting star
        func opacity(at currentTime: TimeInterval) -> CGFloat {
            let elapsed = currentTime - startTime
            guard elapsed >= 0, elapsed < TimeInterval(duration) else { return 0 }

            let progress = CGFloat(elapsed) / duration
            return 1.0 - (progress * progress)
        }
    }

    @State private var stars: [Star] = []
    @State private var shootingStars: [ShootingStar] = []
    @State private var lastShootingStarTime: TimeInterval = 0

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                // Draw gradient background
                var mutableContext = context
                drawGradientBackground(in: &mutableContext, size: size)
                context = mutableContext

                // Draw moon
                drawMoon(in: context, size: size)

                // Draw stars with twinkling animation
                drawStars(in: context, at: timeline.date.timeIntervalSinceReferenceDate)

                // Draw shooting stars
                drawShootingStars(in: context, at: timeline.date.timeIntervalSinceReferenceDate)
            }
            .background(Color.clear)
            .onAppear {
                if stars.isEmpty {
                    initializeStars()
                }
            }
            .onChange(of: timeline.date.timeIntervalSinceReferenceDate) { time in
                updateShootingStars(at: time)
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - Initialization

    /// Initialize star positions and properties
    private func initializeStars() {
        var newStars: [Star] = []
        let starCount = Int.random(in: 35...50)

        for _ in 0..<starCount {
            let star = Star(
                id: UUID(),
                x: CGFloat.random(in: 0...1),
                y: CGFloat.random(in: 0...0.85), // Keep stars above horizon
                size: CGFloat.random(in: 0.5...2.0),
                phaseOffset: CGFloat.random(in: 0...(2 * .pi)),
                minBrightness: CGFloat.random(in: 0.3...0.6)
            )
            newStars.append(star)
        }

        stars = newStars.sorted { $0.y > $1.y } // Sort by depth (far to near)
    }

    // MARK: - Drawing Methods

    /// Draw the gradient sky background
    private func drawGradientBackground(in context: inout GraphicsContext, size: CGSize) {
        let gradient = Gradient(colors: [
            Color(red: 0.05, green: 0.08, blue: 0.25), // Dark navy top
            Color(red: 0.12, green: 0.08, blue: 0.30), // Deep purple middle
            Color(red: 0.08, green: 0.04, blue: 0.20)  // Nearly black bottom
        ])

        var path = Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 0)
        context.fill(path, with: .linearGradient(gradient, startPoint: CGPoint(x: 0.5, y: 0), endPoint: CGPoint(x: 0.5, y: 1)))
    }

    /// Draw the moon with glow effect
    private func drawMoon(in context: GraphicsContext, size: CGSize) {
        let moonX = size.width * 0.75
        let moonY = size.height * 0.15
        let moonRadius: CGFloat = 35

        // Outer glow layer (semi-transparent)
        var glowPath = Circle().path(in: CGRect(x: moonX - moonRadius * 1.5, y: moonY - moonRadius * 1.5, width: moonRadius * 3, height: moonRadius * 3))
        let glowColor = Color(red: 1.0, green: 0.98, blue: 0.85, opacity: 0.15)
        context.fill(glowPath, with: .color(glowColor))

        // Inner glow layer
        var innerGlowPath = Circle().path(in: CGRect(x: moonX - moonRadius * 1.2, y: moonY - moonRadius * 1.2, width: moonRadius * 2.4, height: moonRadius * 2.4))
        let innerGlowColor = Color(red: 1.0, green: 0.98, blue: 0.85, opacity: 0.25)
        context.fill(innerGlowPath, with: .color(innerGlowColor))

        // Moon crescent
        var moonPath = Circle().path(in: CGRect(x: moonX - moonRadius, y: moonY - moonRadius, width: moonRadius * 2, height: moonRadius * 2))
        let moonColor = Color(red: 0.95, green: 0.93, blue: 0.85)
        context.fill(moonPath, with: .color(moonColor))

        // Shadow to create crescent effect
        let shadowX = moonX + moonRadius * 0.3
        let shadowRadius = moonRadius * 0.95
        var shadowPath = Circle().path(in: CGRect(x: shadowX - shadowRadius, y: moonY - shadowRadius, width: shadowRadius * 2, height: shadowRadius * 2))
        context.fill(shadowPath, with: .color(Color(red: 0.05, green: 0.08, blue: 0.25)))
    }

    /// Draw twinkling stars with animated opacity
    private func drawStars(in context: GraphicsContext, at time: TimeInterval) {
        for star in stars {
            let screenX = star.x * 400 // Approximate width
            let screenY = star.y * 800 // Approximate height

            let opacity = star.opacity(at: time)
            var starPath = Circle().path(in: CGRect(x: screenX - star.size / 2, y: screenY - star.size / 2, width: star.size, height: star.size))

            let starColor = Color(red: 0.95, green: 0.93, blue: 0.88, opacity: opacity)
            context.fill(starPath, with: .color(starColor))

            // Add subtle glow for brighter stars
            if opacity > 0.8 {
                let glowSize = star.size * 1.5
                var glowPath = Circle().path(in: CGRect(x: screenX - glowSize / 2, y: screenY - glowSize / 2, width: glowSize, height: glowSize))
                let glowColor = Color(red: 0.95, green: 0.93, blue: 0.88, opacity: opacity * 0.4)
                context.fill(glowPath, with: .color(glowColor))
            }
        }
    }

    /// Draw shooting stars with trail effect
    private func drawShootingStars(in context: GraphicsContext, at time: TimeInterval) {
        for shootingStar in shootingStars {
            guard let position = shootingStar.position(at: time) else { continue }

            let opacity = shootingStar.opacity(at: time)

            // Main shooting star point
            let starSize: CGFloat = 2.5
            var starPath = Circle().path(in: CGRect(x: position.x - starSize / 2, y: position.y - starSize / 2, width: starSize, height: starSize))
            let starColor = Color(red: 1.0, green: 0.98, blue: 0.90, opacity: opacity)
            context.fill(starPath, with: .color(starColor))

            // Shooting star trail (glow)
            let trailSize = starSize * 3
            var trailPath = Circle().path(in: CGRect(x: position.x - trailSize / 2, y: position.y - trailSize / 2, width: trailSize, height: trailSize))
            let trailColor = Color(red: 1.0, green: 0.98, blue: 0.90, opacity: opacity * 0.5)
            context.fill(trailPath, with: .color(trailColor))
        }
    }

    // MARK: - Animation Updates

    /// Update shooting stars, spawning new ones occasionally
    private func updateShootingStars(at time: TimeInterval) {
        // Clean up completed shooting stars
        shootingStars.removeAll { star in
            guard let position = star.position(at: time) else { return true }
            return position == nil
        }

        // Randomly spawn new shooting stars (every 2-4 seconds on average)
        if time - lastShootingStarTime > Double.random(in: 2...4) {
            lastShootingStarTime = time
            spawnShootingStar(at: time)
        }
    }

    /// Spawn a new shooting star at a random position
    private func spawnShootingStar(at time: TimeInterval) {
        let startX = CGFloat.random(in: 50...350)
        let startY = CGFloat.random(in: 50...400)
        let angle = CGFloat.random(in: (-.pi / 4)...(-.pi / 6)) // Falling angle
        let distance = CGFloat.random(in: 150...300)

        let endX = startX + distance * cos(angle)
        let endY = startY + distance * sin(angle)

        let shootingStar = ShootingStar(
            id: UUID(),
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            duration: CGFloat.random(in: 1.5...2.5),
            startTime: time
        )

        shootingStars.append(shootingStar)
    }
}

// MARK: - Preview

#Preview {
    ClearSkyNightBackground()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
}
