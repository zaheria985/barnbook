import Foundation

enum SyncStatus: String, Codable {
    case pending
    case syncing
    case synced
    case failed

    var label: String {
        switch self {
        case .pending: return "Pending"
        case .syncing: return "Syncing..."
        case .synced: return "Synced"
        case .failed: return "Failed"
        }
    }
}
