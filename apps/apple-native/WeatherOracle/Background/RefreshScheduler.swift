import Foundation
import BackgroundTasks
import SharedKit
import os.log

// MARK: - Task Identifiers

/// Background task identifiers (must match Info.plist)
public enum BackgroundTaskIdentifier: String {
    case appRefresh = "com.weatheroracle.refresh"
    case processing = "com.weatheroracle.processing"

    var identifier: String { rawValue }
}

// MARK: - Refresh Result

/// Result of a background refresh operation
public struct RefreshResult: Sendable {
    public let success: Bool
    public let locationsUpdated: Int
    public let errors: [Error]
    public let timestamp: Date

    public init(
        success: Bool,
        locationsUpdated: Int,
        errors: [Error] = [],
        timestamp: Date = Date()
    ) {
        self.success = success
        self.locationsUpdated = locationsUpdated
        self.errors = errors
        self.timestamp = timestamp
    }
}

// MARK: - Refresh Stats

/// Statistics tracking for background refreshes
public struct RefreshStats: Codable, Sendable {
    public var lastRefresh: Date?
    public var refreshCount: Int
    public var failureCount: Int
    public var lastFailure: Date?

    public init(
        lastRefresh: Date? = nil,
        refreshCount: Int = 0,
        failureCount: Int = 0,
        lastFailure: Date? = nil
    ) {
        self.lastRefresh = lastRefresh
        self.refreshCount = refreshCount
        self.failureCount = failureCount
        self.lastFailure = lastFailure
    }
}

// MARK: - Refresh Scheduler

/// Manages background refresh tasks and data synchronization
@MainActor
public final class RefreshScheduler {
    // MARK: - Properties

    private let client: OpenMeteoClient
    private let store: CloudSyncStore
    private let notificationEngine: NotificationEngine
    private let models: [ModelName]

    /// Shared app group container for watch/widget access
    private let appGroupIdentifier = "group.com.weatheroracle.shared"

    /// Rate limiting: max 4 refreshes per hour as per Apple guidelines
    private static let maxRefreshesPerHour = 4
    private static let minRefreshInterval: TimeInterval = 15 * 60 // 15 minutes

    /// Background task logger
    private let logger = Logger(subsystem: "com.weatheroracle", category: "background")

