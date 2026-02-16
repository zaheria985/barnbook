import Foundation

struct RideSession: Codable, Identifiable {
    let id: UUID
    let horseId: UUID
    let horseName: String
    let date: Date
    let totalDurationMinutes: Int
    let walkMinutes: Int
    let trotMinutes: Int
    let canterMinutes: Int
    let distanceMiles: Double?
    let heartRateAvg: Int?
    let heartRateMax: Int?
    let riderCalories: Int?
    let horseMcal: Double?
    let gaitSegments: [GaitSegment]
    var syncStatus: SyncStatus

    var apiPayload: [String: Any] {
        var payload: [String: Any] = [
            "horse_id": horseId.uuidString.lowercased(),
            "date": ISO8601DateFormatter.dateOnly.string(from: date),
            "total_duration_minutes": totalDurationMinutes,
            "walk_minutes": walkMinutes,
            "trot_minutes": trotMinutes,
            "canter_minutes": canterMinutes,
            "source": "watch"
        ]
        if let d = distanceMiles { payload["distance_miles"] = d }
        if let hr = heartRateAvg { payload["notes"] = "Avg HR: \(hr) bpm, Max HR: \(heartRateMax ?? hr) bpm" }
        return payload
    }
}

extension ISO8601DateFormatter {
    static let dateOnly: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f
    }()
}
