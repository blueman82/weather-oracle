import SwiftUI

/// Enum defining cloud density for different weather conditions
enum CloudDensity {
    case partly
    case overcast
}

/// Animated weather background view for cloudy conditions
///
/// Renders a dynamic cloud scene using Canvas API with TimelineView for smooth animation.
/// Supports both partly cloudy (sun peeking through) and overcast (dense cloud layer) conditions,
/// with day/night awareness for appropriate color palettes.
struct CloudyBackground: View {
    /// The density of clouds to display
    let density: CloudDensity

    /// Whether it's currently daytime (affects background colors)
    let isDaytime: Bool

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let time = timeline.date.timeIntervalSinceReferenceDate

                // Draw background gradient
                drawBackgroundGradient(context: &context, size: size)

                // Draw clouds based on density
                switch density {
                case .partly:
                    drawPartlyCloudyScene(context: &context, size: size, time: time)
                case .overcast:
                    drawOvercastScene(context: &context, size: size, time: time)
                }
            }
            .ignoresSafeArea()
        }
    }

    /// Draws the background gradient appropriate for the weather condition
    /// - Parameters:
    ///   - context: Canvas rendering context
    ///   - size: Canvas size
    private func drawBackgroundGradient(context: inout GraphicsContext, size: CGSize) {
        let gradient: Gradient
        let startPoint: CGPoint
        let endPoint: CGPoint

        switch (density, isDaytime) {
        case (.partly, true):
            // Daytime partly cloudy - light blue sky
            gradient = Gradient(colors: [
                Color(red: 0.85, green: 0.90, blue: 0.95), // Light blue top
                Color(red: 0.92, green: 0.92, blue: 0.93)  // Light gray bottom
            ])
            startPoint = CGPoint(x: 0, y: 0)
            endPoint = CGPoint(x: size.width, y: size.height)

        case (.partly, false):
            // Nighttime partly cloudy - dark blue/purple sky
            gradient = Gradient(colors: [
                Color(red: 0.15, green: 0.18, blue: 0.28), // Dark navy top
                Color(red: 0.25, green: 0.28, blue: 0.38)  // Lighter navy bottom
            ])
            startPoint = CGPoint(x: 0, y: 0)
            endPoint = CGPoint(x: size.width, y: size.height)

        case (.overcast, true):
            // Daytime overcast - medium grays
            gradient = Gradient(colors: [
                Color(red: 0.65, green: 0.68, blue: 0.72), // Medium gray-blue top
                Color(red: 0.72, green: 0.72, blue: 0.74)  // Light gray bottom
            ])
            startPoint = CGPoint(x: 0, y: 0)
            endPoint = CGPoint(x: 0, y: size.height)

        case (.overcast, false):
            // Nighttime overcast - very dark grays
            gradient = Gradient(colors: [
                Color(red: 0.20, green: 0.22, blue: 0.28), // Very dark gray-blue top
                Color(red: 0.30, green: 0.32, blue: 0.36)  // Dark gray bottom
            ])
            startPoint = CGPoint(x: 0, y: 0)
            endPoint = CGPoint(x: 0, y: size.height)
        }

        let gradientRect = CGRect(origin: .zero, size: size)
        context.fill(
            Path(roundedRect: gradientRect, cornerRadius: 0),
            with: .linearGradient(gradient, startPoint: startPoint, endPoint: endPoint)
        )
    }

    /// Draws the partly cloudy scene with sun peeking through and distinct clouds
    /// - Parameters:
    ///   - context: Canvas rendering context
    ///   - size: Canvas size
    ///   - time: Current animation time for movement
    private func drawPartlyCloudyScene(context: inout GraphicsContext, size: CGSize, time: Double) {
        // Sun peeking through (upper right) - only during daytime
        if isDaytime {
            drawSun(context: &context, size: size, opacity: 0.7)
        }

        // Cloud 1: Slow moving, upper-left area
        let cloud1X = fmod(time * 20, size.width + 150) - 75
        drawCloud(context: &context, position: CGPoint(x: cloud1X, y: size.height * 0.25),
                  size: CGSize(width: 120, height: 60), opacity: 0.75)

        // Cloud 2: Medium speed, middle area
        let cloud2X = fmod(time * 30, size.width + 150) - 75
        drawCloud(context: &context, position: CGPoint(x: cloud2X, y: size.height * 0.45),
                  size: CGSize(width: 140, height: 70), opacity: 0.68)

        // Cloud 3: Faster speed, lower area
        let cloud3X = fmod(time * 40, size.width + 150) - 75
        drawCloud(context: &context, position: CGPoint(x: cloud3X, y: size.height * 0.65),
                  size: CGSize(width: 100, height: 50), opacity: 0.72)

        // Cloud 4: Slow speed, high up
        let cloud4X = fmod(time * 25, size.width + 150) - 75
        drawCloud(context: &context, position: CGPoint(x: cloud4X, y: size.height * 0.15),
                  size: CGSize(width: 110, height: 55), opacity: 0.70)
    }

    /// Draws the overcast scene with dense overlapping cloud layers
    /// - Parameters:
    ///   - context: Canvas rendering context
    ///   - size: Canvas size
    ///   - time: Current animation time for movement
    private func drawOvercastScene(context: inout GraphicsContext, size: CGSize, time: Double) {
        // Bottom layer: Large overlapping clouds (slowest)
        for i in 0..<3 {
            let offset = time * 15 + Double(i) * 200
            let x = fmod(offset, size.width + 200) - 100
            let y = size.height * (0.6 + CGFloat(i) * 0.15)
            drawCloud(context: &context, position: CGPoint(x: x, y: y),
                      size: CGSize(width: 180, height: 90), opacity: 0.75)
        }

        // Middle layer: Medium clouds (medium speed)
        for i in 0..<4 {
            let offset = time * 25 + Double(i) * 150
            let x = fmod(offset, size.width + 200) - 100
            let y = size.height * (0.35 + CGFloat(i) * 0.12)
            drawCloud(context: &context, position: CGPoint(x: x, y: y),
                      size: CGSize(width: 160, height: 75), opacity: 0.72)
        }

        // Top layer: Smaller clouds (fastest)
        for i in 0..<3 {
            let offset = time * 35 + Double(i) * 250
            let x = fmod(offset, size.width + 200) - 100
            let y = size.height * (0.1 + CGFloat(i) * 0.15)
            drawCloud(context: &context, position: CGPoint(x: x, y: y),
                      size: CGSize(width: 140, height: 65), opacity: 0.70)
        }
    }

    /// Draws a single cloud shape using rounded overlapping circles
    /// - Parameters:
    ///   - context: Canvas rendering context
    ///   - position: Center position of the cloud
    ///   - size: Dimensions of the cloud
    ///   - opacity: Alpha value for the cloud
    private func drawCloud(context: inout GraphicsContext, position: CGPoint,
                          size: CGSize, opacity: Double) {
        // Darker clouds at night
        let cloudColor = isDaytime
            ? Color(red: 0.90, green: 0.90, blue: 0.92).opacity(opacity)
            : Color(red: 0.35, green: 0.37, blue: 0.42).opacity(opacity)

        // Cloud is made of 4 overlapping circles for organic appearance
        let circleRadius1: CGFloat = size.width * 0.35
        let circleRadius2: CGFloat = size.width * 0.40
        let circleRadius3: CGFloat = size.width * 0.35
        let circleRadius4: CGFloat = size.width * 0.30

        // Left bump
        let leftCircle = CGRect(
            x: position.x - size.width * 0.25 - circleRadius1,
            y: position.y - circleRadius1,
            width: circleRadius1 * 2,
            height: circleRadius1 * 2
        )
        context.fill(Path(ellipseIn: leftCircle), with: .color(cloudColor))

        // Left-center bump
        let leftCenterCircle = CGRect(
            x: position.x - size.width * 0.05 - circleRadius2,
            y: position.y - size.height * 0.15 - circleRadius2,
            width: circleRadius2 * 2,
            height: circleRadius2 * 2
        )
        context.fill(Path(ellipseIn: leftCenterCircle), with: .color(cloudColor))

        // Right-center bump
        let rightCenterCircle = CGRect(
            x: position.x + size.width * 0.05 - circleRadius3,
            y: position.y - size.height * 0.10 - circleRadius3,
            width: circleRadius3 * 2,
            height: circleRadius3 * 2
        )
        context.fill(Path(ellipseIn: rightCenterCircle), with: .color(cloudColor))

        // Right bump
        let rightCircle = CGRect(
            x: position.x + size.width * 0.25 - circleRadius4,
            y: position.y - circleRadius4,
            width: circleRadius4 * 2,
            height: circleRadius4 * 2
        )
        context.fill(Path(ellipseIn: rightCircle), with: .color(cloudColor))
    }

    /// Draws a semi-transparent sun shape
    /// - Parameters:
    ///   - context: Canvas rendering context
    ///   - size: Canvas size
    ///   - opacity: Alpha value for the sun
    private func drawSun(context: inout GraphicsContext, size: CGSize, opacity: Double) {
        let sunSize: CGFloat = 80
        let sunPosition = CGPoint(x: size.width * 0.80, y: size.height * 0.15)

        let sunColor = Color(red: 1.0, green: 0.95, blue: 0.60).opacity(opacity * 0.8)

        let sunRect = CGRect(
            x: sunPosition.x - sunSize / 2,
            y: sunPosition.y - sunSize / 2,
            width: sunSize,
            height: sunSize
        )

        context.fill(Path(ellipseIn: sunRect), with: .color(sunColor))

        // Add subtle glow
        let glowColor = Color(red: 1.0, green: 0.95, blue: 0.60).opacity(opacity * 0.3)
        let glowSize = sunSize * 1.4
        let glowRect = CGRect(
            x: sunPosition.x - glowSize / 2,
            y: sunPosition.y - glowSize / 2,
            width: glowSize,
            height: glowSize
        )
        context.fill(Path(ellipseIn: glowRect), with: .color(glowColor))
    }
}

// MARK: - Previews

#Preview("Partly Cloudy - Day") {
    CloudyBackground(density: .partly, isDaytime: true)
        .frame(height: 400)
}

#Preview("Partly Cloudy - Night") {
    CloudyBackground(density: .partly, isDaytime: false)
        .frame(height: 400)
}

#Preview("Overcast - Day") {
    CloudyBackground(density: .overcast, isDaytime: true)
        .frame(height: 400)
}

#Preview("Overcast - Night") {
    CloudyBackground(density: .overcast, isDaytime: false)
        .frame(height: 400)
}
