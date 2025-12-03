import Foundation
import SharedKit

// MARK: - Weather Icon Provider

/// Provides centralized weather icon logic with comprehensive day/night awareness.
///
/// This provider maps WMO weather codes to appropriate SF Symbols, taking into account
/// whether it's daytime or nighttime to select contextually appropriate icons.
///
/// Day/night determination uses sunrise/sunset times when available, with a fallback
/// to a simple hour-based heuristic (6 AM - 8 PM local time) if full sun times are
/// not provided.
public struct WeatherIconProvider {
    /// Determines whether the given timestamp falls during daytime hours.
    ///
    /// This function uses sunrise and sunset times when both are provided for accurate
    /// determination of whether a moment is daytime. If sun times are not available,
    /// it falls back to a simple hour-based check using the device's local timezone.
    ///
    /// - Parameters:
    ///   - timestamp: The date and time to check
    ///   - sunrise: The sunrise time for the day, or nil if not available
    ///   - sunset: The sunset time for the day, or nil if not available
    /// - Returns: `true` if the timestamp falls during daytime, `false` for nighttime
    ///
    /// ## Logic Details
    /// - **With sunrise/sunset**: Returns `true` if timestamp is between sunrise and sunset
    /// - **Fallback**: Returns `true` if the hour (in local time) is between 6 AM and 8 PM
    ///
    /// ## Example
    /// ```swift
    /// let timestamp = Date()
    /// let sunrise = Calendar.current.date(bySettingHour: 6, minute: 30, second: 0, of: timestamp)!
    /// let sunset = Calendar.current.date(bySettingHour: 18, minute: 45, second: 0, of: timestamp)!
    ///
    /// let isDaytime = WeatherIconProvider.isDaytime(timestamp, sunrise: sunrise, sunset: sunset)
    /// ```
    public static func isDaytime(_ timestamp: Date, sunrise: Date?, sunset: Date?) -> Bool {
        if let sunrise = sunrise, let sunset = sunset {
            // Use actual sunrise/sunset times for accurate determination
            let result = timestamp >= sunrise && timestamp < sunset
            print("🌅 DEBUG: Using sunrise/sunset - timestamp: \(timestamp), sunrise: \(sunrise), sunset: \(sunset), isDaytime: \(result)")
            return result
        }

        // Fallback: use hour-based heuristic (6 AM - 8 PM local time)
        let hour = Calendar.current.component(.hour, from: timestamp)
        let result = hour >= 6 && hour < 20
        print("⏰ DEBUG: Using hour fallback - hour: \(hour), isDaytime: \(result)")
        return result
    }

    /// Returns the appropriate SF Symbol name for the given weather code and time of day.
    ///
    /// This function selects weather icons based on the WMO weather code and whether
    /// it is currently daytime or nighttime. Some weather conditions have day/night variants
    /// (such as clear sky, partly cloudy), while others use the same icon regardless of
    /// time of day (such as fog, rain, snow).
    ///
    /// - Parameters:
    ///   - code: The WMO weather code
    ///   - timestamp: The date and time for which to determine the icon
    ///   - sunrise: The sunrise time for the day, or nil if not available
    ///   - sunset: The sunset time for the day, or nil if not available
    /// - Returns: A valid SF Symbol name string
    ///
    /// ## Day/Night Variants
    /// The following weather conditions have different icons for day vs. night:
    /// - Clear sky: "sun.max.fill" (day) / "moon.stars.fill" (night)
    /// - Mainly clear: "sun.max" (day) / "moon.stars" (night)
    /// - Partly cloudy: "cloud.sun.fill" (day) / "cloud.moon.fill" (night)
    ///
    /// All other weather codes use the same icon regardless of time of day.
    ///
    /// ## Example
    /// ```swift
    /// let timestamp = Date()
    /// let sunrise = Calendar.current.date(bySettingHour: 6, minute: 30, second: 0, of: timestamp)!
    /// let sunset = Calendar.current.date(bySettingHour: 18, minute: 45, second: 0, of: timestamp)!
    ///
    /// let icon = WeatherIconProvider.icon(
    ///     for: .clearSky,
    ///     at: timestamp,
    ///     sunrise: sunrise,
    ///     sunset: sunset
    /// )
    /// ```
    public static func icon(
        for code: WeatherCode,
        at timestamp: Date,
        sunrise: Date?,
        sunset: Date?
    ) -> String {
        let daytime = isDaytime(timestamp, sunrise: sunrise, sunset: sunset)
        print("☀️🌙 DEBUG: icon() called - code: \(code), daytime: \(daytime)")

        switch code {
        // Clear/Mainly Clear - Day/Night variants
        case .clearSky:
            return daytime ? "sun.max.fill" : "moon.stars.fill"

        case .mainlyClear:
            return daytime ? "sun.max" : "moon.stars"

        case .partlyCloudy:
            return daytime ? "cloud.sun.fill" : "cloud.moon.fill"

        // Overcast and fog
        case .overcast:
            return "cloud.fill"

        case .fog, .depositingRimeFog:
            return "cloud.fog.fill"

        // Drizzle conditions
        case .lightDrizzle, .moderateDrizzle, .denseDrizzle:
            return "cloud.drizzle.fill"

        case .lightFreezingDrizzle, .denseFreezingDrizzle:
            return "cloud.sleet.fill"

        // Rain conditions
        case .slightRain, .moderateRain:
            return "cloud.rain.fill"

        case .heavyRain:
            return "cloud.heavyrain.fill"

        // Freezing rain
        case .lightFreezingRain, .heavyFreezingRain:
            return "cloud.sleet.fill"

        // Snow conditions
        case .slightSnow, .moderateSnow, .heavySnow:
            return "cloud.snow.fill"

        case .snowGrains:
            return "cloud.snow"

        // Rain showers
        case .slightRainShowers, .moderateRainShowers, .violentRainShowers:
            return "cloud.rain.fill"

        // Snow showers
        case .slightSnowShowers, .heavySnowShowers:
            return "cloud.snow.fill"

        // Thunderstorms
        case .thunderstorm, .thunderstormWithSlightHail, .thunderstormWithHeavyHail:
            return "cloud.bolt.rain.fill"
        }
    }
}
