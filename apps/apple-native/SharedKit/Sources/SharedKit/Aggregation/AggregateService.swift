import Foundation

// MARK: - Spread Metrics

/// Statistical spread metrics for numeric values
public struct SpreadMetrics: Codable, Sendable, Hashable {
    public let mean: Double
    public let median: Double
    public let min: Double
    public let max: Double
    public let stdDev: Double
    public let range: Double

    public init(mean: Double, median: Double, min: Double, max: Double, stdDev: Double, range: Double) {
        self.mean = mean
        self.median = median
        self.min = min
        self.max = max
        self.stdDev = stdDev
        self.range = range
    }

    public static let empty = SpreadMetrics(mean: 0, median: 0, min: 0, max: 0, stdDev: 0, range: 0)
}

// MARK: - Aggregated Types

/// Range of values for a metric across models
public struct MetricRange: Codable, Sendable, Hashable {
    public let min: Double
    public let max: Double

    public init(min: Double, max: Double) {
        self.min = min
        self.max = max
    }
}

/// Range metrics for hourly forecast
public struct HourlyRange: Codable, Sendable, Hashable {
    public let temperature: MetricRange
    public let precipitation: MetricRange
    public let windSpeed: MetricRange

    public init(temperature: MetricRange, precipitation: MetricRange, windSpeed: MetricRange) {
        self.temperature = temperature
        self.precipitation = precipitation
        self.windSpeed = windSpeed
    }
}

/// Range metrics for daily forecast
public struct DailyRange: Codable, Sendable, Hashable {
    public let temperatureMax: MetricRange
    public let temperatureMin: MetricRange
    public let precipitation: MetricRange

    public init(temperatureMax: MetricRange, temperatureMin: MetricRange, precipitation: MetricRange) {
        self.temperatureMax = temperatureMax
        self.temperatureMin = temperatureMin
        self.precipitation = precipitation
    }
}

/// Aggregated hourly forecast from multiple models
public struct AggregatedHourlyForecast: Codable, Sendable, Hashable, Identifiable {
    public var id: Date { timestamp }
    public let timestamp: Date
    public let metrics: WeatherMetrics
    public let confidence: ConfidenceLevel
    public let modelAgreement: ModelConsensus
    public let range: HourlyRange

    public init(
        timestamp: Date,
        metrics: WeatherMetrics,
        confidence: ConfidenceLevel,
        modelAgreement: ModelConsensus,
        range: HourlyRange
    ) {
        self.timestamp = timestamp
        self.metrics = metrics
        self.confidence = confidence
        self.modelAgreement = modelAgreement
        self.range = range
    }
}

/// Aggregated daily forecast from multiple models
public struct AggregatedDailyForecast: Codable, Sendable, Hashable, Identifiable {
    public var id: Date { date }
    public let date: Date
    public let forecast: DailyForecast
    public let confidence: ConfidenceLevel
    public let modelAgreement: ModelConsensus
    public let range: DailyRange

    public init(
        date: Date,
        forecast: DailyForecast,
        confidence: ConfidenceLevel,
        modelAgreement: ModelConsensus,
        range: DailyRange
    ) {
        self.date = date
        self.forecast = forecast
        self.confidence = confidence
        self.modelAgreement = modelAgreement
        self.range = range
    }
}

/// Consensus hourly and daily forecasts
public struct ForecastConsensus: Codable, Sendable, Hashable {
    public let hourly: [AggregatedHourlyForecast]
    public let daily: [AggregatedDailyForecast]

    public init(hourly: [AggregatedHourlyForecast], daily: [AggregatedDailyForecast]) {
        self.hourly = hourly
        self.daily = daily
    }
}

/// Aggregated forecast from multiple weather models
public struct AggregatedForecast: Codable, Sendable, Hashable {
    public let coordinates: Coordinates
    public let generatedAt: Date
    public let validFrom: Date
    public let validTo: Date
    public let models: [ModelName]
    public let modelForecasts: [ModelForecast]
    public let consensus: ForecastConsensus
    public let modelWeights: [ModelWeight]
    public let overallConfidence: ConfidenceLevel

    public init(
        coordinates: Coordinates,
        generatedAt: Date,
        validFrom: Date,
        validTo: Date,
        models: [ModelName],
        modelForecasts: [ModelForecast],
        consensus: ForecastConsensus,
        modelWeights: [ModelWeight],
        overallConfidence: ConfidenceLevel
    ) {
        self.coordinates = coordinates
        self.generatedAt = generatedAt
        self.validFrom = validFrom
        self.validTo = validTo
        self.models = models
        self.modelForecasts = modelForecasts
        self.consensus = consensus
        self.modelWeights = modelWeights
        self.overallConfidence = overallConfidence
    }
}

