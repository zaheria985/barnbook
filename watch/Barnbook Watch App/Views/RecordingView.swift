import SwiftUI

struct RecordingView: View {
    @Bindable var viewModel: RecordingViewModel
    var onEnd: (RideSession) -> Void

    @State private var showPauseOverlay = false

    var body: some View {
        VStack(spacing: 8) {
            GaitIndicatorView(gait: viewModel.currentGait)
                .frame(height: 8)

            Text(viewModel.timerText)
                .font(.system(.title, design: .monospaced, weight: .bold))
                .foregroundStyle(gaitColor)

            HStack(spacing: 16) {
                VStack {
                    Text(viewModel.distanceText)
                        .font(.caption.monospaced())
                    Text("Distance")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }

                VStack {
                    Text(viewModel.heartRateText)
                        .font(.caption.monospaced())
                    Text("Heart Rate")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }

            Text(viewModel.currentGait.rawValue.capitalized)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(gaitColor.opacity(0.3))
                .clipShape(Capsule())
        }
        .navigationBarBackButtonHidden()
        .onTapGesture {
            showPauseOverlay = true
        }
        .sheet(isPresented: $showPauseOverlay) {
            PauseOverlayView(
                isPaused: viewModel.isPaused,
                onPause: { viewModel.pauseRide() },
                onResume: { viewModel.resumeRide() },
                onEnd: {
                    showPauseOverlay = false
                    Task {
                        if let ride = await viewModel.endRide() {
                            onEnd(ride)
                        }
                    }
                }
            )
        }
        .task {
            await viewModel.startRide()
        }
    }

    private var gaitColor: Color {
        switch viewModel.currentGait {
        case .walk: return .green
        case .trot: return .yellow
        case .canter: return .pink
        }
    }
}
