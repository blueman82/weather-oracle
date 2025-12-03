import Foundation

// MARK: - Confidence Thresholds

/// Thresholds for confidence determination per metric type
private enum ConfidenceThresholds {
    static let temperature = (highStdDev: 1.5, lowStdDev: 4.0) // Celsius
    static let precipitation = (highAgreement: 80.0, lowAgreement: 50.0) // Percentage
    static let windSpeed = (highRange: 10.0, lowRange: 25.0) // km/h
    static let humidity = (highRange: 10.0, lowRange: 30.0) // Percentage
}

/// Factor weights for confidence calculation
private enum FactorWeights {
    static let spread: Double = 0.5
    static let agreement: Double = 0.3
    static let timeHorizon: Double = 0.2
}

/// Time decay constants
private enum TimeDecay {
    static let perDay: Double = 0.05
    static let maxDays: Int = 10
}

// MARK: - Confidence Factor

/// Individual factor contributing to confidence score
public struct ConfidenceFactor: Codable, Sendable, Hashable {
    public let name: String
    public let weight: Double
    public let score: Double
    public let contribution: Double
    public let detail: String

    public init(name: String, weight: Double, score: Double, contribution: Double, detail: String) {
        self.name = name
        self.weight = weight
        self.score = score
        self.contribution = contribution
        self.detail = detail
    }
}

/// Metric types for confidence calculation
public enum MetricType: String, Sendable, CaseIterable {
    case temperature
    case precipitation
    case wind
    case humidity
    case overall
}

/// Detailed confidence result
public struct ConfidenceResult: Codable, Sendable, Hashable {
    public let level: ConfidenceLevelName
    public let score: Double
    public let factors: [ConfidenceFactor]
    public let explanation: String

    public init(level: ConfidenceLevelName, score: Double, factors: [ConfidenceFactor], explanation: String) {
        self.level = level
        self.score = score
        self.factors = factors
        self.explanation = explanation
    }
}

// MARK: - Confidence Service

/// Service for calculating forecast confidence scores
public enum ConfidenceService {
    /// Calculate confidence score from standard deviation
    public static func confidenceFromStdDev(
        _ stdDev: Double,
        highThreshold: Double,
        lowThreshold: Double
    ) -> Double {
        if stdDev <= highThreshold {
            return 1.0
        }
        if stdDev >= lowThreshold {
            return 0.3
        }
        let ratio = (stdDev - highThreshold) / (lowThreshold - highThreshold)
        return 1.0 - ratio * 0.7
    }

    /// Calculate confidence score from range
    public static func confidenceFromRange(
        _ range: Double,
        highThreshold: Double,
        lowThreshold: Double
    ) -> Double {
        if range <= highThreshold {
            return 1.0
        }
        if range >= lowThreshold {
            return 0.3
        }
        let ratio = (range - highThreshold) / (lowThreshold - highThreshold)
        return 1.0 - ratio * 0.7
    }

    /// Calculate confidence score from model agreement
    public static func confidenceFromAgreement(
        modelsInAgreement: Int,
        totalModels: Int
    ) -> Double {
        guard totalModels > 0 else { return 0.5 }
        let ratio = Double(modelsInAgreement) / Double(totalModels)
        return 0.3 + ratio * 0.7
    }

    /// Calculate confidence score from time horizon
    public static func confidenceFromTimeHorizon(daysAhead: Int) -> Double {
        let effectiveDays = Swift.min(daysAhead, TimeDecay.maxDays)
        let score = 1.0 - Double(effectiveDays) * TimeDecay.perDay
        return Swift.max(0.5, score)
    }

    /// Convert score to confidence level
    public static func scoreToLevel(_ score: Double) -> ConfidenceLevelName {
        if score >= 0.8 { return .high }
        if score >= 0.5 { return .medium }
        return .low
    }

