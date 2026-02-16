import Foundation
import CoreMotion

protocol GaitClassifying {
    var currentGait: Gait { get }
    func start()
    func stop()
}

@Observable
final class GaitClassifier: GaitClassifying {
    private let motionManager = CMMotionManager()
    private var buffer: [Double] = []
    private let bufferSize = 128
    private let sampleRate: Double = 50.0
    private var recentGaits: [Gait] = []

    private(set) var currentGait: Gait = .walk

    func start() {
        guard motionManager.isAccelerometerAvailable else { return }

        motionManager.accelerometerUpdateInterval = 1.0 / sampleRate
        buffer.removeAll()
        recentGaits.removeAll()

        motionManager.startAccelerometerUpdates(to: .init()) { [weak self] data, _ in
            guard let self, let data else { return }
            self.processAccelerometerData(data.acceleration.z)
        }
    }

    func stop() {
        motionManager.stopAccelerometerUpdates()
    }

    private func processAccelerometerData(_ z: Double) {
        buffer.append(z)

        if buffer.count >= bufferSize {
            let gait = classifyWindow(Array(buffer.suffix(bufferSize)))
            buffer.removeFirst(Int(sampleRate * 2)) // slide by 2 seconds

            recentGaits.append(gait)
            if recentGaits.count > 3 { recentGaits.removeFirst() }

            // Majority vote
            let voted = majorityVote(recentGaits)
            DispatchQueue.main.async {
                self.currentGait = voted
            }
        }
    }

    private func classifyWindow(_ window: [Double]) -> Gait {
        let rms = computeRMS(window)
        let dominantFreq = computeDominantFrequency(window)

        if rms < 0.25 || dominantFreq < 1.8 {
            return .walk
        } else if dominantFreq >= 2.5 && rms >= 0.4 {
            return .trot
        } else if rms >= 0.5 {
            return .canter
        } else {
            return .walk
        }
    }

    private func computeRMS(_ samples: [Double]) -> Double {
        let mean = samples.reduce(0, +) / Double(samples.count)
        let sumSquares = samples.reduce(0) { $0 + ($1 - mean) * ($1 - mean) }
        return sqrt(sumSquares / Double(samples.count))
    }

    private func computeDominantFrequency(_ samples: [Double]) -> Double {
        let mean = samples.reduce(0, +) / Double(samples.count)
        let centered = samples.map { $0 - mean }
        let n = centered.count

        // Autocorrelation to find dominant period
        var bestLag = 1
        var bestCorr = -Double.infinity

        let minLag = Int(sampleRate / 5.0)  // max 5 Hz
        let maxLag = Int(sampleRate / 0.5)  // min 0.5 Hz

        for lag in minLag..<min(maxLag, n / 2) {
            var corr = 0.0
            for i in 0..<(n - lag) {
                corr += centered[i] * centered[i + lag]
            }
            corr /= Double(n - lag)
            if corr > bestCorr {
                bestCorr = corr
                bestLag = lag
            }
        }

        return bestLag > 0 ? sampleRate / Double(bestLag) : 0
    }

    private func majorityVote(_ gaits: [Gait]) -> Gait {
        var counts: [Gait: Int] = [:]
        for g in gaits { counts[g, default: 0] += 1 }
        return counts.max(by: { $0.value < $1.value })?.key ?? .walk
    }
}

#if targetEnvironment(simulator)
@Observable
final class SimulatorGaitClassifier: GaitClassifying {
    private var timer: Timer?
    private let gaits: [Gait] = [.walk, .trot, .canter, .trot, .walk]
    private var index = 0

    private(set) var currentGait: Gait = .walk

    func start() {
        index = 0
        currentGait = .walk
        timer = Timer.scheduledTimer(withTimeInterval: 8.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.index = (self.index + 1) % self.gaits.count
            self.currentGait = self.gaits[self.index]
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }
}
#endif
