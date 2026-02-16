import SwiftUI

struct PreRideView: View {
    let horse: Horse
    var onStart: () -> Void
    var onBack: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "figure.equestrian.sports")
                .font(.system(size: 40))
                .foregroundStyle(.green)

            Text(horse.name)
                .font(.headline)

            Button(action: onStart) {
                Label("Start Ride", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)

            Button("Back", action: onBack)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .navigationBarBackButtonHidden()
    }
}
