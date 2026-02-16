import SwiftUI

struct SyncStatusBadge: View {
    let status: SyncStatus

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: iconName)
                .font(.caption2)
            Text(status.label)
                .font(.caption2)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(backgroundColor.opacity(0.2))
        .foregroundStyle(foregroundColor)
        .clipShape(Capsule())
    }

    private var iconName: String {
        switch status {
        case .pending: return "clock"
        case .syncing: return "arrow.triangle.2.circlepath"
        case .synced: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .pending: return .yellow
        case .syncing: return .blue
        case .synced: return .green
        case .failed: return .red
        }
    }

    private var backgroundColor: Color {
        foregroundColor
    }
}
