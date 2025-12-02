import Foundation

// Note: WeatherCondition is defined in SharedKit.swift

// MARK: - Narrative Summary

/// Narrative summary for a forecast
public struct NarrativeSummary: Codable, Sendable, Hashable {
    public let headline: String
    public let body: String
    public let alerts: [String]
    public let modelNotes: [String]

    public init(headline: String, body: String, alerts: [String], modelNotes: [String]) {
        self.headline = headline
        self.body = body
        self.alerts = alerts
        self.modelNotes = modelNotes
    }
}

/// Narrative type classification
public enum NarrativeType: String, Sendable {
    case agreement
    case disagreement
    case transition
}

// MARK: - Seeded Random

/// Deterministic seeded random number generator
public struct SeededRandom {
    private var seed: UInt64

    public init(seed: UInt64) {
        self.seed = seed
    }

    /// Generate next random value between 0 and 1
    public mutating func next() -> Double {
        seed = seed &* 6364136223846793005 &+ 1442695040888963407
        return Double((seed >> 33) ^ seed) / Double(UInt64.max)
    }

    /// Select random index from array
    public mutating func selectIndex(from count: Int) -> Int {
        guard count > 0 else { return 0 }
        return Int(next() * Double(count)) % count
    }
}

// MARK: - Template Constants

private enum Templates {
    static let agreementStrong = [
        "Models agree on {condition} conditions through {endDay}.",
        "All models are in agreement: {condition} through {endDay}.",
        "Strong model consensus shows {condition} conditions through {endDay}.",
    ]

    static let agreementModerate = [
        "Most models agree on {condition} conditions through {endDay}.",
        "Models generally show {condition} through {endDay}.",
        "There's good agreement on {condition} conditions through {endDay}.",
    ]

    static let dryToWet = [
        "{condition} arriving {day} {period}.",
        "Expect {condition} to move in {day} {period}.",
        "{condition} expected {day} {period}.",
    ]

    static let wetToDry = [
        "{condition} clearing by {day}.",
        "Drier conditions returning {day}.",
        "Expect clearing skies by {day}.",
    ]

    static let uncertainty = [
        "This uncertainty is common at {days}+ days out. Check back {checkDay} for a clearer picture.",
        "Extended range forecasts beyond {days} days carry increased uncertainty.",
        "Consider this a general trend - details may change as we get closer.",
    ]

    static let confidenceHigh = "Confidence is HIGH for {period}."
    static let confidenceMedium = "Confidence is MEDIUM for {period}."
    static let confidenceLow = "Confidence is LOW for {period} - significant model disagreement."
}

// MARK: - NarrativeBuilder

/// Builder for generating weather narratives
public enum NarrativeBuilder {
    /// Z-score threshold for outlier callout
    private static let outlierCalloutThreshold = 2.0

    /// Days ahead threshold for uncertainty warning
    private static let uncertaintyDaysThreshold = 5

    /// Map WMO weather code to condition
    public static func weatherCodeToCondition(_ code: WeatherCode) -> WeatherCondition {
        switch code.rawValue {
        case 0: return .sunny
        case 1 ... 2: return .partlyCloudy
        case 3: return .cloudy
        case 45 ... 48: return .fog
        case 51 ... 57: return .drizzle
        case 61 ... 65: return .rain
        case 66 ... 67: return .sleet
        case 71 ... 77, 85 ... 86: return .snow
        case 80 ... 82: return code.rawValue == 82 ? .heavyRain : .rain
        case 95 ... 99: return .thunderstorm
        default: return .unknown
        }
    }

    /// Get human-readable description for condition
    public static func conditionToDescription(_ condition: WeatherCondition) -> String {
        switch condition {
        case .sunny: return "sunny"
        case .partlyCloudy: return "partly cloudy"
        case .cloudy: return "cloudy"
        case .overcast: return "overcast"
        case .fog: return "foggy"
        case .drizzle: return "light rain"
        case .rain: return "rain"
        case .heavyRain: return "heavy rain"
        case .thunderstorm: return "thunderstorms"
        case .snow: return "snow"
        case .sleet: return "sleet"
        case .unknown: return "mixed conditions"
        }
    }

