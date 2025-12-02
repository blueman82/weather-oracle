import Foundation

// MARK: - Branded Weather Types

/// Temperature in Celsius.
/// Swift equivalent of TypeScript: `type Celsius = number & { readonly __brand: "Celsius" }`
public struct Celsius: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init(rawValue: Double) {
        self.rawValue = rawValue
    }

    /// Convert to Fahrenheit.
    public var fahrenheit: Double {
        rawValue * 9 / 5 + 32
    }

    /// Create from Fahrenheit value.
    public static func fromFahrenheit(_ value: Double) -> Celsius {
        Celsius(rawValue: (value - 32) * 5 / 9)
    }
}

/// Precipitation amount in millimeters.
/// Swift equivalent of TypeScript: `type Millimeters = number & { readonly __brand: "Millimeters" }`
public struct Millimeters: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= 0 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a Millimeters value, clamping negative values to zero.
    public static func clamped(_ value: Double) -> Millimeters {
        Millimeters(rawValue: max(0, value))!
    }
}

/// Wind speed in meters per second.
/// Swift equivalent of TypeScript: `type MetersPerSecond = number & { readonly __brand: "MetersPerSecond" }`
public struct MetersPerSecond: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= 0 else { return nil }
        self.rawValue = rawValue
    }

    /// Convert to km/h.
    public var kmPerHour: Double { rawValue * 3.6 }

    /// Convert to mph.
    public var mph: Double { rawValue * 2.237 }

    /// Creates a MetersPerSecond value, clamping negative values to zero.
    public static func clamped(_ value: Double) -> MetersPerSecond {
        MetersPerSecond(rawValue: max(0, value))!
    }
}

/// Wind direction in degrees (0-360, where 0 = North).
/// Swift equivalent of TypeScript: `type WindDirection = number & { readonly __brand: "WindDirection" }`
public struct WindDirection: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init(rawValue: Double) {
        // Normalize to 0-360 range
        self.rawValue = ((rawValue.truncatingRemainder(dividingBy: 360)) + 360)
            .truncatingRemainder(dividingBy: 360)
    }

    /// Cardinal direction string (N, NE, E, etc.).
    public var cardinal: String {
        let directions = [
            "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
        ]
        let index = Int((rawValue / 22.5).rounded()) % 16
        return directions[index]
    }
}

/// Relative humidity as percentage (0-100).
/// Swift equivalent of TypeScript: `type Humidity = number & { readonly __brand: "Humidity" }`
public struct Humidity: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= 0, rawValue <= 100 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a Humidity value, clamping to 0-100 range.
    public static func clamped(_ value: Double) -> Humidity {
        Humidity(rawValue: min(100, max(0, value)))!
    }
}

/// Atmospheric pressure in hectopascals (hPa).
/// Swift equivalent of TypeScript: `type Pressure = number & { readonly __brand: "Pressure" }`
public struct Pressure: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= 0 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a Pressure value, clamping negative values to zero.
    public static func clamped(_ value: Double) -> Pressure {
        Pressure(rawValue: max(0, value))!
    }
}

/// Cloud cover as percentage (0-100).
/// Swift equivalent of TypeScript: `type CloudCover = number & { readonly __brand: "CloudCover" }`
public struct CloudCover: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= 0, rawValue <= 100 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a CloudCover value, clamping to 0-100 range.
    public static func clamped(_ value: Double) -> CloudCover {
        CloudCover(rawValue: min(100, max(0, value)))!
    }
}

/// UV index (0-11+).
/// Swift equivalent of TypeScript: `type UVIndex = number & { readonly __brand: "UVIndex" }`
public struct UVIndex: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= 0 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a UVIndex value, clamping negative values to zero.
    public static func clamped(_ value: Double) -> UVIndex {
        UVIndex(rawValue: max(0, value))!
    }

    /// UV exposure category.
    public var category: String {
        switch rawValue {
        case 0 ..< 3: return "Low"
        case 3 ..< 6: return "Moderate"
        case 6 ..< 8: return "High"
        case 8 ..< 11: return "Very High"
        default: return "Extreme"
        }
    }
}

