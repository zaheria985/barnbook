import Foundation

@Observable
final class RecordingViewModel {
    let recorder: SessionRecorder

    init(recorder: SessionRecorder) {
        self.recorder = recorder
    }

    var timerText: String {
        let total = Int(recorder.elapsedTime)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let seconds = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%02d:%02d", minutes, seconds)
    }

    var distanceText: String {
        String(format: "%.2f mi", recorder.distanceMiles)
    }

    var heartRateText: String {
        recorder.currentHeartRate > 0 ? "\(recorder.currentHeartRate) bpm" : "--"
    }

    var currentGait: Gait {
        recorder.currentGait
    }

    var isPaused: Bool {
        recorder.state == .paused
    }

    func startRide() async {
        await recorder.startRide()
    }

    func pauseRide() {
        recorder.pauseRide()
    }

    func resumeRide() {
        recorder.resumeRide()
    }

    func endRide() async -> RideSession? {
        return await recorder.endRide()
    }
}