    /// Check if condition involves precipitation
    public static func isPrecipitation(_ condition: WeatherCondition) -> Bool {
        condition.isPrecipitation
    }

    /// Check if condition is dry
    public static func isDryCondition(_ condition: WeatherCondition) -> Bool {
        condition.isDry
    }

    /// Format model name for display
    public static func formatModelName(_ model: ModelName) -> String {
        switch model {
        case .ecmwf: return "ECMWF"
        case .gfs: return "GFS"
        case .icon: return "ICON"
        case .meteofrance: return "ARPEGE"
        case .ukmo: return "UK Met Office"
        case .jma: return "JMA"
        case .gem: return "GEM"
        }
    }

    /// Format list of model names with proper grammar
    public static func formatModelList(_ models: [ModelName]) -> String {
        guard !models.isEmpty else { return "" }
        if models.count == 1 { return formatModelName(models[0]) }
        if models.count == 2 {
            return "\(formatModelName(models[0])) and \(formatModelName(models[1]))"
        }
        let formatted = models.map { formatModelName($0) }
        let last = formatted.last!
        return formatted.dropLast().joined(separator: ", ") + ", and \(last)"
    }

    /// Format temperature for display
    public static func formatTemperature(_ temp: Double) -> String {
        "\(Int(temp.rounded()))\u{00B0}C"
    }

    /// Format precipitation for display
    public static func formatPrecipitation(_ mm: Double) -> String {
        if mm < 1 { return "trace amounts" }
        return "\(Int(mm.rounded()))mm"
    }

