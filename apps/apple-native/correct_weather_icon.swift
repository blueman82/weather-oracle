private func weatherIcon(_ code: WeatherCode) -> String {
    switch code {
    case .clearSky: return "sun.max.fill"
    case .mainlyClear: return "sun.max"
    case .partlyCloudy: return "cloud.sun.fill"
    case .overcast: return "cloud.fill"
    case .fog, .depositingRimeFog: return "cloud.fog.fill"
    case .lightDrizzle, .moderateDrizzle, .denseDrizzle: return "cloud.drizzle.fill"
    case .lightFreezingDrizzle, .denseFreezingDrizzle: return "cloud.sleet.fill"
    case .slightRain, .moderateRain: return "cloud.rain.fill"
    case .heavyRain: return "cloud.heavyrain.fill"
    case .lightFreezingRain, .heavyFreezingRain: return "cloud.sleet.fill"
    case .slightSnow, .moderateSnow, .heavySnow: return "cloud.snow.fill"
    case .snowGrains: return "cloud.snow"
    case .slightRainShowers, .moderateRainShowers, .violentRainShowers: return "cloud.rain.fill"
    case .slightSnowShowers, .heavySnowShowers: return "cloud.snow.fill"
    case .thunderstorm, .thunderstormWithSlightHail, .thunderstormWithHeavyHail: return "cloud.bolt.rain.fill"
    }
}