    /// Calculate confidence for hourly forecast consensus
    public static func calculateHourlyConfidence(
        consensus: ModelConsensus,
        precipValues: [Double]
    ) -> ConfidenceLevel {
        let tempConfidence = confidenceFromStdDev(
            consensus.temperatureStats.stdDev,
            highThreshold: ConfidenceThresholds.temperature.highStdDev,
            lowThreshold: ConfidenceThresholds.temperature.lowStdDev
        )

        let precipProbability = ensembleProbability(precipValues, threshold: 0.1, comparison: .greaterThan)
        let precipConfidence = (precipProbability >= 80 || precipProbability <= 20) ? 1.0 : 0.5

        let windRangeKmh = consensus.windStats.range * 3.6
        let windConfidence = confidenceFromRange(
            windRangeKmh,
            highThreshold: ConfidenceThresholds.windSpeed.highRange,
            lowThreshold: ConfidenceThresholds.windSpeed.lowRange
        )

        let overallScore = tempConfidence * 0.4 + precipConfidence * 0.3 + windConfidence * 0.3
        return ConfidenceLevel.from(score: overallScore) ?? ConfidenceLevel.from(score: 0.5)!
    }

    /// Calculate confidence for daily forecast consensus
    public static func calculateDailyConfidence(
        consensus: ModelConsensus,
        precipValues: [Double]
    ) -> ConfidenceLevel {
        let tempConfidence = confidenceFromStdDev(
            consensus.temperatureStats.stdDev,
            highThreshold: ConfidenceThresholds.temperature.highStdDev,
            lowThreshold: ConfidenceThresholds.temperature.lowStdDev
        )

        let precipProbability = ensembleProbability(precipValues, threshold: 0.1, comparison: .greaterThan)
        let precipConfidence = (precipProbability >= 80 || precipProbability <= 20) ? 1.0 : 0.5

        let windRangeKmh = consensus.windStats.range * 3.6
        let windConfidence = confidenceFromRange(
            windRangeKmh,
            highThreshold: ConfidenceThresholds.windSpeed.highRange,
            lowThreshold: ConfidenceThresholds.windSpeed.lowRange
        )

        let overallScore = tempConfidence * 0.4 + precipConfidence * 0.3 + windConfidence * 0.3
        return ConfidenceLevel.from(score: overallScore) ?? ConfidenceLevel.from(score: 0.5)!
    }

    /// Calculate overall confidence from aggregated forecasts
    public static func calculateOverallConfidence(
        hourlyForecasts: [AggregatedHourlyForecast],
        dailyForecasts: [AggregatedDailyForecast]
    ) -> ConfidenceLevel {
        let hourlyScores = hourlyForecasts.map(\.confidence.score)
        let dailyScores = dailyForecasts.map(\.confidence.score)
        let allScores = hourlyScores + dailyScores

        let avgScore = allScores.isEmpty ? 0.5 : mean(allScores)
        return ConfidenceLevel.from(score: avgScore) ?? ConfidenceLevel.from(score: 0.5)!
    }