// MARK: - Statistics Functions

/// Calculate arithmetic mean
public func mean(_ values: [Double]) -> Double {
    guard !values.isEmpty else { return 0 }
    return values.reduce(0, +) / Double(values.count)
}

/// Calculate median
public func median(_ values: [Double]) -> Double {
    guard !values.isEmpty else { return 0 }
    let sorted = values.sorted()
    let mid = sorted.count / 2
    if sorted.count % 2 == 0 {
        return (sorted[mid - 1] + sorted[mid]) / 2
    }
    return sorted[mid]
}

/// Calculate population standard deviation
public func stdDev(_ values: [Double]) -> Double {
    guard values.count > 1 else { return 0 }
    let avg = mean(values)
    let squaredDiffs = values.map { ($0 - avg) * ($0 - avg) }
    return sqrt(mean(squaredDiffs))
}

/// Calculate trimmed mean (removes extreme values)
/// - Parameters:
///   - values: Array of numbers
///   - trimFraction: Fraction to trim from each end (default 0.1)
public func trimmedMean(_ values: [Double], trimFraction: Double = 0.1) -> Double {
    guard !values.isEmpty else { return 0 }
    if values.count <= 2 { return mean(values) }
    if values.count == 3 {
        return values.sorted()[1]
    }

    let sorted = values.sorted()
    var trimCount = Int(Double(sorted.count) * trimFraction)
    if trimCount == 0 && sorted.count >= 4 {
        trimCount = 1
    }
    let maxTrim = (sorted.count - 2) / 2
    let actualTrim = Swift.min(trimCount, maxTrim)

    let trimmed = Array(sorted.dropFirst(actualTrim).dropLast(actualTrim))
    return mean(trimmed)
}

/// Calculate complete spread metrics
public func calculateSpread(_ values: [Double]) -> SpreadMetrics {
    guard !values.isEmpty else { return .empty }
    let sorted = values.sorted()
    let minVal = sorted.first!
    let maxVal = sorted.last!

    return SpreadMetrics(
        mean: mean(values),
        median: median(values),
        min: minVal,
        max: maxVal,
        stdDev: stdDev(values),
        range: maxVal - minVal
    )
}

/// Find outlier indices using z-score threshold
public func findOutlierIndices(_ values: [Double], threshold: Double = 2.0) -> [Int] {
    guard values.count > 2 else { return [] }
    let avg = mean(values)
    let sd = stdDev(values)
    guard sd > 0 else { return [] }

    var outliers: [Int] = []
    for i in 0 ..< values.count {
        let z = abs((values[i] - avg) / sd)
        if z > threshold {
            outliers.append(i)
        }
    }
    return outliers
}

/// Calculate ensemble probability (percentage meeting condition)
public func ensembleProbability(
    _ values: [Double],
    threshold: Double,
    comparison: ComparisonType = .greaterThan
) -> Double {
    guard !values.isEmpty else { return 0 }
    var count = 0
    for val in values {
        let matches: Bool
        switch comparison {
        case .greaterThan: matches = val > threshold
        case .greaterThanOrEqual: matches = val >= threshold
        case .lessThan: matches = val < threshold
        case .lessThanOrEqual: matches = val <= threshold
        }
        if matches { count += 1 }
    }
    return Double(count) / Double(values.count) * 100
}

public enum ComparisonType: Sendable {
    case greaterThan
    case greaterThanOrEqual
    case lessThan
    case lessThanOrEqual
}

// MARK: - Aggregate Service

/// Service for aggregating multiple model forecasts
public enum AggregateService {
    /// Z-score threshold for outlier detection
    private static let outlierZThreshold = 2.0

    /// Group hourly forecasts by timestamp
    private static func groupByTimestamp(
        _ forecasts: [ModelForecast]
    ) -> [String: [(model: ModelName, hourly: HourlyForecast)]] {
        var groups: [String: [(model: ModelName, hourly: HourlyForecast)]] = [:]
        for forecast in forecasts {
            for hourly in forecast.hourly {
                let key = ISO8601DateFormatter().string(from: hourly.timestamp)
                groups[key, default: []].append((model: forecast.model, hourly: hourly))
            }
        }
        return groups
    }

    /// Group daily forecasts by date
    private static func groupByDate(
        _ forecasts: [ModelForecast]
    ) -> [String: [(model: ModelName, daily: DailyForecast)]] {
        var groups: [String: [(model: ModelName, daily: DailyForecast)]] = [:]
        let formatter = ISO8601DateFormatter()
        for forecast in forecasts {
            for daily in forecast.daily {
                let fullKey = formatter.string(from: daily.date)
                let key = String(fullKey.prefix(10))
                groups[key, default: []].append((model: forecast.model, daily: daily))
            }
        }
        return groups
    }

