import XCTest
@testable import SharedKit

final class SharedKitTests: XCTestCase {
    func testTemperatureConversion() throws {
        let temp = Temperature(fahrenheit: 72)
        XCTAssertEqual(temp.fahrenheit, 72, accuracy: 0.01)
        XCTAssertEqual(temp.celsius, 22.22, accuracy: 0.01)
    }

    func testTemperatureFormatting() throws {
        let temp = Temperature(celsius: 25)
        XCTAssertEqual(temp.formatted(unit: .celsius), "25°C")
        XCTAssertEqual(temp.formatted(unit: .fahrenheit), "77°F")
    }

    func testWeatherConditionIcons() throws {
        XCTAssertEqual(WeatherCondition.sunny.systemImageName, "sun.max.fill")
        XCTAssertEqual(WeatherCondition.rainy.systemImageName, "cloud.rain.fill")
    }
}
