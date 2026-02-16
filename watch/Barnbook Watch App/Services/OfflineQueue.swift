import Foundation

actor OfflineQueue {
    static let shared = OfflineQueue()

    private let directory: URL

    private init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        directory = docs.appendingPathComponent("pending_rides", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    var pendingCount: Int {
        get async {
            let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
            return files.filter { $0.pathExtension == "json" }.count
        }
    }

    func enqueue(_ ride: RideSession) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(ride)
        let file = directory.appendingPathComponent("\(ride.id.uuidString).json")
        try data.write(to: file)
    }

    func syncAll() async {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        let jsonFiles = files.filter { $0.pathExtension == "json" }

        for file in jsonFiles {
            guard let data = try? Data(contentsOf: file),
                  let ride = try? JSONDecoder.iso8601.decode(RideSession.self, from: data) else {
                continue
            }

            do {
                try await APIClient.shared.syncRide(ride)
                try? FileManager.default.removeItem(at: file)
            } catch APIError.unauthorized {
                // Re-auth and retry once
                do {
                    try await APIClient.shared.reAuthenticate()
                    try await APIClient.shared.syncRide(ride)
                    try? FileManager.default.removeItem(at: file)
                } catch {
                    // Leave for next attempt
                }
            } catch {
                // Leave for next attempt
            }
        }
    }

    func clear() {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        for file in files {
            try? FileManager.default.removeItem(at: file)
        }
    }
}

extension JSONDecoder {
    static let iso8601: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