    /// Calculate consensus and outliers for hourly forecasts
    private static func calculateHourlyConsensus(
        _ items: [(model: ModelName, hourly: HourlyForecast)]
    ) -> ModelConsensus {
        let tempValues = items.map { $0.hourly.metrics.temperature.rawValue }
        let precipValues = items.map { $0.hourly.metrics.precipitation.rawValue }
        let windValues = items.map { $0.hourly.metrics.windSpeed.rawValue }

        let temperatureStats = calculateMetricStatistics(tempValues)
        let precipitationStats = calculateMetricStatistics(precipValues)
        let windStats = calculateMetricStatistics(windValues)

        let tempOutliers = findOutlierIndices(tempValues, threshold: outlierZThreshold)
        let precipOutliers = findOutlierIndices(precipValues, threshold: outlierZThreshold)
        let windOutliers = findOutlierIndices(windValues, threshold: outlierZThreshold)

        var outlierModels = Set<ModelName>()
        for idx in tempOutliers + precipOutliers + windOutliers {
            if idx < items.count {
                outlierModels.insert(items[idx].model)
            }
        }

        let modelsInAgreement = items.filter { !outlierModels.contains($0.model) }.map(\.model)
        let agreementScore = items.isEmpty ? 0 : Double(modelsInAgreement.count) / Double(items.count)

        return ModelConsensus(
            agreementScore: agreementScore,
            modelsInAgreement: modelsInAgreement,
            outlierModels: Array(outlierModels),
            temperatureStats: temperatureStats,
            precipitationStats: precipitationStats,
            windStats: windStats
        )
    }

    private static func calculateMetricStatistics(_ values: [Double]) -> MetricStatistics {
        let spread = calculateSpread(values)
        return MetricStatistics(
            mean: spread.mean,
            median: spread.median,
            min: spread.min,
            max: spread.max,
            stdDev: spread.stdDev,
            range: spread.range
        )
    }

    /// Aggregate weather metrics from multiple models
    private static func aggregateHourlyMetrics(
        _ items: [(model: ModelName, hourly: HourlyForecast)]
    ) -> WeatherMetrics {
        let temps = items.map { $0.hourly.metrics.temperature.rawValue }
        let feelsLikes = items.map { $0.hourly.metrics.feelsLike.rawValue }
        let humidities = items.map { $0.hourly.metrics.humidity.rawValue }
        let pressures = items.map { $0.hourly.metrics.pressure.rawValue }
        let windSpeeds = items.map { $0.hourly.metrics.windSpeed.rawValue }
        let windDirs = items.map { $0.hourly.metrics.windDirection.rawValue }
        let windGusts = items.compactMap { $0.hourly.metrics.windGust?.rawValue }
        let precips = items.map { $0.hourly.metrics.precipitation.rawValue }
        let cloudCovers = items.map { $0.hourly.metrics.cloudCover.rawValue }
        let visibilities = items.map { $0.hourly.metrics.visibility.rawValue }
        let uvIndices = items.map { $0.hourly.metrics.uvIndex.rawValue }
        let weatherCodes = items.map { Double($0.hourly.metrics.weatherCode.rawValue) }

        return WeatherMetrics(
            temperature: Celsius(rawValue: trimmedMean(temps)),
            feelsLike: Celsius(rawValue: trimmedMean(feelsLikes)),
            humidity: Humidity.clamped(mean(humidities).rounded()),
            pressure: Pressure.clamped(mean(pressures)),
            windSpeed: MetersPerSecond.clamped(median(windSpeeds)),
            windDirection: WindDirection(rawValue: mean(windDirs).rounded()),
            windGust: windGusts.isEmpty ? nil : MetersPerSecond.clamped(median(windGusts)),
            precipitation: Millimeters.clamped(mean(precips)),
            precipitationProbability: ensembleProbability(precips, threshold: 0.1, comparison: .greaterThan) / 100,
            cloudCover: CloudCover.clamped(mean(cloudCovers).rounded()),
            visibility: Visibility.clamped(mean(visibilities)),
            uvIndex: UVIndex.clamped(median(uvIndices).rounded()),
            weatherCode: WeatherCode(rawValue: Int(median(weatherCodes).rounded())) ?? .clearSky
        )
    }

