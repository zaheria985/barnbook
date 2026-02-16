import Foundation

enum CalorieCalculator {
    // Rider calorie rates per minute (at 150 lb baseline)
    static let riderGaitRates: [Gait: Double] = [.walk: 3.5, .trot: 5.5, .canter: 8.0]
    // Horse Mcal rates per hour (at 1100 lb baseline)
    static let horseGaitRates: [Gait: Double] = [.walk: 1.5, .trot: 4.5, .canter: 9.0]

    static let riderWeightBaseline: Double = 150
    static let horseWeightBaseline: Double = 1100

    static func riderCalories(walkMin: Double, trotMin: Double, canterMin: Double, riderWeightLbs: Double = 150) -> Int {
        let factor = riderWeightLbs / riderWeightBaseline
        return Int((
            walkMin * riderGaitRates[.walk]! * factor +
            trotMin * riderGaitRates[.trot]! * factor +
            canterMin * riderGaitRates[.canter]! * factor
        ).rounded())
    }

    static func horseMcal(walkMin: Double, trotMin: Double, canterMin: Double, horseWeightLbs: Double = 1100) -> Double {
        let factor = horseWeightLbs / horseWeightBaseline
        let mcal = (walkMin / 60) * horseGaitRates[.walk]! * factor +
                   (trotMin / 60) * horseGaitRates[.trot]! * factor +
                   (canterMin / 60) * horseGaitRates[.canter]! * factor
        return (mcal * 100).rounded() / 100
    }
}
