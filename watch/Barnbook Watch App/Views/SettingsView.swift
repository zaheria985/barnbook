import SwiftUI

struct SettingsView: View {
    @Bindable var authViewModel: AuthViewModel
    @State private var pendingCount = 0

    var body: some View {
        List {
            Section("Account") {
                HStack {
                    Text("Email")
                    Spacer()
                    Text(authViewModel.email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Text("Server")
                    Spacer()
                    Text(authViewModel.serverURL)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Button("Log Out", role: .destructive) {
                    authViewModel.logout()
                }
            }

            Section("Sync") {
                HStack {
                    Text("Pending Rides")
                    Spacer()
                    Text("\(pendingCount)")
                        .foregroundStyle(pendingCount > 0 ? .yellow : .secondary)
                }

                if pendingCount > 0 {
                    Button("Sync Now") {
                        Task { await OfflineQueue.shared.syncAll() }
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .task {
            pendingCount = await OfflineQueue.shared.pendingCount
        }
    }
}