    /// Calculate detailed confidence result for a metric
    public static func calculateConfidence(
        aggregated: AggregatedForecast,
        metric: MetricType,
        daysAhead: Int = 0
    ) -> ConfidenceResult {
        let totalModels = aggregated.models.count
        var factors: [ConfidenceFactor] = []
        var spreadScore = 1.0
        var modelsInAgreement = totalModels
        var spreadValue = 0.0
        var unit = ""

        switch metric {
        case .overall:
            if !aggregated.consensus.hourly.isEmpty {
                let scores = aggregated.consensus.hourly.map(\.confidence.score)
                let avgScore = mean(scores)
                spreadScore = avgScore
                spreadValue = 1 - avgScore

                let agreements = aggregated.consensus.hourly.map { $0.modelAgreement.modelsInAgreement.count }
                modelsInAgreement = Int(mean(agreements.map { Double($0) }).rounded())
            }

        case .temperature:
            if let first = aggregated.consensus.hourly.first {
                spreadValue = first.modelAgreement.temperatureStats.stdDev
                spreadScore = confidenceFromStdDev(
                    spreadValue,
                    highThreshold: ConfidenceThresholds.temperature.highStdDev,
                    lowThreshold: ConfidenceThresholds.temperature.lowStdDev
                )
                modelsInAgreement = first.modelAgreement.modelsInAgreement.count
                unit = "C"
            }

        case .precipitation:
            if let first = aggregated.consensus.hourly.first {
                spreadValue = first.modelAgreement.precipitationStats.stdDev
                spreadScore = confidenceFromStdDev(
                    spreadValue,
                    highThreshold: 2.0,
                    lowThreshold: 10.0
                )
                modelsInAgreement = first.modelAgreement.modelsInAgreement.count
                unit = "mm"
            }

        case .wind:
            if let first = aggregated.consensus.hourly.first {
                spreadValue = first.modelAgreement.windStats.stdDev
                spreadScore = confidenceFromStdDev(
                    spreadValue,
                    highThreshold: 2.78,
                    lowThreshold: 6.94
                )
                modelsInAgreement = first.modelAgreement.modelsInAgreement.count
                unit = "m/s"
            }

        case .humidity:
            spreadValue = 5.0
            spreadScore = confidenceFromStdDev(
                spreadValue,
                highThreshold: ConfidenceThresholds.humidity.highRange,
                lowThreshold: ConfidenceThresholds.humidity.lowRange
            )
            unit = "%"
        }

        let spreadContribution = spreadScore * FactorWeights.spread
        factors.append(ConfidenceFactor(
            name: "spread",
            weight: FactorWeights.spread,
            score: spreadScore,
            contribution: spreadContribution,
            detail: "Spread: \(String(format: "%.1f", spreadValue))\(unit)"
        ))

        let agreementScore = confidenceFromAgreement(
            modelsInAgreement: modelsInAgreement,
            totalModels: totalModels
        )
        let agreementContribution = agreementScore * FactorWeights.agreement
        factors.append(ConfidenceFactor(
            name: "agreement",
            weight: FactorWeights.agreement,
            score: agreementScore,
            contribution: agreementContribution,
            detail: "\(modelsInAgreement)/\(totalModels) models agree"
        ))

        let timeScore = confidenceFromTimeHorizon(daysAhead: daysAhead)
        let timeContribution = timeScore * FactorWeights.timeHorizon
        factors.append(ConfidenceFactor(
            name: "timeHorizon",
            weight: FactorWeights.timeHorizon,
            score: timeScore,
            contribution: timeContribution,
            detail: "\(daysAhead) day\(daysAhead == 1 ? "" : "s") ahead"
        ))

        let totalScore = factors.reduce(0) { $0 + $1.contribution }
        let level = scoreToLevel(totalScore)
        let explanation = generateExplanation(
            modelsInAgreement: modelsInAgreement,
            totalModels: totalModels,
            level: level,
            metric: metric
        )

        return ConfidenceResult(
            level: level,
            score: totalScore,
            factors: factors,
            explanation: explanation
        )
    }

    /// Generate human-readable explanation
    private static func generateExplanation(
        modelsInAgreement: Int,
        totalModels: Int,
        level: ConfidenceLevelName,
        metric: MetricType
    ) -> String {
        let agreementPhrase = modelsInAgreement == totalModels
            ? "All \(totalModels) models agree"
            : "\(modelsInAgreement) of \(totalModels) models agree"

        let metricPhrase = metric == .overall
            ? "on the forecast"
            : "on \(metric.rawValue) predictions"

        let confidencePhrase: String
        switch level {
        case .high: confidencePhrase = "High confidence"
        case .medium: confidencePhrase = "Moderate confidence"
        case .low: confidencePhrase = "Low confidence"
        }

        return "\(confidencePhrase): \(agreementPhrase) \(metricPhrase)"
    }

    /// Format confidence summary for display
    public static func formatConfidenceSummary(_ result: ConfidenceResult) -> String {
        let percentage = Int((result.score * 100).rounded())
        let levelCapitalized = result.level.rawValue.capitalized
        return "\(levelCapitalized) (\(percentage)%)"
    }

    /// Get emoji for confidence level
    public static func getConfidenceEmoji(_ level: ConfidenceLevelName) -> String {
        switch level {
        case .high: return "\u{2705}"
        case .medium: return "\u{26A0}\u{FE0F}"
        case .low: return "\u{2753}"
        }
    }
}
