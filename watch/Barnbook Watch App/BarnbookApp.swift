import SwiftUI
import WatchKit

@main
struct BarnbookApp: App {
    @State private var authViewModel = AuthViewModel()
    @State private var horseViewModel = HorseSelectionViewModel()
    @State private var recorder = SessionRecorder()

    @State private var navigationPath: [AppScreen] = []
    @State private var completedRide: RideSession?
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            if authViewModel.isAuthenticated {
                NavigationStack(path: $navigationPath) {
                    HorsePickerView(
                        viewModel: horseViewModel,
                        onSelect: { horse in
                            recorder.selectHorse(horse)
                            navigationPath.append(.preRide(horse))
                        },
                        onSettings: {
                            navigationPath.append(.settings)
                        }
                    )
                    .navigationDestination(for: AppScreen.self) { screen in
                        switch screen {
                        case .preRide(let horse):
                            PreRideView(
                                horse: horse,
                                onStart: {
                                    navigationPath.append(.recording)
                                },
                                onBack: {
                                    navigationPath.removeLast()
                                }
                            )
                        case .recording:
                            RecordingView(
                                viewModel: RecordingViewModel(recorder: recorder),
                                onEnd: { ride in
                                    completedRide = ride
                                    navigationPath = [.summary]
                                }
                            )
                        case .summary:
                            if let ride = completedRide {
                                SummaryView(
                                    viewModel: SummaryViewModel(ride: ride),
                                    onDone: {
                                        completedRide = nil
                                        recorder.reset()
                                        navigationPath = []
                                    }
                                )
                            }
                        case .settings:
                            SettingsView(authViewModel: authViewModel)
                        }
                    }
                }
                .onChange(of: scenePhase) {
                    if scenePhase == .active {
                        Task { await OfflineQueue.shared.syncAll() }
                    }
                }
            } else {
                LoginView(viewModel: authViewModel)
            }
        }
        .backgroundTask(.appRefresh("sync-rides")) {
            await OfflineQueue.shared.syncAll()
            await scheduleNextRefresh()
        }
    }

    private func scheduleNextRefresh() async {
        WKApplication.shared().scheduleBackgroundRefresh(
            withPreferredDate: Date().addingTimeInterval(15 * 60),
            userInfo: nil
        ) { _ in }
    }
}

enum AppScreen: Hashable {
    case preRide(Horse)
    case recording
    case summary
    case settings
}
