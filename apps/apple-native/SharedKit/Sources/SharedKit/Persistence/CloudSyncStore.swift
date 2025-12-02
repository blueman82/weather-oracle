import Combine
import Foundation

// MARK: - Key-Value Store Protocol

/// Protocol for key-value storage backends.
/// Enables dependency injection for testing.
public protocol KeyValueStoreProtocol: Sendable {
    func object(forKey key: String) -> Any?
    func set(_ value: Any?, forKey key: String)
    func removeObject(forKey key: String)
    @discardableResult
    func synchronize() -> Bool
    func dictionaryRepresentation() -> [String: Any]
}

// MARK: - NSUbiquitousKeyValueStore Conformance

#if canImport(UIKit) || canImport(AppKit)
    extension NSUbiquitousKeyValueStore: KeyValueStoreProtocol {
        public func dictionaryRepresentation() -> [String: Any] {
            self.dictionaryRepresentation as [String: Any]
        }
    }
#endif

// MARK: - UserDefaults Conformance (fallback)

extension UserDefaults: KeyValueStoreProtocol {
    // UserDefaults already has dictionaryRepresentation(), protocol extension not needed
}

// MARK: - In-Memory Store (for testing)

/// In-memory key-value store for testing.
public final class InMemoryKeyValueStore: KeyValueStoreProtocol, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: Any] = [:]

    public init() {}

    public func object(forKey key: String) -> Any? {
        lock.lock()
        defer { lock.unlock() }
        return storage[key]
    }

    public func set(_ value: Any?, forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        if let value {
            storage[key] = value
        } else {
            storage.removeValue(forKey: key)
        }
    }

    public func removeObject(forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        storage.removeValue(forKey: key)
    }

    public func synchronize() -> Bool {
        true
    }

    public func dictionaryRepresentation() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return storage
    }

    /// Clear all stored values.
    public func clear() {
        lock.lock()
        defer { lock.unlock() }
        storage.removeAll()
    }
}

// MARK: - Cloud Sync Store

/// Persistence layer combining NSUbiquitousKeyValueStore for quick sync.
/// Provides publishers for change notifications with debouncing.
@MainActor
public final class CloudSyncStore: ObservableObject {
    // MARK: - Properties

    private let store: KeyValueStoreProtocol
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// Publisher for preference changes, debounced to prevent excessive writes.
    private let changeSubject = PassthroughSubject<PreferenceChange, Never>()

    /// Debounced publisher for preference changes.
    public var changePublisher: AnyPublisher<PreferenceChange, Never> {
        changeSubject
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .eraseToAnyPublisher()
    }

    /// Current user preferences (published for SwiftUI).
    @Published public private(set) var preferences: UserPreferences

    // MARK: - Initialization

    /// Creates a CloudSyncStore with the specified backing store.
    /// - Parameter store: The key-value store to use. Defaults to NSUbiquitousKeyValueStore if available.
    public init(store: KeyValueStoreProtocol? = nil) {
        #if canImport(UIKit) || canImport(AppKit)
            self.store = store ?? NSUbiquitousKeyValueStore.default
        #else
            self.store = store ?? UserDefaults.standard
        #endif

        // Load initial preferences
        preferences = UserPreferences.default

        // Perform migration if needed
        migrateIfNeeded()

        // Load stored preferences
        loadPreferences()

        // Register for external change notifications
        setupChangeNotifications()
    }

    // MARK: - Public API

    /// Get all saved locations in order.
    public var locations: [LocationEntity] {
        preferences.locations
    }

    /// Add a location to the saved list.
    public func addLocation(_ location: LocationEntity) {
        var updated = preferences
        // Avoid duplicates
        if !updated.locations.contains(where: { $0.id == location.id }) {
            updated.locations.append(location)
            updated.lastModified = Date()
            savePreferences(updated, changedKey: .locations)
        }
    }

