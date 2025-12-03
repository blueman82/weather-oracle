import SwiftUI
import WidgetKit
import SharedKit

// MARK: - Widget Bundle

@main
struct WeatherOracleWidgetBundle: WidgetBundle {
    var body: some Widget {
        WeatherOracleHomeWidget()
        WeatherOracleLockScreenWidget()
        WeatherOracleStandByWidget()
    }
}

// MARK: - Home Screen Widget

/// Home screen widget with small, medium, and large sizes
struct WeatherOracleHomeWidget: Widget {
    let kind: String = "WeatherOracleHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: WeatherWidgetTimelineProvider()
        ) { entry in
            HomeWidgetView(entry: entry)
        }
        .configurationDisplayName("Weather Oracle")
        .description("See current weather and forecasts at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled() // For edge-to-edge content
    }
}

/// Dynamic view that adapts to widget family size
struct HomeWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: WeatherWidgetEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallHomeWidgetView(entry: entry)
        case .systemMedium:
            MediumHomeWidgetView(entry: entry)
        case .systemLarge:
            LargeHomeWidgetView(entry: entry)
        default:
            SmallHomeWidgetView(entry: entry)
        }
    }
}

// MARK: - Lock Screen Widget

/// Lock Screen accessory widgets (inline, circular, rectangular)
struct WeatherOracleLockScreenWidget: Widget {
    let kind: String = "WeatherOracleLockScreenWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: WeatherWidgetTimelineProvider()
        ) { entry in
            LockScreenWidgetView(entry: entry)
        }
        .configurationDisplayName("Weather Oracle Lock Screen")
        .description("Quick weather glance on your Lock Screen.")
        .supportedFamilies([
            .accessoryInline,
            .accessoryCircular,
            .accessoryRectangular
        ])
    }
}

/// Dynamic view for Lock Screen accessories
struct LockScreenWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: WeatherWidgetEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            InlineAccessoryWidgetView(entry: entry)
        case .accessoryCircular:
            CircularAccessoryWidgetView(entry: entry)
        case .accessoryRectangular:
            RectangularAccessoryWidgetView(entry: entry)
        default:
            InlineAccessoryWidgetView(entry: entry)
        }
    }
}

// MARK: - StandBy Widget

/// StandBy mode widget for bedside display
struct WeatherOracleStandByWidget: Widget {
    let kind: String = "WeatherOracleStandByWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: WeatherWidgetTimelineProvider()
        ) { entry in
            StandByWidgetView(entry: entry)
        }
        .configurationDisplayName("Weather Oracle StandBy")
        .description("Large weather display for bedside charging.")
        .supportedFamilies([.systemExtraLarge])
    }
}

// MARK: - Widget Previews

#Preview("Small Home", as: .systemSmall) {
    WeatherOracleHomeWidget()
} timeline: {
    WeatherWidgetEntry.placeholder
    sampleEntry()
}

#Preview("Medium Home", as: .systemMedium) {
    WeatherOracleHomeWidget()
} timeline: {
    sampleEntry()
}

#Preview("Large Home", as: .systemLarge) {
    WeatherOracleHomeWidget()
} timeline: {
    sampleEntry()
}

#Preview("Inline Lock Screen", as: .accessoryInline) {
    WeatherOracleLockScreenWidget()
} timeline: {
    sampleEntry()
}

#Preview("Circular Lock Screen", as: .accessoryCircular) {
    WeatherOracleLockScreenWidget()
} timeline: {
    sampleEntry()
}

#Preview("Rectangular Lock Screen", as: .accessoryRectangular) {
    WeatherOracleLockScreenWidget()
} timeline: {
    sampleEntry()
}

#Preview("StandBy", as: .systemExtraLarge) {
    WeatherOracleStandByWidget()
} timeline: {
    sampleEntry()
}

// MARK: - Sample Data