/// Visibility in meters.
/// Swift equivalent of TypeScript: `type Visibility = number & { readonly __brand: "Visibility" }`
public struct Visibility: RawRepresentable, Codable, Sendable, Hashable {
    public let rawValue: Double

    public init?(rawValue: Double) {
        guard rawValue >= 0 else { return nil }
        self.rawValue = rawValue
    }

    /// Creates a Visibility value, clamping negative values to zero.
    public static func clamped(_ value: Double) -> Visibility {
        Visibility(rawValue: max(0, value))!
    }

    /// Visibility in kilometers.
    public var kilometers: Double { rawValue / 1000 }
}

// MARK: - Weather Code Enum

/// WMO standard weather codes.
/// Swift equivalent of TypeScript: `type WeatherCode = number & { readonly __brand: "WeatherCode" }`
public enum WeatherCode: Int, Codable, Sendable, CaseIterable {
    case clearSky = 0
    case mainlyClear = 1
    case partlyCloudy = 2
    case overcast = 3
    case fog = 45
    case depositingRimeFog = 48
    case lightDrizzle = 51
    case moderateDrizzle = 53
    case denseDrizzle = 55
    case lightFreezingDrizzle = 56
    case denseFreezingDrizzle = 57
    case slightRain = 61
    case moderateRain = 63
    case heavyRain = 65
    case lightFreezingRain = 66
    case heavyFreezingRain = 67
    case slightSnow = 71
    case moderateSnow = 73
    case heavySnow = 75
    case snowGrains = 77
    case slightRainShowers = 80
    case moderateRainShowers = 81
    case violentRainShowers = 82
    case slightSnowShowers = 85
    case heavySnowShowers = 86
    case thunderstorm = 95
    case thunderstormWithSlightHail = 96
    case thunderstormWithHeavyHail = 99

    /// Human-readable description.
    public var description: String {
        switch self {
        case .clearSky: return "Clear sky"
        case .mainlyClear: return "Mainly clear"
        case .partlyCloudy: return "Partly cloudy"
        case .overcast: return "Overcast"
        case .fog: return "Fog"
        case .depositingRimeFog: return "Depositing rime fog"
        case .lightDrizzle: return "Light drizzle"
        case .moderateDrizzle: return "Moderate drizzle"
        case .denseDrizzle: return "Dense drizzle"
        case .lightFreezingDrizzle: return "Light freezing drizzle"
        case .denseFreezingDrizzle: return "Dense freezing drizzle"
        case .slightRain: return "Slight rain"
        case .moderateRain: return "Moderate rain"
        case .heavyRain: return "Heavy rain"
        case .lightFreezingRain: return "Light freezing rain"
        case .heavyFreezingRain: return "Heavy freezing rain"
        case .slightSnow: return "Slight snow"
        case .moderateSnow: return "Moderate snow"
        case .heavySnow: return "Heavy snow"
        case .snowGrains: return "Snow grains"
        case .slightRainShowers: return "Slight rain showers"
        case .moderateRainShowers: return "Moderate rain showers"
        case .violentRainShowers: return "Violent rain showers"
        case .slightSnowShowers: return "Slight snow showers"
        case .heavySnowShowers: return "Heavy snow showers"
        case .thunderstorm: return "Thunderstorm"
        case .thunderstormWithSlightHail: return "Thunderstorm with slight hail"
        case .thunderstormWithHeavyHail: return "Thunderstorm with heavy hail"
        }
    }

