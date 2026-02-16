import Foundation

actor APIClient {
    static let shared = APIClient()

    private var session: URLSession
    private var baseURL: URL?
    private var isAuthenticated = false

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpCookieStorage = .shared
        self.session = URLSession(configuration: config)
    }

    func configure(baseURL: URL) {
        self.baseURL = baseURL
        self.isAuthenticated = false
    }

    func login(email: String, password: String) async throws {
        guard let baseURL else { throw APIError.notConfigured }

        // Step 1: Get CSRF token
        let csrfURL = baseURL.appendingPathComponent("/api/auth/csrf")
        let (csrfData, _) = try await session.data(from: csrfURL)

        guard let csrfJSON = try? JSONSerialization.jsonObject(with: csrfData) as? [String: String],
              let csrfToken = csrfJSON["csrfToken"] else {
            throw APIError.csrfFailed
        }

        // Step 2: POST credentials (form-encoded, as NextAuth expects)
        let callbackURL = baseURL.appendingPathComponent("/api/auth/callback/credentials")
        var request = URLRequest(url: callbackURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = [
            "email": email,
            "password": password,
            "csrfToken": csrfToken,
            "json": "true"
        ]
        request.httpBody = body
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...399).contains(httpResponse.statusCode) else {
            throw APIError.loginFailed
        }

        isAuthenticated = true
    }

    func fetchHorses() async throws -> [Horse] {
        try await authenticatedGET("/api/horses")
    }

    func syncRide(_ rideSession: RideSession) async throws {
        guard let baseURL else { throw APIError.notConfigured }

        let url = baseURL.appendingPathComponent("/api/rides")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: rideSession.apiPayload)

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed
        }

        if httpResponse.statusCode == 401 {
            isAuthenticated = false
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed
        }
    }

    private func authenticatedGET<T: Decodable>(_ path: String) async throws -> T {
        guard let baseURL else { throw APIError.notConfigured }

        let url = baseURL.appendingPathComponent(path)
        let (data, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed
        }

        if httpResponse.statusCode == 401 {
            isAuthenticated = false
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed
        }

        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    }

    func reAuthenticate() async throws {
        guard let creds = KeychainHelper.loadCredentials(),
              let url = creds.baseURL else {
            throw APIError.notConfigured
        }
        configure(baseURL: url)
        try await login(email: creds.email, password: creds.password)
    }
}

enum APIError: Error, LocalizedError {
    case notConfigured
    case csrfFailed
    case loginFailed
    case unauthorized
    case requestFailed

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Server not configured"
        case .csrfFailed: return "Failed to get CSRF token"
        case .loginFailed: return "Invalid email or password"
        case .unauthorized: return "Session expired"
        case .requestFailed: return "Request failed"
        }
    }
}
