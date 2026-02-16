import Foundation

@Observable
final class SummaryViewModel {
    let ride: RideSession
    var syncStatus: SyncStatus

    init(ride: RideSession) {
        self.ride = ride
        self.syncStatus = ride.syncStatus
    }

    var totalMinutes: String {
        "\(ride.totalDurationMinutes) min"
    }

    var walkText: String {
        "\(ride.walkMinutes) min"
    }

    var trotText: String {
        "\(ride.trotMinutes) min"
    }

    var canterText: String {
        "\(ride.canterMinutes) min"
    }

    var distanceText: String {
        if let d = ride.distanceMiles {
            return String(format: "%.2f mi", d)
        }
        return "--"
    }

    var heartRateText: String {
        if let avg = ride.heartRateAvg {
            return "Avg \(avg) / Max \(ride.heartRateMax ?? avg) bpm"
        }
        return "--"
    }

    var caloriesText: String {
        if let cal = ride.riderCalories {
            return "\(cal) cal"
        }
        return "--"
    }

    func syncRide() async {
        syncStatus = .syncing
        do {
            try await APIClient.shared.syncRide(ride)
            syncStatus = .synced
        } catch APIError.unauthorized {
            do {
                try await APIClient.shared.reAuthenticate()
                try await APIClient.shared.syncRide(ride)
                syncStatus = .synced
            } catch {
                syncStatus = .failed
                try? await OfflineQueue.shared.enqueue(ride)
            }
        } catch {
            syncStatus = .failed
            try? await OfflineQueue.shared.enqueue(ride)
        }
    }
}