    /// Calculate daily consensus
    private static func calculateDailyConsensus(
        _ items: [(model: ModelName, daily: DailyForecast)]
    ) -> ModelConsensus {
        let tempMaxValues = items.map { $0.daily.temperature.max.rawValue }
        let precipValues = items.map { $0.daily.precipitation.total.rawValue }
        let windValues = items.map { $0.daily.wind.maxSpeed.rawValue }

        let temperatureStats = calculateMetricStatistics(tempMaxValues)
        let precipitationStats = calculateMetricStatistics(precipValues)
        let windStats = calculateMetricStatistics(windValues)

        let tempOutliers = findOutlierIndices(tempMaxValues, threshold: outlierZThreshold)
        let precipOutliers = findOutlierIndices(precipValues, threshold: outlierZThreshold)
        let windOutliers = findOutlierIndices(windValues, threshold: outlierZThreshold)

        var outlierModels = Set<ModelName>()
        for idx in tempOutliers + precipOutliers + windOutliers {
            if idx < items.count {
                outlierModels.insert(items[idx].model)
            }
        }

        let modelsInAgreement = items.filter { !outlierModels.contains($0.model) }.map(\.model)
        let agreementScore = items.isEmpty ? 0 : Double(modelsInAgreement.count) / Double(items.count)

        return ModelConsensus(
            agreementScore: agreementScore,
            modelsInAgreement: modelsInAgreement,
            outlierModels: Array(outlierModels),
            temperatureStats: temperatureStats,
            precipitationStats: precipitationStats,
            windStats: windStats
        )
    }

    /// Aggregate daily forecasts
    private static func aggregateDailyForecast(
        _ items: [(model: ModelName, daily: DailyForecast)]
    ) -> DailyForecast {
        guard let template = items.first?.daily else {
            fatalError("Cannot aggregate empty daily forecasts")
        }

        let tempMaxes = items.map { $0.daily.temperature.max.rawValue }
        let tempMins = items.map { $0.daily.temperature.min.rawValue }
        let humidityMaxes = items.map { $0.daily.humidityRange.max.rawValue }
        let humidityMins = items.map { $0.daily.humidityRange.min.rawValue }
        let pressureMaxes = items.map { $0.daily.pressureRange.max.rawValue }
        let pressureMins = items.map { $0.daily.pressureRange.min.rawValue }
        let precipTotals = items.map { $0.daily.precipitation.total.rawValue }
        let precipHours = items.map { Double($0.daily.precipitation.hours) }
        let windAvgSpeeds = items.map { $0.daily.wind.avgSpeed.rawValue }
        let windMaxSpeeds = items.map { $0.daily.wind.maxSpeed.rawValue }
        let windDirs = items.map { $0.daily.wind.dominantDirection.rawValue }
        let cloudAvgs = items.map { $0.daily.cloudCoverSummary.avg.rawValue }
        let cloudMaxes = items.map { $0.daily.cloudCoverSummary.max.rawValue }
        let uvMaxes = items.map { $0.daily.uvIndexMax.rawValue }
        let weatherCodes = items.map { Double($0.daily.weatherCode.rawValue) }

        return DailyForecast(
            date: template.date,
            temperature: TemperatureRange(
                min: Celsius(rawValue: trimmedMean(tempMins)),
                max: Celsius(rawValue: trimmedMean(tempMaxes))
            ),
            humidityRange: HumidityRange(
                min: Humidity.clamped(mean(humidityMins).rounded()),
                max: Humidity.clamped(mean(humidityMaxes).rounded())
            ),
            pressureRange: PressureRange(
                min: Pressure.clamped(mean(pressureMins)),
                max: Pressure.clamped(mean(pressureMaxes))
            ),
            precipitation: PrecipitationSummary(
                total: Millimeters.clamped(mean(precipTotals)),
                probability: ensembleProbability(precipTotals, threshold: 0.1, comparison: .greaterThan) / 100,
                hours: Int(mean(precipHours).rounded())
            ),
            wind: WindSummary(
                avgSpeed: MetersPerSecond.clamped(mean(windAvgSpeeds)),
                maxSpeed: MetersPerSecond.clamped(median(windMaxSpeeds)),
                dominantDirection: WindDirection(rawValue: mean(windDirs).rounded())
            ),
            cloudCoverSummary: CloudCoverSummary(
                avg: CloudCover.clamped(mean(cloudAvgs).rounded()),
                max: CloudCover.clamped(mean(cloudMaxes).rounded())
            ),
            uvIndexMax: UVIndex.clamped(median(uvMaxes).rounded()),
            sun: template.sun,
            weatherCode: WeatherCode(rawValue: Int(median(weatherCodes).rounded())) ?? .clearSky,
            hourly: []
        )
    }