    /// SF Symbol name for this weather code.
    public var systemImageName: String {
        switch self {
        case .clearSky: return "sun.max.fill"
        case .mainlyClear: return "sun.max.fill"
        case .partlyCloudy: return "cloud.sun.fill"
        case .overcast: return "cloud.fill"
        case .fog, .depositingRimeFog: return "cloud.fog.fill"
        case .lightDrizzle, .moderateDrizzle, .denseDrizzle: return "cloud.drizzle.fill"
        case .lightFreezingDrizzle, .denseFreezingDrizzle: return "cloud.sleet.fill"
        case .slightRain, .moderateRain: return "cloud.rain.fill"
        case .heavyRain: return "cloud.heavyrain.fill"
        case .lightFreezingRain, .heavyFreezingRain: return "cloud.sleet.fill"
        case .slightSnow, .moderateSnow, .heavySnow, .snowGrains: return "cloud.snow.fill"
        case .slightRainShowers, .moderateRainShowers, .violentRainShowers: return "cloud.rain.fill"
        case .slightSnowShowers, .heavySnowShowers: return "cloud.snow.fill"
        case .thunderstorm: return "cloud.bolt.rain.fill"
        case .thunderstormWithSlightHail, .thunderstormWithHeavyHail: return "cloud.bolt.rain.fill"
        }
    }
}

// MARK: - Model Name Enum

/// Supported weather forecast models.
/// Swift equivalent of TypeScript: `type ModelName`
public enum ModelName: String, Codable, Sendable, CaseIterable, Identifiable {
    case ecmwf
    case gfs
    case icon
    case meteofrance
    case ukmo
    case jma
    case gem

    public var id: String { rawValue }

    /// Display name for the model.
    public var displayName: String {
        switch self {
        case .ecmwf: return "ECMWF IFS"
        case .gfs: return "GFS"
        case .icon: return "ICON"
        case .meteofrance: return "ARPEGE"
        case .ukmo: return "UK Met Office"
        case .jma: return "JMA GSM"
        case .gem: return "GEM"
        }
    }

    /// Provider organization.
    public var provider: String {
        switch self {
        case .ecmwf: return "European Centre for Medium-Range Weather Forecasts"
        case .gfs: return "NOAA/NCEP"
        case .icon: return "Deutscher Wetterdienst"
        case .meteofrance: return "Météo-France"
        case .ukmo: return "UK Meteorological Office"
        case .jma: return "Japan Meteorological Agency"
        case .gem: return "Environment Canada"
        }
    }

    /// Model resolution.
    public var resolution: String {
        switch self {
        case .ecmwf: return "9km"
        case .gfs: return "13km"
        case .icon: return "7km"
        case .meteofrance: return "10km"
        case .ukmo: return "10km"
        case .jma: return "20km"
        case .gem: return "15km"
        }
    }

    /// Update frequency.
    public var updateFrequency: String {
        switch self {
        case .gem: return "12 hours"
        default: return "6 hours"
        }
    }
}

// MARK: - Confidence Level

/// Confidence level for forecasts.
/// Swift equivalent of TypeScript: `type ConfidenceLevelName`
public enum ConfidenceLevelName: String, Codable, Sendable {
    case high
    case medium
    case low
}

/// Confidence level with numeric score.
/// Swift equivalent of TypeScript: `interface ConfidenceLevel`
public struct ConfidenceLevel: Codable, Sendable, Hashable {
    public let level: ConfidenceLevelName
    public let score: Double

    private init(level: ConfidenceLevelName, score: Double) {
        self.level = level
        self.score = score
    }

    /// Creates a confidence level from a score (0-1).
    /// - Parameter score: Value between 0 and 1
    /// - Returns: A ConfidenceLevel, or nil if score is out of range
    public static func from(score: Double) -> ConfidenceLevel? {
        guard score >= 0, score <= 1 else { return nil }
        let level: ConfidenceLevelName
        if score >= 0.7 {
            level = .high
        } else if score >= 0.4 {
            level = .medium
        } else {
            level = .low
        }
        return ConfidenceLevel(level: level, score: score)
    }
}

// MARK: - Weather Metrics

