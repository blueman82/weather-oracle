import SwiftUI

/// Animated thunderstorm background combining rain particles and lightning effects.
///
/// Features heavy rain animation with periodic lightning flashes for dramatic
/// weather visualization. Uses Canvas for efficient particle rendering and
/// TimelineView for smooth animation updates.
struct ThunderstormBackground: View {
    /// Lightning flash state and animation trigger
    @State private var isLightningActive = false

    /// Lightning flash opacity for fade effect
    @State private var lightningOpacity = 0.0

    /// Random task for lightning timing
    @State private var lightningTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            // Dark dramatic gradient background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.08, green: 0.08, blue: 0.12),  // Very dark blue-gray
                    Color(red: 0.12, green: 0.1, blue: 0.15)     // Darker blue-gray
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Rain animation with TimelineView
            TimelineView(.animation(minimumInterval: 0.016)) { timeline in
                RainCanvas(date: timeline.date)
            }
            .ignoresSafeArea()

            // Lightning flash overlay
            if isLightningActive {
                Color.white
                    .opacity(lightningOpacity)
                    .ignoresSafeArea()
                    .animation(.easeOut(duration: 0.2), value: lightningOpacity)
            }
        }
        .onAppear {
            scheduleLightning()
        }
        .onDisappear {
            lightningTask?.cancel()
        }
    }

    /// Schedules random lightning flashes at 3-8 second intervals.
    private func scheduleLightning() {
        lightningTask?.cancel()

        lightningTask = Task {
            while !Task.isCancelled {
                // Wait for random interval between 3-8 seconds
                let delay = Double.random(in: 3.0...8.0)
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

                if !Task.isCancelled {
                    triggerLightning()
                }
            }
        }
    }

    /// Triggers a lightning flash with fade animation.
    private func triggerLightning() {
        withAnimation {
            isLightningActive = true
            lightningOpacity = 0.6
        }

        // Fade out flash after 0.2 seconds
        Task {
            try? await Task.sleep(nanoseconds: 200_000_000)  // 0.2 seconds

            withAnimation(.easeOut(duration: 0.15)) {
                lightningOpacity = 0.0
            }

            // Optionally add a second brief flash for realism
            try? await Task.sleep(nanoseconds: 150_000_000)  // 0.15 seconds

            if Double.random(in: 0...1) > 0.6 {  // 40% chance of second flash
                withAnimation {
                    lightningOpacity = 0.4
                }

                try? await Task.sleep(nanoseconds: 100_000_000)  // 0.1 seconds

                withAnimation(.easeOut(duration: 0.1)) {
                    lightningOpacity = 0.0
                    isLightningActive = false
                }
            } else {
                isLightningActive = false
            }

            // Schedule next lightning
            scheduleLightning()
        }
    }
}

/// Canvas view rendering rain particles with heavy downpour effect.
///
/// Creates 150+ rain particles that fall continuously, creating the illusion
/// of heavy rainfall. Uses Canvas for efficient rendering performance.
private struct RainCanvas: View {
    let date: Date

    /// Rain particles for current frame
    @State private var rainParticles: [RainParticle] = []

    /// Initial setup flag
    @State private var isInitialized = false

    var body: some View {
        Canvas { context, size in
            // Initialize rain particles on first render
            if !isInitialized {
                rainParticles = generateRainParticles(count: 150, in: size)
                isInitialized = true
            }

            // Update and draw rain particles
            for (index, particle) in rainParticles.enumerated() {
                let updatedParticle = updateParticle(particle, in: size, date: date)
                rainParticles[index] = updatedParticle
                drawRainDrop(context, particle: updatedParticle, size: size)
            }
        }
        .background(Color.clear)
    }

    /// Generates initial rain particles scattered across screen.
    ///
    /// - Parameters:
    ///   - count: Number of rain particles to create
    ///   - size: Canvas size for bounds calculation
    /// - Returns: Array of initialized rain particles
    private func generateRainParticles(count: Int, in size: CGSize) -> [RainParticle] {
        (0..<count).map { _ in
            RainParticle(
                x: CGFloat.random(in: 0...size.width),
                y: CGFloat.random(in: -50...size.height),
                length: CGFloat.random(in: 8...16),
                velocity: CGFloat.random(in: 8...14),
                opacity: Double.random(in: 0.3...0.8)
            )
        }
    }

    /// Updates particle position for animation frame.
    ///
    /// Moves particle downward by velocity and resets position when
    /// particle falls below visible area.
    ///
    /// - Parameters:
    ///   - particle: Particle to update
    ///   - size: Canvas size for bounds checking
    ///   - date: Current animation date for timing
    /// - Returns: Updated particle with new position
    private func updateParticle(
        _ particle: RainParticle,
        in size: CGSize,
        date: Date
    ) -> RainParticle {
        var updated = particle
        let deltaTime = 0.016  // ~60 FPS frame time

        updated.y += particle.velocity * deltaTime * 100

        // Reset particle to top when below visible area
        if updated.y > size.height + 20 {
            updated.y = -20
            updated.x = CGFloat.random(in: 0...size.width)
        }

        return updated
    }

    /// Draws a single rain drop to canvas.
    ///
    /// Rain drops are rendered as thin white lines with varying opacity
    /// to create depth and movement perception.
    ///
    /// - Parameters:
    ///   - context: Canvas drawing context
    ///   - particle: Particle defining rain drop properties
    ///   - size: Canvas size for reference
    private func drawRainDrop(
        _ context: GraphicsContext,
        particle: RainParticle,
        size: CGSize
    ) {
        var path = Path()
        path.move(to: CGPoint(x: particle.x, y: particle.y))
        path.addLine(to: CGPoint(x: particle.x, y: particle.y + particle.length))

        let stroke = StrokeStyle(lineWidth: 1.5, lineCap: .round)
        context.stroke(
            path,
            with: .color(Color.white.opacity(particle.opacity)),
            style: stroke
        )
    }
}

/// Individual rain particle properties.
///
/// Represents a single rain drop with position, movement velocity,
/// and visual properties for rendering.
private struct RainParticle {
    /// Horizontal position
    var x: CGFloat

    /// Vertical position
    var y: CGFloat

    /// Length of rain drop
    let length: CGFloat

    /// Downward velocity in pixels per second
    let velocity: CGFloat

    /// Opacity for depth effect
    let opacity: Double
}

#Preview {
    ThunderstormBackground()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
}
