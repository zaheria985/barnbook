import Foundation

struct Horse: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let weightLbs: Double?

    enum CodingKeys: String, CodingKey {
        case id, name
        case weightLbs = "weight_lbs"
    }
}
