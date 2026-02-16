import Foundation

struct Credentials: Codable {
    var email: String
    var password: String
    var serverURL: String

    var isValid: Bool {
        !email.isEmpty && !password.isEmpty && !serverURL.isEmpty
    }

    var baseURL: URL? {
        URL(string: serverURL)
    }
}
