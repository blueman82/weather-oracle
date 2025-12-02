import Foundation
import SharedKit
import SwiftUI
import Combine

// MARK: - Forecast Detail View Model

/// View model for forecast detail screen with aggregation and narrative generation
@MainActor
@Observable
public final class ForecastDetailViewModel {
    // MARK: - Properties

    private let client: OpenMeteoClient
    private let models: [ModelName]

    public let location: LocationEntity
    public private(set) var forecast: AggregatedForecast?
    public private(set) var narrative: NarrativeSummary?
    public private(set) var chartSeries: ChartSeries?
    public private(set) var isLoading: Bool = false
    public private(set) var error: Error?
    public private(set) var lastUpdated: Date?

    // MARK: - Initialization

    public init(
        location: LocationEntity,
        client: OpenMeteoClient = OpenMeteoClient(),
        models: [ModelName] = [.ecmwf, .gfs, .icon, .meteofrance, .ukmo]
    ) {
        self.location = location
        self.client = client
        self.models = models
    }

    // MARK: - Data Fetching

    /// Fetch and aggregate forecast data for the location
    public func fetchForecast() async {
        isLoading = true
        error = nil

        do {
            // Fetch forecasts from multiple models concurrently
            let forecasts = try await client.fetchForecasts(
                models: models,
                coordinates: location.coordinates,
                forecastDays: 7,
                timezone: location.timezone.rawValue
            )

            // Aggregate forecasts using SharedKit
            let aggregated = try await AggregateService.aggregate(forecasts)

            // Generate narrative from aggregated data
            let confidence = aggregated.consensus.hourly.prefix(24).map { hourly in
                ConfidenceService.calculateConfidence(
                    aggregated: aggregated,
                    metric: .overall,
                    daysAhead: 0
                )
            }

            let narrativeOutput = NarrativeBuilder.generateNarrative(
                aggregated,
                confidence: Array(confidence)
            )

            // Generate chart series for visualization
            let charts = VisualizationMapper.generateChartSeries(
                from: aggregated,
                hourlyLimit: 48,
                dailyLimit: 7,
                canvasSize: CGSize(width: 300, height: 300)
            )

            // Update state
            forecast = aggregated
            narrative = narrativeOutput
            chartSeries = charts
            lastUpdated = Date()

        } catch {
            self.error = error
        }

        isLoading = false
    }

    /// Refresh forecast data with pull-to-refresh
    public func refresh() async {
        await fetchForecast()
    }

    // MARK: - Computed Properties

    /// Current weather conditions from first hourly forecast
    public var currentConditions: AggregatedHourlyForecast? {
        forecast?.consensus.hourly.first
    }

    /// Today's daily forecast
    public var todayForecast: AggregatedDailyForecast? {
        forecast?.consensus.daily.first
    }

    /// Hourly forecasts for next 24 hours
    public var next24Hours: [AggregatedHourlyForecast] {
        Array(forecast?.consensus.hourly.prefix(24) ?? [])
    }

    /// Daily forecasts for next 7 days
    public var next7Days: [AggregatedDailyForecast] {
        Array(forecast?.consensus.daily.prefix(7) ?? [])
    }

    /// Overall confidence level for the forecast
    public var overallConfidence: ConfidenceLevel? {
        forecast?.overallConfidence
    }

    /// Model forecasts for comparison
    public var modelForecasts: [ModelForecast] {
        forecast?.modelForecasts ?? []
    }

    /// Outlier models for the current hour
    public var outlierModels: [ModelName] {
        currentConditions?.modelAgreement.outlierModels ?? []
    }

    /// Models in agreement for the current hour
    public var agreementModels: [ModelName] {
        currentConditions?.modelAgreement.modelsInAgreement ?? []
    }

    // MARK: - Helper Methods

    /// Get hourly forecast at specific index
    public func hourlyForecast(at index: Int) -> AggregatedHourlyForecast? {
        guard let forecast = forecast,
              index < forecast.consensus.hourly.count else {
            return nil
        }
        return forecast.consensus.hourly[index]
    }

    /// Get daily forecast at specific index
    public func dailyForecast(at index: Int) -> AggregatedDailyForecast? {
        guard let forecast = forecast,
              index < forecast.consensus.daily.count else {
            return nil
        }
        return forecast.consensus.daily[index]
    }

    /// Get model forecast for specific model
    public func modelForecast(for model: ModelName) -> ModelForecast? {
        forecast?.modelForecasts.first { $0.model == model }
    }
}