/// Core weather metrics at a point in time.
/// Swift equivalent of TypeScript: `interface WeatherMetrics`
public struct WeatherMetrics: Codable, Sendable, Hashable {
    public let temperature: Celsius
    public let feelsLike: Celsius
    public let humidity: Humidity
    public let pressure: Pressure
    public let windSpeed: MetersPerSecond
    public let windDirection: WindDirection
    public let windGust: MetersPerSecond?
    public let precipitation: Millimeters
    public let precipitationProbability: Double
    public let cloudCover: CloudCover
    public let visibility: Visibility
    public let uvIndex: UVIndex
    public let weatherCode: WeatherCode

    public init(
        temperature: Celsius,
        feelsLike: Celsius,
        humidity: Humidity,
        pressure: Pressure,
        windSpeed: MetersPerSecond,
        windDirection: WindDirection,
        windGust: MetersPerSecond? = nil,
        precipitation: Millimeters,
        precipitationProbability: Double,
        cloudCover: CloudCover,
        visibility: Visibility,
        uvIndex: UVIndex,
        weatherCode: WeatherCode
    ) {
        self.temperature = temperature
        self.feelsLike = feelsLike
        self.humidity = humidity
        self.pressure = pressure
        self.windSpeed = windSpeed
        self.windDirection = windDirection
        self.windGust = windGust
        self.precipitation = precipitation
        self.precipitationProbability = precipitationProbability
        self.cloudCover = cloudCover
        self.visibility = visibility
        self.uvIndex = uvIndex
        self.weatherCode = weatherCode
    }
}

// MARK: - Hourly Forecast

/// Single hour's weather forecast.
/// Swift equivalent of TypeScript: `interface HourlyForecast`
public struct HourlyForecast: Codable, Sendable, Hashable, Identifiable {
    public var id: Date { timestamp }
    public let timestamp: Date
    public let metrics: WeatherMetrics

    public init(timestamp: Date, metrics: WeatherMetrics) {
        self.timestamp = timestamp
        self.metrics = metrics
    }
}

// MARK: - Temperature Range

/// Temperature range for a day.
/// Swift equivalent of TypeScript: `interface TemperatureRange`
public struct TemperatureRange: Codable, Sendable, Hashable {
    public let min: Celsius
    public let max: Celsius

    public init(min: Celsius, max: Celsius) {
        self.min = min
        self.max = max
    }
}

// MARK: - Precipitation Summary

/// Precipitation summary for a day.
/// Swift equivalent of TypeScript: `interface PrecipitationSummary`
public struct PrecipitationSummary: Codable, Sendable, Hashable {
    public let total: Millimeters
    public let probability: Double
    public let hours: Int

    public init(total: Millimeters, probability: Double, hours: Int) {
        self.total = total
        self.probability = probability
        self.hours = hours
    }
}

// MARK: - Wind Summary

/// Wind summary for a day.
/// Swift equivalent of TypeScript: `interface WindSummary`
public struct WindSummary: Codable, Sendable, Hashable {
    public let avgSpeed: MetersPerSecond
    public let maxSpeed: MetersPerSecond
    public let dominantDirection: WindDirection

    public init(avgSpeed: MetersPerSecond, maxSpeed: MetersPerSecond, dominantDirection: WindDirection) {
        self.avgSpeed = avgSpeed
        self.maxSpeed = maxSpeed
        self.dominantDirection = dominantDirection
    }
}

// MARK: - Sun Times

/// Sun times for a day.
/// Swift equivalent of TypeScript: `interface SunTimes`
public struct SunTimes: Codable, Sendable, Hashable {
    public let sunrise: Date
    public let sunset: Date
    public let daylightHours: Double

    public init(sunrise: Date, sunset: Date, daylightHours: Double) {
        self.sunrise = sunrise
        self.sunset = sunset
        self.daylightHours = daylightHours
    }
}

// MARK: - Daily Forecast

