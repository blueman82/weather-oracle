import SwiftUI
import SharedKit

/// A coordinator view that maps WeatherCode cases to appropriate animated backgrounds.
///
/// This view handles the selection and rendering of weather-specific background animations
/// based on the current weather condition. It includes logic for day/night detection to
/// display contextually appropriate backgrounds for clear sky conditions.
///
/// All 28 WMO weather codes are supported with exhaustive matching to ensure complete
/// coverage of weather conditions.
///
/// Example usage:
/// ```swift
/// WeatherBackgroundView(
///     weatherCode: .moderateRain,
///     timestamp: Date(),
///     sunrise: Date(),
///     sunset: Date()
/// )
/// .ignoresSafeArea()
/// ```
struct WeatherBackgroundView: View {
    /// The weather code determining which background to display
    let weatherCode: WeatherCode

    /// The current timestamp for day/night detection
    let timestamp: Date

    /// The sunrise time for the location, used for day/night determination
    let sunrise: Date?

    /// The sunset time for the location, used for day/night determination
    let sunset: Date?

    /// Determines if the current timestamp falls within daytime hours.
    ///
    /// Uses sunrise and sunset times if available, otherwise falls back to
    /// a simple hour-based heuristic (6 AM to 8 PM considered daytime).
    private var isDaytime: Bool {
        if let sunrise = sunrise, let sunset = sunset {
            return timestamp >= sunrise && timestamp < sunset
        }
        let hour = Calendar.current.component(.hour, from: timestamp)
        return hour >= 6 && hour < 20
    }

    var body: some View {
        backgroundView
            .ignoresSafeArea()
    }

    /// Returns the appropriate background view for the given weather code.
    ///
    /// Exhaustively matches all 28 WMO weather codes to specific background
    /// animations, considering day/night conditions for clear sky scenarios.
    @ViewBuilder
    private var backgroundView: some View {
        switch weatherCode {
        // MARK: - Clear Sky Conditions
        case .clearSky:
            if isDaytime {
                ClearSkyDayBackground()
            } else {
                ClearSkyNightBackground()
            }

        case .mainlyClear:
            if isDaytime {
                ClearSkyDayBackground()
            } else {
                ClearSkyNightBackground()
            }

        // MARK: - Cloudy Conditions
        case .partlyCloudy:
            CloudyBackground(density: .partly)

        case .overcast:
            CloudyBackground(density: .overcast)

        // MARK: - Fog Conditions
        case .fog:
            FogBackground()

        case .depositingRimeFog:
            FogBackground()

        // MARK: - Drizzle Conditions
        case .lightDrizzle:
            RainBackground(intensity: .light)

        case .moderateDrizzle:
            RainBackground(intensity: .light)

        case .denseDrizzle:
            RainBackground(intensity: .light)

        // MARK: - Freezing Drizzle Conditions
        case .lightFreezingDrizzle:
            RainBackground(intensity: .light)

        case .denseFreezingDrizzle:
            RainBackground(intensity: .light)

        // MARK: - Rain Conditions
        case .slightRain:
            RainBackground(intensity: .light)

        case .moderateRain:
            RainBackground(intensity: .moderate)

        case .heavyRain:
            RainBackground(intensity: .heavy)

        // MARK: - Freezing Rain Conditions
        case .lightFreezingRain:
            RainBackground(intensity: .moderate)

        case .heavyFreezingRain:
            RainBackground(intensity: .moderate)

        // MARK: - Snow Conditions
        case .slightSnow:
            SnowBackground(intensity: .light)

        case .moderateSnow:
            SnowBackground(intensity: .moderate)

        case .heavySnow:
            SnowBackground(intensity: .heavy)

        case .snowGrains:
            SnowBackground(intensity: .moderate)

        // MARK: - Snow Shower Conditions
        case .slightSnowShowers:
            SnowBackground(intensity: .light)

        case .heavySnowShowers:
            SnowBackground(intensity: .heavy)

        // MARK: - Rain Shower Conditions
        case .slightRainShowers:
            RainBackground(intensity: .light)

        case .moderateRainShowers:
            RainBackground(intensity: .moderate)

        case .violentRainShowers:
            RainBackground(intensity: .heavy)

        // MARK: - Thunderstorm Conditions
        case .thunderstorm:
            ThunderstormBackground()

        case .thunderstormWithSlightHail:
            ThunderstormBackground()

        case .thunderstormWithHeavyHail:
            ThunderstormBackground()
        }
    }
}

// MARK: - Previews

#Preview("Clear Day") {
    WeatherBackgroundView(
        weatherCode: .clearSky,
        timestamp: {
            var components = DateComponents()
            components.hour = 12
            components.minute = 0
            return Calendar.current.date(from: components) ?? Date()
        }(),
        sunrise: {
            var components = DateComponents()
            components.hour = 6
            components.minute = 0
            return Calendar.current.date(from: components) ?? Date()
        }(),
        sunset: {
            var components = DateComponents()
            components.hour = 18
            components.minute = 0
            return Calendar.current.date(from: components) ?? Date()
        }()
    )
}

#Preview("Heavy Rain") {
    WeatherBackgroundView(
        weatherCode: .heavyRain,
        timestamp: Date(),
        sunrise: nil,
        sunset: nil
    )
}

#Preview("Thunderstorm") {
    WeatherBackgroundView(
        weatherCode: .thunderstorm,
        timestamp: Date(),
        sunrise: nil,
        sunset: nil
    )
}