    /// Calculate model weights (equal weighting)
    private static func calculateModelWeights(_ models: [ModelName]) -> [ModelWeight] {
        let weight = models.isEmpty ? 0 : 1.0 / Double(models.count)
        return models.map { ModelWeight(model: $0, weight: weight, reason: "Equal weighting") }
    }

    /// Aggregate multiple model forecasts into a unified forecast
    /// - Parameter forecasts: Array of forecasts from different models
    /// - Returns: Aggregated forecast with consensus metrics
    public static func aggregate(_ forecasts: [ModelForecast]) async throws -> AggregatedForecast {
        guard let reference = forecasts.first else {
            throw AggregationError.emptyForecasts
        }

        let models = forecasts.map(\.model)
        let hourlyGroups = groupByTimestamp(forecasts)
        let dailyGroups = groupByDate(forecasts)

        var aggregatedHourly: [AggregatedHourlyForecast] = []
        for (_, items) in hourlyGroups {
            guard !items.isEmpty else { continue }

            let consensus = calculateHourlyConsensus(items)
            let metrics = aggregateHourlyMetrics(items)
            let precipValues = items.map { $0.hourly.metrics.precipitation.rawValue }
            let confidence = ConfidenceService.calculateHourlyConfidence(
                consensus: consensus,
                precipValues: precipValues
            )

            let tempValues = items.map { $0.hourly.metrics.temperature.rawValue }
            let windValues = items.map { $0.hourly.metrics.windSpeed.rawValue }

            aggregatedHourly.append(AggregatedHourlyForecast(
                timestamp: items[0].hourly.timestamp,
                metrics: metrics,
                confidence: confidence,
                modelAgreement: consensus,
                range: HourlyRange(
                    temperature: MetricRange(
                        min: tempValues.min() ?? 0,
                        max: tempValues.max() ?? 0
                    ),
                    precipitation: MetricRange(
                        min: precipValues.min() ?? 0,
                        max: precipValues.max() ?? 0
                    ),
                    windSpeed: MetricRange(
                        min: windValues.min() ?? 0,
                        max: windValues.max() ?? 0
                    )
                )
            ))
        }

        aggregatedHourly.sort { $0.timestamp < $1.timestamp }

        var aggregatedDaily: [AggregatedDailyForecast] = []
        for (_, items) in dailyGroups {
            guard !items.isEmpty else { continue }

            let consensus = calculateDailyConsensus(items)
            let forecast = aggregateDailyForecast(items)
            let precipValues = items.map { $0.daily.precipitation.total.rawValue }
            let confidence = ConfidenceService.calculateDailyConfidence(
                consensus: consensus,
                precipValues: precipValues
            )

            let tempMaxValues = items.map { $0.daily.temperature.max.rawValue }
            let tempMinValues = items.map { $0.daily.temperature.min.rawValue }

            aggregatedDaily.append(AggregatedDailyForecast(
                date: items[0].daily.date,
                forecast: forecast,
                confidence: confidence,
                modelAgreement: consensus,
                range: DailyRange(
                    temperatureMax: MetricRange(
                        min: tempMaxValues.min() ?? 0,
                        max: tempMaxValues.max() ?? 0
                    ),
                    temperatureMin: MetricRange(
                        min: tempMinValues.min() ?? 0,
                        max: tempMinValues.max() ?? 0
                    ),
                    precipitation: MetricRange(
                        min: precipValues.min() ?? 0,
                        max: precipValues.max() ?? 0
                    )
                )
            ))
        }

        aggregatedDaily.sort { $0.date < $1.date }

        let modelWeights = calculateModelWeights(models)
        let overallConfidence = ConfidenceService.calculateOverallConfidence(
            hourlyForecasts: aggregatedHourly,
            dailyForecasts: aggregatedDaily
        )

        let validFrom = aggregatedHourly.first?.timestamp ?? aggregatedDaily.first?.date ?? reference.validFrom
        let validTo = aggregatedHourly.last?.timestamp ?? aggregatedDaily.last?.date ?? reference.validTo

        return AggregatedForecast(
            coordinates: reference.coordinates,
            generatedAt: Date(),
            validFrom: validFrom,
            validTo: validTo,
            models: models,
            modelForecasts: forecasts,
            consensus: ForecastConsensus(hourly: aggregatedHourly, daily: aggregatedDaily),
            modelWeights: modelWeights,
            overallConfidence: overallConfidence
        )
    }
}

// MARK: - Errors

public enum AggregationError: Error, LocalizedError {
    case emptyForecasts

    public var errorDescription: String? {
        switch self {
        case .emptyForecasts:
            return "Cannot aggregate empty forecast array"
        }
    }
}
