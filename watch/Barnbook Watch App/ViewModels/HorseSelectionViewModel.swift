import Foundation

@Observable
final class HorseSelectionViewModel {
    var horses: [Horse] = []
    var selectedHorse: Horse?
    var isLoading = false
    var errorMessage: String?

    func fetchHorses() async {
        isLoading = true
        errorMessage = nil

        do {
            horses = try await APIClient.shared.fetchHorses()
        } catch APIError.unauthorized {
            do {
                try await APIClient.shared.reAuthenticate()
                horses = try await APIClient.shared.fetchHorses()
            } catch {
                errorMessage = "Session expired. Please log in again."
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
