import Foundation

@Observable
final class AuthViewModel {
    var email = ""
    var password = ""
    var serverURL = "https://"
    var isLoading = false
    var errorMessage: String?
    var isAuthenticated = false

    init() {
        if let creds = KeychainHelper.loadCredentials() {
            email = creds.email
            serverURL = creds.serverURL
            isAuthenticated = true
            Task { await configureClient(creds) }
        }
    }

    func login() async {
        guard !email.isEmpty, !password.isEmpty, !serverURL.isEmpty else {
            errorMessage = "All fields are required"
            return
        }

        guard let url = URL(string: serverURL) else {
            errorMessage = "Invalid server URL"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            await APIClient.shared.configure(baseURL: url)
            try await APIClient.shared.login(email: email, password: password)

            let creds = Credentials(email: email, password: password, serverURL: serverURL)
            try KeychainHelper.saveCredentials(creds)

            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func logout() {
        KeychainHelper.deleteCredentials()
        isAuthenticated = false
        password = ""
    }

    private func configureClient(_ creds: Credentials) async {
        guard let url = creds.baseURL else { return }
        await APIClient.shared.configure(baseURL: url)
        do {
            try await APIClient.shared.login(email: creds.email, password: creds.password)
        } catch {
            // Silent failure — user can manually re-login
        }
    }
}
