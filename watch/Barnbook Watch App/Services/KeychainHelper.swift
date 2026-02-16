import Foundation
import Security

enum KeychainHelper {
    private static let service = "com.barnbook.watch"

    static func save(_ data: Data, for key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    static func load(for key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    static func delete(for key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }

    static func saveCredentials(_ credentials: Credentials) throws {
        let data = try JSONEncoder().encode(credentials)
        try save(data, for: "credentials")
    }

    static func loadCredentials() -> Credentials? {
        guard let data = load(for: "credentials") else { return nil }
        return try? JSONDecoder().decode(Credentials.self, from: data)
    }

    static func deleteCredentials() {
        delete(for: "credentials")
    }
}

enum KeychainError: Error {
    case saveFailed(OSStatus)
}
