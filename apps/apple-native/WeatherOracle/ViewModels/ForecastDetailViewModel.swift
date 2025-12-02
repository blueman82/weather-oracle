import Foundation
import SharedKit
import SwiftUI
import Combine
import NotificationEngine

// MARK: - Forecast Detail View Model

/// View model for forecast detail screen with aggregation and narrative generation
@MainActor
@Observable
public final class ForecastDetailViewModel {
    // MARK: - Properties

    private let client: OpenMeteoClient
    private let models: [ModelName]
    private let notificationEngine: NotificationEngine?
    private let cloudSyncStore: CloudSyncStore?
    private var cancellables = Set<AnyCancellable>()

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
        models: [ModelName] = [.ecmwf, .gfs, .icon, .meteofrance, .ukmo],
        notificationEngine: NotificationEngine? = nil,
        cloudSyncStore: CloudSyncStore? = nil
    ) {
        self.location = location
        self.client = client
        self.models = models
        self.notificationEngine = notificationEngine
        self.cloudSyncStore = cloudSyncStore

        setupCloudSyncObserver()
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

        // Reschedule background alerts after successful refresh
        if let engine = notificationEngine, let currentForecast = forecast {
            await rescheduleNotifications(engine: engine, forecast: currentForecast)
        }
    }

    /// Reschedule notification alerts after forecast refresh
    private func rescheduleNotifications(engine: NotificationEngine, forecast: AggregatedForecast) async {
        // Evaluate alert rules for this location
        let results = engine.evaluateRules(location: location, forecast: forecast)

        // Schedule notifications for triggered alerts
        for result in results {
            do {
                try await engine.scheduleNotification(for: result)
            } catch {
                // Silently fail notification scheduling - don't block forecast refresh
                print("Failed to schedule notification: \(error)")
            }
        }

        // Check for model divergence
        if let divergenceAlert = engine.detectModelDivergence(forecast: forecast) {
            do {
                try await engine.scheduleModelDivergenceNotification(for: divergenceAlert)
            } catch {
                print("Failed to schedule divergence notification: \(error)")
            }
        }
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

    // MARK: - CloudSyncStore Integration

    /// Setup observer for CloudSyncStore preference changes
    private func setupCloudSyncObserver() {
        guard let store = cloudSyncStore else { return }

        // Subscribe to preference changes from CloudSyncStore
        store.changePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] change in
                guard let self = self else { return }

                // Refresh forecast when locations or preferences change
                switch change.key {
                case .locations, .temperatureUnit, .windSpeedUnit, .precipitationUnit, .pressureUnit:
                    // Automatically refresh forecast when relevant preferences change
                    Task {
                        await self.fetchForecast()
                    }
                default:
                    // Ignore other preference changes (widget layout, notification rules, etc.)
                    break
                }
            }
            .store(in: &cancellables)
    }
}
