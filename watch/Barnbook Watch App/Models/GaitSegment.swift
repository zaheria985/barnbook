import Foundation

enum Gait: String, Codable, CaseIterable {
    case walk
    case trot
    case canter

    var color: String {
        switch self {
        case .walk: return "emerald"
        case .trot: return "amber"
        case .canter: return "rose"
        }
    }

    var caloriesPerMinute: Double {
        switch self {
        case .walk: return 3.5
        case .trot: return 5.5
        case .canter: return 8.0
        }
    }

    var horseMcalPerHour: Double {
        switch self {
        case .walk: return 1.5
        case .trot: return 4.5
        case .canter: return 9.0
        }
    }
}

struct GaitSegment: Codable, Identifiable {
    let id: UUID
    let gait: Gait
    let startTime: Date
    var endTime: Date

    init(gait: Gait, startTime: Date) {
        self.id = UUID()
        self.gait = gait
        self.startTime = startTime
        self.endTime = startTime
    }

    var durationSeconds: TimeInterval {
        endTime.timeIntervalSince(startTime)
    }

    var durationMinutes: Double {
        durationSeconds / 60.0
    }
}