/// Full daily forecast summary.
/// Swift equivalent of TypeScript: `interface DailyForecast`
public struct DailyForecast: Codable, Sendable, Hashable, Identifiable {
    public var id: Date { date }
    public let date: Date
    public let temperature: TemperatureRange
    public let humidityRange: HumidityRange
    public let pressureRange: PressureRange
    public let precipitation: PrecipitationSummary
    public let wind: WindSummary
    public let cloudCoverSummary: CloudCoverSummary
    public let uvIndexMax: UVIndex
    public let sun: SunTimes
    public let weatherCode: WeatherCode
    public let hourly: [HourlyForecast]

    public init(
        date: Date,
        temperature: TemperatureRange,
        humidityRange: HumidityRange,
        pressureRange: PressureRange,
        precipitation: PrecipitationSummary,
        wind: WindSummary,
        cloudCoverSummary: CloudCoverSummary,
        uvIndexMax: UVIndex,
        sun: SunTimes,
        weatherCode: WeatherCode,
        hourly: [HourlyForecast]
    ) {
        self.date = date
        self.temperature = temperature
        self.humidityRange = humidityRange
        self.pressureRange = pressureRange
        self.precipitation = precipitation
        self.wind = wind
        self.cloudCoverSummary = cloudCoverSummary
        self.uvIndexMax = uvIndexMax
        self.sun = sun
        self.weatherCode = weatherCode
        self.hourly = hourly
    }
}

/// Humidity range for a day.
public struct HumidityRange: Codable, Sendable, Hashable {
    public let min: Humidity
    public let max: Humidity

    public init(min: Humidity, max: Humidity) {
        self.min = min
        self.max = max
    }
}

/// Pressure range for a day.
public struct PressureRange: Codable, Sendable, Hashable {
    public let min: Pressure
    public let max: Pressure

    public init(min: Pressure, max: Pressure) {
        self.min = min
        self.max = max
    }
}

/// Cloud cover summary for a day.
public struct CloudCoverSummary: Codable, Sendable, Hashable {
    public let avg: CloudCover
    public let max: CloudCover

    public init(avg: CloudCover, max: CloudCover) {
        self.avg = avg
        self.max = max
    }
}

// MARK: - Model Forecast

/// Forecast from a single weather model.
/// Swift equivalent of TypeScript: `interface ModelForecast`
public struct ModelForecast: Codable, Sendable, Hashable, Identifiable {
    public var id: String { "\(model.rawValue)-\(generatedAt.timeIntervalSince1970)" }
    public let model: ModelName
    public let coordinates: Coordinates
    public let generatedAt: Date
    public let validFrom: Date
    public let validTo: Date
    public let hourly: [HourlyForecast]
    public let daily: [DailyForecast]

    public init(
        model: ModelName,
        coordinates: Coordinates,
        generatedAt: Date,
        validFrom: Date,
        validTo: Date,
        hourly: [HourlyForecast],
        daily: [DailyForecast]
    ) {
        self.model = model
        self.coordinates = coordinates
        self.generatedAt = generatedAt
        self.validFrom = validFrom
        self.validTo = validTo
        self.hourly = hourly
        self.daily = daily
    }
}

// MARK: - Metric Statistics

/// Statistics for a numeric metric across models.
/// Swift equivalent of TypeScript: `interface MetricStatistics`
public struct MetricStatistics: Codable, Sendable, Hashable {
    public let mean: Double
    public let median: Double
    public let min: Double
    public let max: Double
    public let stdDev: Double
    public let range: Double

    public init(
        mean: Double,
        median: Double,
        min: Double,
        max: Double,
        stdDev: Double,
        range: Double
    ) {
        self.mean = mean
        self.median = median
        self.min = min
        self.max = max
        self.stdDev = stdDev
        self.range = range
    }

    /// Empty statistics for initialization.
    public static let empty = MetricStatistics(
        mean: 0, median: 0, min: 0, max: 0, stdDev: 0, range: 0
    )
}