    /// Remove a location by ID.
    public func removeLocation(id: UUID) {
        var updated = preferences
        updated.locations.removeAll { $0.id == id }
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .locations)
    }

    /// Reorder locations.
    public func reorderLocations(_ locations: [LocationEntity]) {
        var updated = preferences
        updated.locations = locations
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .locations)
    }

    /// Update temperature unit.
    public func setTemperatureUnit(_ unit: TemperatureUnit) {
        var updated = preferences
        updated.temperatureUnit = unit
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .temperatureUnit)
    }

    /// Update wind speed unit.
    public func setWindSpeedUnit(_ unit: WindSpeedUnit) {
        var updated = preferences
        updated.windSpeedUnit = unit
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .windSpeedUnit)
    }

    /// Update pressure unit.
    public func setPressureUnit(_ unit: PressureUnit) {
        var updated = preferences
        updated.pressureUnit = unit
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .pressureUnit)
    }

    /// Update precipitation unit.
    public func setPrecipitationUnit(_ unit: PrecipitationUnit) {
        var updated = preferences
        updated.precipitationUnit = unit
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .precipitationUnit)
    }

    /// Update widget layout.
    public func setWidgetLayout(_ layout: WidgetLayout) {
        var updated = preferences
        updated.widgetLayout = layout
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .widgetLayout)
    }

    /// Add a notification rule.
    public func addNotificationRule(_ rule: NotificationRule) {
        var updated = preferences
        updated.notificationRules.append(rule)
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .notificationRules)
    }

    /// Remove a notification rule by ID.
    public func removeNotificationRule(id: UUID) {
        var updated = preferences
        updated.notificationRules.removeAll { $0.id == id }
        updated.lastModified = Date()
        savePreferences(updated, changedKey: .notificationRules)
    }

    /// Update a notification rule.
    public func updateNotificationRule(_ rule: NotificationRule) {
        var updated = preferences
        if let index = updated.notificationRules.firstIndex(where: { $0.id == rule.id }) {
            updated.notificationRules[index] = rule
            updated.lastModified = Date()
            savePreferences(updated, changedKey: .notificationRules)
        }
    }

    /// Force synchronization with iCloud.
    @discardableResult
    public func synchronize() -> Bool {
        store.synchronize()
    }

    // MARK: - Migration

    /// Migrate from UserDefaults if needed.
    public func migrateFromUserDefaults(_ defaults: UserDefaults = .standard) {
        // Check if we've already migrated
        if store.object(forKey: PreferenceKey.schemaVersion.rawValue) != nil {
            return
        }

        // Check for legacy data in UserDefaults
        let legacyKeys = [
            "saved_locations",
            "temperature_unit",
            "wind_speed_unit",
        ]

        var hasLegacyData = false
        for key in legacyKeys {
            if defaults.object(forKey: key) != nil {
                hasLegacyData = true
                break
            }
        }

        if hasLegacyData {
            // Migrate locations if present
            if let data = defaults.data(forKey: "saved_locations"),
               let locations = try? decoder.decode([LocationEntity].self, from: data)
            {
                var updated = preferences
                updated.locations = locations
                preferences = updated
            }

            // Migrate temperature unit
            if let rawValue = defaults.string(forKey: "temperature_unit"),
               let unit = TemperatureUnit(rawValue: rawValue)
            {
                var updated = preferences
                updated.temperatureUnit = unit
                preferences = updated
            }

            // Save migrated preferences
            savePreferences(preferences, changedKey: nil)

            // Clear legacy data
            for key in legacyKeys {
                defaults.removeObject(forKey: key)
            }
        }

        // Mark migration complete
        store.set(PreferenceSchemaVersion.current.rawValue, forKey: PreferenceKey.schemaVersion.rawValue)
        store.synchronize()
    }

    // MARK: - Private Methods

    private func migrateIfNeeded() {
        let storedVersion = store.object(forKey: PreferenceKey.schemaVersion.rawValue) as? Int
        let currentVersion = PreferenceSchemaVersion.current.rawValue

        if storedVersion == nil {
            // First run or migration from UserDefaults needed
            migrateFromUserDefaults()
        } else if storedVersion! < currentVersion {
            // Future schema migrations go here
        }
    }

    private func loadPreferences() {
        var loaded = UserPreferences.default

        // Load locations
        if let data = store.object(forKey: PreferenceKey.locations.rawValue) as? Data,
           let locations = try? decoder.decode([LocationEntity].self, from: data)
        {
            loaded.locations = locations
        }

        // Load temperature unit
        if let rawValue = store.object(forKey: PreferenceKey.temperatureUnit.rawValue) as? String,
           let unit = TemperatureUnit(rawValue: rawValue)
        {
            loaded.temperatureUnit = unit
        }

        // Load wind speed unit
        if let rawValue = store.object(forKey: PreferenceKey.windSpeedUnit.rawValue) as? String,
           let unit = WindSpeedUnit(rawValue: rawValue)
        {
            loaded.windSpeedUnit = unit
        }

        // Load pressure unit
        if let rawValue = store.object(forKey: PreferenceKey.pressureUnit.rawValue) as? String,
           let unit = PressureUnit(rawValue: rawValue)
        {
            loaded.pressureUnit = unit
        }

        // Load precipitation unit
        if let rawValue = store.object(forKey: PreferenceKey.precipitationUnit.rawValue) as? String,
           let unit = PrecipitationUnit(rawValue: rawValue)
        {
            loaded.precipitationUnit = unit
        }

        // Load widget layout
        if let data = store.object(forKey: PreferenceKey.widgetLayout.rawValue) as? Data,
           let layout = try? decoder.decode(WidgetLayout.self, from: data)
        {
            loaded.widgetLayout = layout
        }

        // Load notification rules
        if let data = store.object(forKey: PreferenceKey.notificationRules.rawValue) as? Data,
           let rules = try? decoder.decode([NotificationRule].self, from: data)
        {
            loaded.notificationRules = rules
        }

        // Load last sync timestamp
        if let timestamp = store.object(forKey: PreferenceKey.lastSyncTimestamp.rawValue) as? Double {
            loaded.lastModified = Date(timeIntervalSince1970: timestamp)
        }

        preferences = loaded
    }

    private func savePreferences(_ newPreferences: UserPreferences, changedKey: PreferenceKey?) {
        // Save locations
        if let data = try? encoder.encode(newPreferences.locations) {
            store.set(data, forKey: PreferenceKey.locations.rawValue)
        }

        // Save units
        store.set(newPreferences.temperatureUnit.rawValue, forKey: PreferenceKey.temperatureUnit.rawValue)
        store.set(newPreferences.windSpeedUnit.rawValue, forKey: PreferenceKey.windSpeedUnit.rawValue)
        store.set(newPreferences.pressureUnit.rawValue, forKey: PreferenceKey.pressureUnit.rawValue)
        store.set(newPreferences.precipitationUnit.rawValue, forKey: PreferenceKey.precipitationUnit.rawValue)

        // Save widget layout
        if let data = try? encoder.encode(newPreferences.widgetLayout) {
            store.set(data, forKey: PreferenceKey.widgetLayout.rawValue)
        }

        // Save notification rules
        if let data = try? encoder.encode(newPreferences.notificationRules) {
            store.set(data, forKey: PreferenceKey.notificationRules.rawValue)
        }

        // Save last sync timestamp
        store.set(newPreferences.lastModified.timeIntervalSince1970, forKey: PreferenceKey.lastSyncTimestamp.rawValue)

        // Synchronize
        store.synchronize()

        // Update published property
        preferences = newPreferences

        // Emit change notification
        if let key = changedKey {
            let change = PreferenceChange(key: key, timestamp: Date())
            changeSubject.send(change)
        }
    }

    private func setupChangeNotifications() {
        #if canImport(UIKit) || canImport(AppKit)
            NotificationCenter.default.addObserver(
                forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                Task { @MainActor in
                    self?.handleExternalChange(notification)
                }
            }
        #endif
    }

    private func handleExternalChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let changeReason = userInfo[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int
        else {
            return
        }

        switch changeReason {
        case NSUbiquitousKeyValueStoreServerChange,
             NSUbiquitousKeyValueStoreInitialSyncChange:
            // Reload preferences from store
            loadPreferences()

        case NSUbiquitousKeyValueStoreQuotaViolationChange:
            // Handle quota exceeded - could notify user
            break

        case NSUbiquitousKeyValueStoreAccountChange:
            // Account changed - reload preferences
            loadPreferences()

        default:
            break
        }
    }

    // MARK: - Conflict Resolution

    /// Resolve conflicts using last-write-wins strategy.
    /// Called when external changes are detected.
    /// - Parameters:
    ///   - local: The local preferences state
    ///   - remote: The remote preferences state from iCloud
    /// - Returns: The winning preferences based on timestamp precedence
    public func resolveConflict(local: UserPreferences, remote: UserPreferences) -> UserPreferences {
        // Simple last-write-wins based on lastModified timestamp
        if remote.lastModified > local.lastModified {
            return remote
        }
        return local
    }

    /// Simulate external change notification for testing.
    /// - Parameter changedKeys: The keys that changed externally
    public func simulateExternalChange(changedKeys: [String]) {
        // Reload preferences from store
        loadPreferences()
    }

    /// Get the underlying change subject for testing debounce behavior.
    /// - Parameter change: The preference change to emit
    public func emitChange(_ change: PreferenceChange) {
        changeSubject.send(change)
    }
}

// MARK: - Convenience Extensions

public extension CloudSyncStore {
    /// Check if a location is saved.
    func hasLocation(id: UUID) -> Bool {
        locations.contains { $0.id == id }
    }

    /// Get a location by ID.
    func location(id: UUID) -> LocationEntity? {
        locations.first { $0.id == id }
    }

    /// Get enabled notification rules for a location.
    func enabledNotificationRules(for locationId: UUID?) -> [NotificationRule] {
        preferences.notificationRules.filter { rule in
            rule.isEnabled && (rule.locationId == nil || rule.locationId == locationId)
        }
    }
}
