import SwiftUI

struct SummaryView: View {
    @Bindable var viewModel: SummaryViewModel
    var onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("Ride Complete")
                    .font(.headline)
                    .foregroundStyle(.green)

                VStack(spacing: 6) {
                    statRow("Total", viewModel.totalMinutes)
                    statRow("Walk", viewModel.walkText, color: .green)
                    statRow("Trot", viewModel.trotText, color: .yellow)
                    statRow("Canter", viewModel.canterText, color: .pink)

                    Divider()

                    statRow("Distance", viewModel.distanceText)
                    statRow("Heart Rate", viewModel.heartRateText)
                    statRow("Calories", viewModel.caloriesText)
                }

                SyncStatusBadge(status: viewModel.syncStatus)

                Button("Done", action: onDone)
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
            }
            .padding()
        }
        .navigationBarBackButtonHidden()
        .task {
            await viewModel.syncRide()
        }
    }

    private func statRow(_ label: String, _ value: String, color: Color = .primary) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.caption.monospaced())
                .foregroundStyle(color)
        }
    }
}