    /// Stats tracking
    private var stats: RefreshStats {
        get {
            if let data = UserDefaults.standard.data(forKey: "refresh_stats"),
               let decoded = try? JSONDecoder().decode(RefreshStats.self, from: data) {
                return decoded
            }
            return RefreshStats()
        }
        set {
            if let encoded = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(encoded, forKey: "refresh_stats")
            }
        }
    }

    // MARK: - Initialization

    public init(
        client: OpenMeteoClient = OpenMeteoClient(),
        store: CloudSyncStore,
        notificationEngine: NotificationEngine,
        models: [ModelName] = [.ecmwf, .gfs, .icon]
    ) {
        self.client = client
        self.store = store
        self.notificationEngine = notificationEngine
        self.models = models
    }

    // MARK: - Registration

    /// Register background task handlers
    public func register() {
        // App refresh task (quick updates, < 30 seconds)
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: BackgroundTaskIdentifier.appRefresh.identifier,
            using: nil
        ) { [weak self] task in
            guard let self = self else {
                task.setTaskCompleted(success: false)
                return
            }

            Task {
                await self.handleAppRefresh(task: task as! BGAppRefreshTask)
            }
        }

        // Processing task (longer updates, up to several minutes)
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: BackgroundTaskIdentifier.processing.identifier,
            using: nil
        ) { [weak self] task in
            guard let self = self else {
                task.setTaskCompleted(success: false)
                return
            }

            Task {
                await self.handleProcessing(task: task as! BGProcessingTask)
            }
        }

        logger.info("Background tasks registered")
    }

    // MARK: - Scheduling

    /// Schedule next app refresh
    public func scheduleAppRefresh(earliestBeginDate: Date? = nil) {
        let request = BGAppRefreshTaskRequest(
            identifier: BackgroundTaskIdentifier.appRefresh.identifier
        )

        // Default to 15 minutes from now, respecting rate limits
        let beginDate = earliestBeginDate ?? Date().addingTimeInterval(Self.minRefreshInterval)
        request.earliestBeginDate = beginDate

        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("App refresh scheduled for \(beginDate)")
        } catch {
            logger.error("Failed to schedule app refresh: \(error.localizedDescription)")
        }
    }

    /// Schedule processing task
    public func scheduleProcessing(earliestBeginDate: Date? = nil) {
        let request = BGProcessingTaskRequest(
            identifier: BackgroundTaskIdentifier.processing.identifier
        )

        // Default to 1 hour from now
        let beginDate = earliestBeginDate ?? Date().addingTimeInterval(3600)
        request.earliestBeginDate = beginDate
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false

        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Processing task scheduled for \(beginDate)")
        } catch {
            logger.error("Failed to schedule processing task: \(error.localizedDescription)")
        }
    }

    /// Cancel all scheduled tasks
    public func cancelAllTasks() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: BackgroundTaskIdentifier.appRefresh.identifier)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: BackgroundTaskIdentifier.processing.identifier)
        logger.info("All background tasks cancelled")
    }

    // MARK: - Rate Limiting

    /// Check if refresh is allowed based on rate limits
    private func canRefresh() -> Bool {
        // Get refresh history for last hour
        let oneHourAgo = Date().addingTimeInterval(-3600)

        // Check last refresh timestamp
        if let lastRefresh = stats.lastRefresh,
           lastRefresh > Date().addingTimeInterval(-Self.minRefreshInterval) {
            logger.warning("Rate limit: Too soon since last refresh")
            return false
        }

        // Simple rate limit check (full implementation would track all refreshes in last hour)
        if stats.refreshCount >= Self.maxRefreshesPerHour {
            logger.warning("Rate limit: Max refreshes per hour reached")
            return false
        }

        return true
    }

    // MARK: - Task Handlers

    /// Handle app refresh task
    private func handleAppRefresh(task: BGAppRefreshTask) async {
        logger.info("App refresh task started")

        // Schedule next refresh
        scheduleAppRefresh()

        // Set expiration handler
        task.expirationHandler = { [weak self] in
            self?.logger.warning("App refresh task expired")
            task.setTaskCompleted(success: false)
        }

        // Check rate limits
        guard canRefresh() else {
            logger.warning("Refresh skipped due to rate limiting")
            task.setTaskCompleted(success: true)
            return
        }

        // Perform refresh
        let result = await performRefresh(maxLocations: 3) // Quick refresh for limited locations

        // Update stats
        updateStats(result: result)

        // Write data to app group
        writeToAppGroup(result: result)

        task.setTaskCompleted(success: result.success)
        logger.info("App refresh completed: \(result.success ? "success" : "failure")")
    }

    /// Handle processing task
    private func handleProcessing(task: BGProcessingTask) async {
        logger.info("Processing task started")

        // Schedule next processing
        scheduleProcessing()

        // Set expiration handler
        task.expirationHandler = { [weak self] in
            self?.logger.warning("Processing task expired")
            task.setTaskCompleted(success: false)
        }

        // Check rate limits
        guard canRefresh() else {
            logger.warning("Processing skipped due to rate limiting")
            task.setTaskCompleted(success: true)
            return
        }

        // Perform full refresh
        let result = await performRefresh(maxLocations: nil) // All locations

        // Update stats
        updateStats(result: result)

        // Write data to app group
        writeToAppGroup(result: result)

        // Evaluate notification rules
        await evaluateNotificationRules()

        task.setTaskCompleted(success: result.success)
        logger.info("Processing task completed: \(result.success ? "success" : "failure")")
    }

    // MARK: - Refresh Logic

    /// Perform weather data refresh
    private func performRefresh(maxLocations: Int? = nil) async -> RefreshResult {
        var locations = store.locations
        if let max = maxLocations {
            locations = Array(locations.prefix(max))
        }

        guard !locations.isEmpty else {
            logger.info("No locations to refresh")
            return RefreshResult(success: true, locationsUpdated: 0)
        }

        var updatedCount = 0
        var errors: [Error] = []

        logger.info("Refreshing \(locations.count) locations")

        for location in locations {
            do {
                // Fetch forecasts from multiple models
                let forecasts = try await client.fetchForecasts(
                    models: models,
                    coordinates: location.coordinates,
                    forecastDays: 7,
                    timezone: location.timezone.rawValue
                )

                // Aggregate forecasts
                let aggregated = try await AggregateService.aggregate(forecasts)

                // Store in app group for widgets/watch
                try storeAggregatedForecast(aggregated, for: location)

                updatedCount += 1
                logger.debug("Updated forecast for \(location.name)")

            } catch {
                logger.error("Failed to update \(location.name): \(error.localizedDescription)")
                errors.append(error)
            }
        }

        let success = errors.isEmpty
        return RefreshResult(
            success: success,
            locationsUpdated: updatedCount,
            errors: errors
        )
    }

    /// Evaluate notification rules after refresh
    private func evaluateNotificationRules() async {
        let locations = store.locations

        for location in locations {
            // Load aggregated forecast from app group
            guard let forecast = loadAggregatedForecast(for: location) else {
                continue
            }

            // Evaluate rules
            let alerts = notificationEngine.evaluateRules(location: location, forecast: forecast)

            // Schedule notifications
            for alert in alerts {
                do {
                    try await notificationEngine.scheduleNotification(for: alert)
                    logger.info("Scheduled notification for \(location.name): \(alert.description)")
                } catch {
                    logger.error("Failed to schedule notification: \(error.localizedDescription)")
                }
            }

            // Check for model divergence
            if let divergence = notificationEngine.detectModelDivergence(forecast: forecast) {
                do {
                    try await notificationEngine.scheduleModelDivergenceNotification(for: divergence)
                    logger.info("Scheduled divergence alert for \(location.name)")
                } catch {
                    logger.error("Failed to schedule divergence notification: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - App Group Storage

    /// Get app group container URL
    private func appGroupContainer() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }

    /// Store aggregated forecast in app group
    private func storeAggregatedForecast(_ forecast: AggregatedForecast, for location: LocationEntity) throws {
        guard let container = appGroupContainer() else {
            throw NSError(domain: "RefreshScheduler", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Failed to access app group container"
            ])
        }

        let forecastsDir = container.appendingPathComponent("forecasts", isDirectory: true)
        try FileManager.default.createDirectory(at: forecastsDir, withIntermediateDirectories: true)

        let fileURL = forecastsDir.appendingPathComponent("\(location.id.uuidString).json")

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(forecast)

        try data.write(to: fileURL)
        logger.debug("Stored forecast for \(location.name) in app group")
    }

    /// Load aggregated forecast from app group
    private func loadAggregatedForecast(for location: LocationEntity) -> AggregatedForecast? {
        guard let container = appGroupContainer() else {
            return nil
        }

        let fileURL = container
            .appendingPathComponent("forecasts", isDirectory: true)
            .appendingPathComponent("\(location.id.uuidString).json")

        guard let data = try? Data(contentsOf: fileURL) else {
            return nil
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(AggregatedForecast.self, from: data)
    }

    /// Write refresh result to app group for widgets
    private func writeToAppGroup(result: RefreshResult) {
        guard let container = appGroupContainer() else {
            return
        }

        let statusURL = container.appendingPathComponent("refresh_status.json")

        let status: [String: Any] = [
            "success": result.success,
            "locationsUpdated": result.locationsUpdated,
            "timestamp": result.timestamp.timeIntervalSince1970,
            "errorCount": result.errors.count
        ]

        if let data = try? JSONSerialization.data(withJSONObject: status) {
            try? data.write(to: statusURL)
            logger.debug("Wrote refresh status to app group")
        }
    }

    // MARK: - Stats Management

    /// Update refresh statistics
    private func updateStats(result: RefreshResult) {
        var current = stats

        current.lastRefresh = result.timestamp
        current.refreshCount += 1

        if !result.success {
            current.failureCount += 1
            current.lastFailure = result.timestamp
        }

        stats = current

        logger.info("Stats updated: \(current.refreshCount) refreshes, \(current.failureCount) failures")
    }

    /// Reset statistics
    public func resetStats() {
        stats = RefreshStats()
        logger.info("Stats reset")
    }

    /// Get current statistics
    public func getStats() -> RefreshStats {
        stats
    }

    // MARK: - Testing Support

    /// Simulate background refresh for testing
    public func simulateBackgroundRefresh() async -> RefreshResult {
        logger.info("Simulating background refresh")
        return await performRefresh(maxLocations: nil)
    }

    /// Force refresh bypassing rate limits (for testing)
    public func forceRefresh() async -> RefreshResult {
        logger.info("Forcing refresh (bypassing rate limits)")
        return await performRefresh(maxLocations: nil)
    }
}