    /// Format day name
    public static func formatDayName(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    /// Format relative day (today, tomorrow, day name)
    public static func formatRelativeDay(_ date: Date, referenceDate: Date = Date()) -> String {
        let calendar = Calendar.current
        let dateOnly = calendar.startOfDay(for: date)
        let refOnly = calendar.startOfDay(for: referenceDate)

        let diffDays = calendar.dateComponents([.day], from: refOnly, to: dateOnly).day ?? 0

        if diffDays == 0 { return "today" }
        if diffDays == 1 { return "tomorrow" }
        if diffDays >= 2 && diffDays <= 6 { return formatDayName(date) }

        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }

    /// Format time period
    public static func formatTimePeriod(_ hour: Int) -> String {
        if hour >= 5 && hour < 12 { return "morning" }
        if hour >= 12 && hour < 17 { return "afternoon" }
        if hour >= 17 && hour < 21 { return "evening" }
        return "overnight"
    }

    /// Select template using seeded random (deterministic)
    public static func selectTemplate(_ templates: [String], seed: UInt64 = 0) -> String {
        // For deterministic output, always use first template
        templates.first ?? ""
    }

    /// Fill template placeholders
    public static func fillTemplate(_ template: String, values: [String: String]) -> String {
        var result = template
        for (key, value) in values {
            result = result.replacingOccurrences(of: "{\(key)}", with: value)
        }
        return result
    }

    /// Classify narrative type based on aggregated data
    private static func classifyNarrativeType(
        _ aggregated: AggregatedForecast,
        confidence: [ConfidenceResult]
    ) -> NarrativeType {
        let avgConfidence = confidence.isEmpty
            ? 0.5
            : confidence.reduce(0) { $0 + $1.score } / Double(confidence.count)

        if avgConfidence < 0.5 {
            return .disagreement
        }

        if aggregated.consensus.daily.count >= 2 {
            let firstCondition = weatherCodeToCondition(aggregated.consensus.daily[0].forecast.weatherCode)
            let lastCondition = weatherCodeToCondition(aggregated.consensus.daily.last!.forecast.weatherCode)

            let firstIsDry = isDryCondition(firstCondition)
            let lastIsDry = isDryCondition(lastCondition)

            if firstIsDry != lastIsDry {
                return .transition
            }
        }

        return .agreement
    }

    /// Get dominant weather condition
    private static func getDominantCondition(_ aggregated: AggregatedForecast) -> WeatherCondition {
        guard !aggregated.consensus.daily.isEmpty else { return .unknown }

        var conditionCounts: [WeatherCondition: Int] = [:]
        for daily in aggregated.consensus.daily {
            let condition = weatherCodeToCondition(daily.forecast.weatherCode)
            conditionCounts[condition, default: 0] += 1
        }

        return conditionCounts.max(by: { $0.value < $1.value })?.key ?? .unknown
    }

    /// Find transition day
    private static func findTransitionDay(
        _ aggregated: AggregatedForecast
    ) -> (day: AggregatedDailyForecast, condition: WeatherCondition, period: String)? {
        guard aggregated.consensus.daily.count >= 2 else { return nil }

        let firstCondition = weatherCodeToCondition(aggregated.consensus.daily[0].forecast.weatherCode)
        let firstIsDry = isDryCondition(firstCondition)

        for i in 1 ..< aggregated.consensus.daily.count {
            let dayCondition = weatherCodeToCondition(aggregated.consensus.daily[i].forecast.weatherCode)
            let dayIsDry = isDryCondition(dayCondition)

            if firstIsDry != dayIsDry {
                return (day: aggregated.consensus.daily[i], condition: dayCondition, period: "afternoon")
            }
        }

        return nil
    }

    /// Generate agreement headline
    private static func generateAgreementHeadline(
        _ aggregated: AggregatedForecast,
        dominantCondition: WeatherCondition
    ) -> String {
        let description = conditionToDescription(dominantCondition)
        let endDay = aggregated.consensus.daily.isEmpty
            ? "the forecast period"
            : formatRelativeDay(aggregated.consensus.daily.last!.date)

        return fillTemplate(selectTemplate(Templates.agreementStrong), values: [
            "condition": description,
            "endDay": endDay,
        ])
    }

    /// Generate disagreement headline
    private static func generateDisagreementHeadline(
        _ aggregated: AggregatedForecast
    ) -> String {
        guard let firstDaily = aggregated.consensus.daily.first else {
            return "Models show significant uncertainty in the forecast."
        }

        let tempRange = firstDaily.range.temperatureMax.max - firstDaily.range.temperatureMax.min
        if tempRange > 5 {
            return "Models disagree significantly on temperatures this period."
        }

        let precipRange = firstDaily.range.precipitation.max - firstDaily.range.precipitation.min
        if precipRange > 10 {
            return "Precipitation amounts uncertain - models show different scenarios."
        }

        return "Model disagreement creates forecast uncertainty."
    }

    /// Generate transition headline
    private static func generateTransitionHeadline(
        _ aggregated: AggregatedForecast,
        transition: (day: AggregatedDailyForecast, condition: WeatherCondition, period: String)
    ) -> String {
        let firstCondition = weatherCodeToCondition(aggregated.consensus.daily[0].forecast.weatherCode)
        let firstIsDry = isDryCondition(firstCondition)

        let description = conditionToDescription(transition.condition)
        let dayName = formatRelativeDay(transition.day.date)

        if firstIsDry && isPrecipitation(transition.condition) {
            let capitalizedDesc = description.prefix(1).uppercased() + description.dropFirst()
            return fillTemplate(selectTemplate(Templates.dryToWet), values: [
                "condition": capitalizedDesc,
                "day": dayName,
                "period": transition.period,
            ])
        }

        return fillTemplate(selectTemplate(Templates.wetToDry), values: [
            "condition": description,
            "day": dayName,
        ])
    }

    /// Get average confidence level
    private static func getAverageConfidenceLevel(_ confidence: [ConfidenceResult]) -> ConfidenceLevelName {
        guard !confidence.isEmpty else { return .medium }
        let avgScore = confidence.reduce(0) { $0 + $1.score } / Double(confidence.count)
        if avgScore >= 0.8 { return .high }
        if avgScore >= 0.5 { return .medium }
        return .low
    }

    /// Generate body text
    private static func generateBody(
        _ aggregated: AggregatedForecast,
        confidence: [ConfidenceResult],
        narrativeType: NarrativeType
    ) -> String {
        var sentences: [String] = []

        if narrativeType == .disagreement {
            if let firstDaily = aggregated.consensus.daily.first {
                let tempStats = firstDaily.modelAgreement.temperatureStats
                if tempStats.range > 5 {
                    let highModels = firstDaily.modelAgreement.outlierModels.filter { model in
                        aggregated.modelForecasts.first { $0.model == model }?.daily.first {
                            Calendar.current.isDate($0.date, inSameDayAs: firstDaily.date)
                        }?.temperature.max.rawValue ?? 0 > tempStats.mean
                    }
                    let lowModels = firstDaily.modelAgreement.outlierModels.filter { !highModels.contains($0) }

                    if !highModels.isEmpty && !lowModels.isEmpty {
                        let highTemp = formatTemperature(firstDaily.range.temperatureMax.max)
                        let lowTemp = formatTemperature(firstDaily.range.temperatureMax.min)
                        let highVerb = highModels.count == 1 ? "predicts" : "predict"
                        let lowVerb = lowModels.count == 1 ? "shows" : "show"
                        sentences.append(
                            "\(formatModelList(highModels)) \(highVerb) \(highTemp) while \(formatModelList(lowModels)) \(lowVerb) only \(lowTemp)."
                        )
                    }
                }
            }
        } else if narrativeType == .transition {
            if let transition = findTransitionDay(aggregated), isPrecipitation(transition.condition) {
                let precipAmounts: [(model: ModelName, amount: Double)] = aggregated.modelForecasts.compactMap { forecast in
                    guard let daily = forecast.daily.first(where: {
                        Calendar.current.isDate($0.date, inSameDayAs: transition.day.date)
                    }) else { return nil }
                    return (model: forecast.model, amount: daily.precipitation.total.rawValue)
                }

                if precipAmounts.count >= 2 {
                    let sorted = precipAmounts.sorted { $0.amount > $1.amount }
                    let high = sorted[0]
                    let low = sorted.last!

                    if high.amount - low.amount > 5 {
                        let secondModel = sorted.count > 1 ? sorted[1].model : low.model
                        sentences.append(
                            "\(formatModelName(high.model)) and \(formatModelName(secondModel)) show heavier rain (\(formatPrecipitation(high.amount))) while \(formatModelName(low.model)) predicts a lighter system (\(formatPrecipitation(low.amount)))."
                        )
                    }
                }
            }
        }

        if !confidence.isEmpty {
            let avgLevel = getAverageConfidenceLevel(confidence)
            let periodDesc = narrativeType == .transition ? "the dry period" : "this forecast period"

            let template: String
            switch avgLevel {
            case .high: template = Templates.confidenceHigh
            case .medium: template = Templates.confidenceMedium
            case .low: template = Templates.confidenceLow
            }

            sentences.append(fillTemplate(template, values: ["period": periodDesc]))
        }

        return sentences.joined(separator: " ")
    }

    /// Generate alerts
    private static func generateAlerts(
        _ aggregated: AggregatedForecast,
        confidence: [ConfidenceResult]
    ) -> [String] {
        var alerts: [String] = []

        if let lastDay = aggregated.consensus.daily.last {
            let calendar = Calendar.current
            let daysAhead = calendar.dateComponents([.day], from: Date(), to: lastDay.date).day ?? 0

            if daysAhead >= uncertaintyDaysThreshold {
                let checkDay = formatRelativeDay(
                    calendar.date(byAdding: .day, value: 2, to: Date()) ?? Date()
                )
                alerts.append(fillTemplate(selectTemplate(Templates.uncertainty), values: [
                    "days": String(uncertaintyDaysThreshold),
                    "checkDay": checkDay,
                ]))
            }
        }

        let avgConfidence = confidence.isEmpty
            ? 0.5
            : confidence.reduce(0) { $0 + $1.score } / Double(confidence.count)

        if avgConfidence < 0.5 {
            alerts.append("Significant model disagreement - consider multiple scenarios.")
        }

        return alerts
    }

    /// Generate model notes
    private static func generateModelNotes(_ aggregated: AggregatedForecast) -> [String] {
        var notes: [String] = []

        for daily in aggregated.consensus.daily {
            let consensus = daily.modelAgreement

            for outlierModel in consensus.outlierModels {
                guard let modelForecast = aggregated.modelForecasts.first(where: { $0.model == outlierModel }),
                      let modelDaily = modelForecast.daily.first(where: {
                          Calendar.current.isDate($0.date, inSameDayAs: daily.date)
                      })
                else { continue }

                let tempDiff = abs(modelDaily.temperature.max.rawValue - consensus.temperatureStats.mean)
                let tempZScore = consensus.temperatureStats.stdDev > 0
                    ? tempDiff / consensus.temperatureStats.stdDev
                    : 0

                if tempZScore > outlierCalloutThreshold {
                    let direction = modelDaily.temperature.max.rawValue > consensus.temperatureStats.mean ? "warmer" : "cooler"
                    notes.append(
                        "\(formatModelName(outlierModel)) is notably \(direction) at \(formatTemperature(modelDaily.temperature.max.rawValue))."
                    )
                }

                let precipDiff = abs(modelDaily.precipitation.total.rawValue - consensus.precipitationStats.mean)
                let precipZScore = consensus.precipitationStats.stdDev > 0
                    ? precipDiff / consensus.precipitationStats.stdDev
                    : 0

                if precipZScore > outlierCalloutThreshold {
                    let direction = modelDaily.precipitation.total.rawValue > consensus.precipitationStats.mean ? "wetter" : "drier"
                    notes.append(
                        "\(formatModelName(outlierModel)) shows a \(direction) scenario (\(formatPrecipitation(modelDaily.precipitation.total.rawValue)))."
                    )
                }
            }
        }

        return notes
    }

    /// Generate narrative summary from aggregated forecast
    /// - Parameters:
    ///   - aggregated: The aggregated forecast from multiple models
    ///   - confidence: Array of confidence results for forecast periods
    ///   - seed: Optional seed for deterministic template selection
    /// - Returns: Narrative summary with headline, body, alerts and notes
    public static func generateNarrative(
        _ aggregated: AggregatedForecast,
        confidence: [ConfidenceResult] = [],
        seed: UInt64 = 0
    ) -> NarrativeSummary {
        guard !aggregated.consensus.daily.isEmpty else {
            return NarrativeSummary(
                headline: "No forecast data available.",
                body: "",
                alerts: [],
                modelNotes: []
            )
        }

        let narrativeType = classifyNarrativeType(aggregated, confidence: confidence)
        let dominantCondition = getDominantCondition(aggregated)
        let transition = findTransitionDay(aggregated)

        let headline: String
        switch narrativeType {
        case .agreement:
            headline = generateAgreementHeadline(aggregated, dominantCondition: dominantCondition)
        case .disagreement:
            headline = generateDisagreementHeadline(aggregated)
        case .transition:
            if let transition = transition {
                headline = generateTransitionHeadline(aggregated, transition: transition)
            } else {
                headline = generateAgreementHeadline(aggregated, dominantCondition: dominantCondition)
            }
        }

        let body = generateBody(aggregated, confidence: confidence, narrativeType: narrativeType)
        let alerts = generateAlerts(aggregated, confidence: confidence)
        let modelNotes = generateModelNotes(aggregated)

        return NarrativeSummary(
            headline: headline,
            body: body,
            alerts: alerts,
            modelNotes: modelNotes
        )
    }
}
