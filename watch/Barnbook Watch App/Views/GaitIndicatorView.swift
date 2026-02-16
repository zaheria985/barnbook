import SwiftUI

struct GaitIndicatorView: View {
    let gait: Gait

    var body: some View {
        GeometryReader { geo in
            RoundedRectangle(cornerRadius: 4)
                .fill(color)
                .frame(width: geo.size.width, height: geo.size.height)
                .animation(.easeInOut(duration: 0.5), value: gait)
        }
    }

    private var color: Color {
        switch gait {
        case .walk: return .green
        case .trot: return .yellow
        case .canter: return .pink
        }
    }
}
