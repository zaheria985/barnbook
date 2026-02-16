import Foundation
import HealthKit

@Observable
final class HealthKitManager: NSObject {
    private let store = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var heartRateQuery: HKAnchoredObjectQuery?

    private(set) var currentHeartRate: Int = 0
    private(set) var averageHeartRate: Int = 0
    private(set) var maxHeartRate: Int = 0
    private var heartRateReadings: [Int] = []
    private(set) var activeCalories: Double = 0

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    func requestAuthorization() async throws {
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]
        let typesToRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        ]

        try await store.requestAuthorization(toShare: typesToShare, read: typesToRead)
    }

    func startWorkout() async throws {
        let config = HKWorkoutConfiguration()
        config.activityType = .equestrianSports
        config.locationType = .outdoor

        let session = try HKWorkoutSession(healthStore: store, configuration: config)
        let builder = session.associatedWorkoutBuilder()
        builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)

        self.workoutSession = session
        self.builder = builder
        heartRateReadings.removeAll()
        currentHeartRate = 0
        averageHeartRate = 0
        maxHeartRate = 0

        session.startActivity(with: Date())
        try await builder.beginCollection(at: Date())

        startHeartRateQuery()
    }

    func pauseWorkout() {
        workoutSession?.pause()
    }

    func resumeWorkout() {
        workoutSession?.resume()
    }

    func endWorkout() async throws {
        workoutSession?.end()
        stopHeartRateQuery()

        if let builder {
            try await builder.endCollection(at: Date())
            try await builder.finishWorkout()
        }

        workoutSession = nil
        builder = nil
    }

    private func startHeartRateQuery() {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else { return }

        let predicate = HKQuery.predicateForSamples(withStart: Date(), end: nil)
        let query = HKAnchoredObjectQuery(type: hrType, predicate: predicate, anchor: nil, limit: HKObjectQueryNoLimit) { [weak self] _, samples, _, _, _ in
            self?.processHeartRateSamples(samples)
        }
        query.updateHandler = { [weak self] _, samples, _, _, _ in
            self?.processHeartRateSamples(samples)
        }

        heartRateQuery = query
        store.execute(query)
    }

    private func stopHeartRateQuery() {
        if let query = heartRateQuery {
            store.stop(query)
            heartRateQuery = nil
        }
    }

    private func processHeartRateSamples(_ samples: [HKSample]?) {
        guard let samples = samples as? [HKQuantitySample] else { return }

        for sample in samples {
            let bpm = Int(sample.quantity.doubleValue(for: .count().unitDivided(by: .minute())))
            heartRateReadings.append(bpm)

            DispatchQueue.main.async {
                self.currentHeartRate = bpm
                self.maxHeartRate = max(self.maxHeartRate, bpm)
                if !self.heartRateReadings.isEmpty {
                    self.averageHeartRate = self.heartRateReadings.reduce(0, +) / self.heartRateReadings.count
                }
            }
        }
    }
}
