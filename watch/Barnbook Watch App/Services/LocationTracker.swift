import Foundation
import CoreLocation

@Observable
final class LocationTracker: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var lastLocation: CLLocation?

    private(set) var totalDistanceMiles: Double = 0
    private(set) var isTracking = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.activityType = .fitness
        manager.allowsBackgroundLocationUpdates = true
    }

    func start() {
        totalDistanceMiles = 0
        lastLocation = nil
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
        isTracking = true
    }

    func stop() {
        manager.stopUpdatingLocation()
        isTracking = false
        lastLocation = nil
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations {
            guard location.horizontalAccuracy >= 0, location.horizontalAccuracy < 30 else { continue }

            if let last = lastLocation {
                let distanceMeters = location.distance(from: last)
                // Filter out GPS jumps (>50m between updates is likely noise)
                if distanceMeters < 50 {
                    totalDistanceMiles += distanceMeters / 1609.344
                }
            }
            lastLocation = location
        }
    }
}