private func sampleEntry() -> WeatherWidgetEntry {
    let coords = Coordinates(
        latitude: Latitude(rawValue: 40.7128)!,
        longitude: Longitude(rawValue: -74.0060)!
    )

    let location = LocationEntity(
        query: "New York",
        resolved: GeocodingResult(
            name: "New York",
            coordinates: coords,
            country: "United States",
            countryCode: "US",
            timezone: "America/New_York"
        )
    )

    let now = Date()

    // Create sample hourly forecasts
    let hourlyForecasts = (0..<24).map { hour -> AggregatedHourlyForecast in
        let timestamp = now.addingTimeInterval(Double(hour) * 3600)
        let temp = 20.0 + sin(Double(hour) / 24.0 * 2 * .pi) * 8

        let metrics = WeatherMetrics(
            temperature: Celsius(rawValue: temp),
            feelsLike: Celsius(rawValue: temp - 2),
            humidity: Humidity(rawValue: 65)!,
            pressure: Pressure(rawValue: 1013)!,
            windSpeed: MetersPerSecond(rawValue: 5)!,
            windDirection: WindDirection(rawValue: 180),
            precipitation: Millimeters.clamped(Double(hour % 6)),
            precipitationProbability: 0.3,
            cloudCover: CloudCover(rawValue: 40)!,
            visibility: Visibility(rawValue: 10000)!,
            uvIndex: UVIndex(rawValue: 5)!,
            weatherCode: hour < 6 || hour > 18 ? .clearSky : .partlyCloudy
        )

        let consensus = ModelConsensus(
            agreementScore: 0.85,
            modelsInAgreement: [.ecmwf, .gfs, .icon],
            outlierModels: [],
            temperatureStats: MetricStatistics(mean: temp, median: temp, min: temp - 2, max: temp + 2, stdDev: 1.0, range: 4.0),
            precipitationStats: MetricStatistics(mean: 0.5, median: 0.5, min: 0, max: 1, stdDev: 0.3, range: 1.0),
            windStats: MetricStatistics(mean: 5, median: 5, min: 4, max: 6, stdDev: 0.5, range: 2.0)
        )

        let range = HourlyRange(
            temperature: MetricRange(min: temp - 2, max: temp + 2),
            precipitation: MetricRange(min: 0, max: 2),
            windSpeed: MetricRange(min: 4, max: 6)
        )

        let confidence = ConfidenceLevel.from(score: 0.85)!

        return AggregatedHourlyForecast(
            timestamp: timestamp,
            metrics: metrics,
            confidence: confidence,
            modelAgreement: consensus,
            range: range
        )
    }

    // Create sample daily forecasts
    let dailyForecasts = (0..<7).map { day -> AggregatedDailyForecast in
        let date = Calendar.current.date(byAdding: .day, value: Int(day), to: now)!

        let forecast = DailyForecast(
            date: date,
            temperature: TemperatureRange(
                min: Celsius(rawValue: 12 + Double(day % 3)),
                max: Celsius(rawValue: 24 + Double(day % 3))
            ),
            humidityRange: HumidityRange(
                min: Humidity(rawValue: 50)!,
                max: Humidity(rawValue: 80)!
            ),
            pressureRange: PressureRange(
                min: Pressure(rawValue: 1010)!,
                max: Pressure(rawValue: 1016)!
            ),
            precipitation: PrecipitationSummary(
                total: Millimeters.clamped(Double(day % 3) * 2),
                probability: Double(day % 3) * 0.3,
                hours: day % 3
            ),
            wind: WindSummary(
                avgSpeed: MetersPerSecond(rawValue: 4)!,
                maxSpeed: MetersPerSecond(rawValue: 8)!,
                dominantDirection: WindDirection(rawValue: 180)
            ),
            cloudCoverSummary: CloudCoverSummary(
                avg: CloudCover(rawValue: 40)!,
                max: CloudCover(rawValue: 70)!
            ),
            uvIndexMax: UVIndex(rawValue: 7)!,
            sun: SunTimes(
                sunrise: date.addingTimeInterval(-6 * 3600),
                sunset: date.addingTimeInterval(6 * 3600),
                daylightHours: 12
            ),
            weatherCode: day % 2 == 0 ? .clearSky : .partlyCloudy,
            hourly: []
        )

        let consensus = ModelConsensus(
            agreementScore: 0.8,
            modelsInAgreement: [.ecmwf, .gfs, .icon],
            outlierModels: [],
            temperatureStats: MetricStatistics(mean: 18, median: 18, min: 12, max: 24, stdDev: 2.0, range: 12.0),
            precipitationStats: MetricStatistics(mean: 2, median: 2, min: 0, max: 6, stdDev: 1.5, range: 6.0),
            windStats: MetricStatistics(mean: 5, median: 5, min: 4, max: 6, stdDev: 0.5, range: 2.0)
        )

        let range = DailyRange(
            temperatureMax: MetricRange(min: 22, max: 26),
            temperatureMin: MetricRange(min: 10, max: 14),
            precipitation: MetricRange(min: 0, max: 6)
        )

        let confidence = ConfidenceLevel.from(score: 0.8)!

        return AggregatedDailyForecast(
            date: date,
            forecast: forecast,
            confidence: confidence,
            modelAgreement: consensus,
            range: range
        )
    }

    let consensus = ForecastConsensus(hourly: hourlyForecasts, daily: dailyForecasts)

    let forecast = AggregatedForecast(
        coordinates: coords,
        generatedAt: now,
        validFrom: now,
        validTo: now.addingTimeInterval(7 * 24 * 3600),
        models: [.ecmwf, .gfs, .icon],
        modelForecasts: [],
        consensus: consensus,
        modelWeights: [],
        overallConfidence: ConfidenceLevel.from(score: 0.85)!
    )

    return WeatherWidgetEntry(
        date: now,
        forecast: forecast,
        location: location,
        lastUpdate: now,
        configuration: .default
    )
}
