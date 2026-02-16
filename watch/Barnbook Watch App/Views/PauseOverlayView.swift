import SwiftUI

struct PauseOverlayView: View {
    let isPaused: Bool
    var onPause: () -> Void
    var onResume: () -> Void
    var onEnd: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            if isPaused {
                Button {
                    onResume()
                } label: {
                    Label("Resume", systemImage: "play.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
            } else {
                Button {
                    onPause()
                } label: {
                    Label("Pause", systemImage: "pause.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)
            }

            Button(role: .destructive) {
                onEnd()
            } label: {
                Label("End Ride", systemImage: "stop.fill")
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
        }
        .padding()
    }
}
