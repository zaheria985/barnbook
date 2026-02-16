import Foundation
import Combine

enum RecordingState: Equatable {
    case idle
    case preRide(Horse)
    case recording
    case paused
    case finishing
    case completed
}

@Observable
final class SessionRecorder {
    private(set) var state: RecordingState = .idle
    private(set) var elapsedTime: TimeInterval = 0
    private(set) var distanceMiles: Double = 0
    private(set) var currentHeartRate: Int = 0
    private(set) var currentGait: Gait = .walk

    private var horse: Horse?
    private var startDate: Date?
    private var gaitSegments: [GaitSegment] = []
    private var timer: Timer?
    private var pausedElapsed: TimeInterval = 0
    private var pauseStart: Date?
    private var totalPauseDuration: TimeInterval = 0

    private let gaitClassifier: any GaitClassifying
    private let locationTracker: LocationTracker
    private let healthKit: HealthKitManager

    init() {
        #if targetEnvironment(simulator)
        self.gaitClassifier = SimulatorGaitClassifier()
        #else
        self.gaitClassifier = GaitClassifier()
        #endif
        self.locationTracker = LocationTracker()
        self.healthKit = HealthKitManager()
    }

    func selectHorse(_ horse: Horse) {
        self.horse = horse
        state = .preRide(horse)
    }

    func startRide() async {
        guard let horse else { return }

        state = .recording
        startDate = Date()
        elapsedTime = 0
        distanceMiles = 0
        totalPauseDuration = 0
        gaitSegments = [GaitSegment(gait: .walk, startTime: Date())]

        gaitClassifier.start()
        locationTracker.start()

        if healthKit.isAvailable {
            try? await healthKit.requestAuthorization()
            try? await healthKit.startWorkout()
        }

        startTimer()

        _ = horse // silence unused warning
    }

    func pauseRide() {
        guard state == .recording else { return }
        state = .paused
        pauseStart = Date()

        gaitClassifier.stop()
        locationTracker.stop()
        healthKit.pauseWorkout()
        timer?.invalidate()
    }

    func resumeRide() {
        guard state == .paused else { return }

        if let ps = pauseStart {
            totalPauseDuration += Date().timeIntervalSince(ps)
        }
        pauseStart = nil

        state = .recording
        gaitClassifier.start()
        locationTracker.start()
        healthKit.resumeWorkout()
        startTimer()
    }

    func endRide() async -> RideSession? {
        guard let horse, let startDate else { return nil }

        state = .finishing
        timer?.invalidate()
        gaitClassifier.stop()
        locationTracker.stop()

        if healthKit.isAvailable {
            try? await healthKit.endWorkout()
        }

        // Close the last gait segment
        if var last = gaitSegments.last {
            last.endTime = Date()
            gaitSegments[gaitSegments.count - 1] = last
        }

        // Compute gait minutes
        let totalSeconds = elapsedTime
        let totalMinutes = Int(round(totalSeconds / 60))
        guard totalMinutes > 0 else {
            state = .idle
            return nil
        }

        var walkSeconds: TimeInterval = 0
        var trotSeconds: TimeInterval = 0
        var canterSeconds: TimeInterval = 0

        for segment in gaitSegments {
            let dur = segment.durationSeconds
            switch segment.gait {
            case .walk: walkSeconds += dur
            case .trot: trotSeconds += dur
            case .canter: canterSeconds += dur
            }
        }

        let totalGaitSeconds = walkSeconds + trotSeconds + canterSeconds
        guard totalGaitSeconds > 0 else {
            state = .idle
            return nil
        }

        // Scale to totalMinutes so they sum correctly
        let scale = Double(totalMinutes) * 60.0 / totalGaitSeconds
        var walkMin = Int(round(walkSeconds * scale / 60.0))
        var trotMin = Int(round(trotSeconds * scale / 60.0))
        var canterMin = Int(round(canterSeconds * scale / 60.0))

        // Adjust rounding to match total
        let diff = totalMinutes - (walkMin + trotMin + canterMin)
        if diff != 0 {
            // Add/subtract from the largest bucket
            if walkMin >= trotMin && walkMin >= canterMin {
                walkMin += diff
            } else if trotMin >= canterMin {
                trotMin += diff
            } else {
                canterMin += diff
            }
        }

        let calories = CalorieCalculator.riderCalories(
            walkMin: Double(walkMin),
            trotMin: Double(trotMin),
            canterMin: Double(canterMin)
        )
        let mcal = CalorieCalculator.horseMcal(
            walkMin: Double(walkMin),
            trotMin: Double(trotMin),
            canterMin: Double(canterMin),
            horseWeightLbs: horse.weightLbs ?? 1100
        )

        let ride = RideSession(
            id: UUID(),
            horseId: horse.id,
            horseName: horse.name,
            date: startDate,
            totalDurationMinutes: totalMinutes,
            walkMinutes: walkMin,
            trotMinutes: trotMin,
            canterMinutes: canterMin,
            distanceMiles: locationTracker.totalDistanceMiles > 0.01 ? locationTracker.totalDistanceMiles : nil,
            heartRateAvg: healthKit.averageHeartRate > 0 ? healthKit.averageHeartRate : nil,
            heartRateMax: healthKit.maxHeartRate > 0 ? healthKit.maxHeartRate : nil,
            riderCalories: calories,
            horseMcal: mcal,
            gaitSegments: gaitSegments,
            syncStatus: .pending
        )

        state = .completed
        return ride
    }

    func reset() {
        state = .idle
        horse = nil
        startDate = nil
        elapsedTime = 0
        distanceMiles = 0
        currentHeartRate = 0
        currentGait = .walk
        gaitSegments = []
        totalPauseDuration = 0
        timer?.invalidate()
    }

    // MARK: - Private

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self, let start = self.startDate else { return }

            var paused = self.totalPauseDuration
            if let ps = self.pauseStart {
                paused += Date().timeIntervalSince(ps)
            }

            self.elapsedTime = Date().timeIntervalSince(start) - paused
            self.distanceMiles = self.locationTracker.totalDistanceMiles
            self.currentHeartRate = self.healthKit.currentHeartRate

            let newGait = self.gaitClassifier.currentGait
            if newGait != self.currentGait {
                // Close current segment, start new one
                if var last = self.gaitSegments.last {
                    last.endTime = Date()
                    self.gaitSegments[self.gaitSegments.count - 1] = last
                }
                self.gaitSegments.append(GaitSegment(gait: newGait, startTime: Date()))
                self.currentGait = newGait
            } else if var last = self.gaitSegments.last {
                last.endTime = Date()
                self.gaitSegments[self.gaitSegments.count - 1] = last
            }
        }
    }
}