// MARK: - Model Consensus

/// Agreement metrics across weather models.
/// Swift equivalent of TypeScript: `interface ModelConsensus`
public struct ModelConsensus: Codable, Sendable, Hashable {
    public let agreementScore: Double
    public let modelsInAgreement: [ModelName]
    public let outlierModels: [ModelName]
    public let temperatureStats: MetricStatistics
    public let precipitationStats: MetricStatistics
    public let windStats: MetricStatistics

    public init(
        agreementScore: Double,
        modelsInAgreement: [ModelName],
        outlierModels: [ModelName],
        temperatureStats: MetricStatistics,
        precipitationStats: MetricStatistics,
        windStats: MetricStatistics
    ) {
        self.agreementScore = agreementScore
        self.modelsInAgreement = modelsInAgreement
        self.outlierModels = outlierModels
        self.temperatureStats = temperatureStats
        self.precipitationStats = precipitationStats
        self.windStats = windStats
    }

    /// Empty consensus for initialization.
    public static let empty = ModelConsensus(
        agreementScore: 0,
        modelsInAgreement: [],
        outlierModels: [],
        temperatureStats: .empty,
        precipitationStats: .empty,
        windStats: .empty
    )
}

// MARK: - Model Weight

/// Weighted contribution from a model.
/// Swift equivalent of TypeScript: `interface ModelWeight`
public struct ModelWeight: Codable, Sendable, Hashable {
    public let model: ModelName
    public let weight: Double
    public let reason: String

    public init(model: ModelName, weight: Double, reason: String) {
        self.model = model
        self.weight = weight
        self.reason = reason
    }
}

// MARK: - Visualization Token

/// Immutable struct carrying color/gradient metadata for charting.
/// Used for consistent visualization across the app.
public struct VisualizationToken: Codable, Sendable, Hashable, Identifiable {
    public var id: String { name }
    public let name: String
    public let primaryColorHex: String
    public let secondaryColorHex: String?
    public let gradientStops: [GradientStop]?
    public let opacity: Double

    public init(
        name: String,
        primaryColorHex: String,
        secondaryColorHex: String? = nil,
        gradientStops: [GradientStop]? = nil,
        opacity: Double = 1.0
    ) {
        self.name = name
        self.primaryColorHex = primaryColorHex
        self.secondaryColorHex = secondaryColorHex
        self.gradientStops = gradientStops
        self.opacity = opacity
    }
}

/// Gradient stop for visualization.
public struct GradientStop: Codable, Sendable, Hashable {
    public let colorHex: String
    public let location: Double

    public init(colorHex: String, location: Double) {
        self.colorHex = colorHex
        self.location = location
    }
}

// MARK: - Forecast Series

/// A complete forecast series combining multiple model forecasts.
/// This is the main data structure for displaying forecasts in the app.
public struct ForecastSeries: Codable, Sendable, Hashable, Identifiable {
    public var id: String { "\(location.id)-\(generatedAt.timeIntervalSince1970)" }
    public let location: LocationEntity
    public let generatedAt: Date
    public let validFrom: Date
    public let validTo: Date
    public let models: [ModelName]
    public let modelForecasts: [ModelForecast]
    public let overallConfidence: ConfidenceLevel
    public let modelWeights: [ModelWeight]

    public init(
        location: LocationEntity,
        generatedAt: Date,
        validFrom: Date,
        validTo: Date,
        models: [ModelName],
        modelForecasts: [ModelForecast],
        overallConfidence: ConfidenceLevel,
        modelWeights: [ModelWeight]
    ) {
        self.location = location
        self.generatedAt = generatedAt
        self.validFrom = validFrom
        self.validTo = validTo
        self.models = models
        self.modelForecasts = modelForecasts
        self.overallConfidence = overallConfidence
        self.modelWeights = modelWeights
    }
}
