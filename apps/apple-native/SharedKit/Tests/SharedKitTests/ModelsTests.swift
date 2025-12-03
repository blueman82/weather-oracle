@testable import SharedKit
import XCTest

// MARK: - Location Tests

final class LocationTests: XCTestCase {
    // MARK: - Latitude Tests

    func testLatitudeValidRange() throws {
        XCTAssertNotNil(Latitude(rawValue: 0))
        XCTAssertNotNil(Latitude(rawValue: 45.5))
        XCTAssertNotNil(Latitude(rawValue: -45.5))
        XCTAssertNotNil(Latitude(rawValue: 90))
        XCTAssertNotNil(Latitude(rawValue: -90))
    }

    func testLatitudeInvalidRange() throws {
        XCTAssertNil(Latitude(rawValue: 90.1))
        XCTAssertNil(Latitude(rawValue: -90.1))
        XCTAssertNil(Latitude(rawValue: 180))
        XCTAssertNil(Latitude(rawValue: -180))
    }

    func testLatitudeValidated() throws {
        let lat = try Latitude.validated(45.0)
        XCTAssertEqual(lat.rawValue, 45.0)
    }

    func testLatitudeValidatedThrows() throws {
        XCTAssertThrowsError(try Latitude.validated(91.0)) { error in
            guard case LocationError.invalidLatitude(let value) = error else {
                XCTFail("Expected invalidLatitude error")
                return
            }
            XCTAssertEqual(value, 91.0)
        }
    }

    // MARK: - Longitude Tests

    func testLongitudeValidRange() throws {
        XCTAssertNotNil(Longitude(rawValue: 0))
        XCTAssertNotNil(Longitude(rawValue: 90))
        XCTAssertNotNil(Longitude(rawValue: -90))
        XCTAssertNotNil(Longitude(rawValue: 180))
        XCTAssertNotNil(Longitude(rawValue: -180))
    }

    func testLongitudeInvalidRange() throws {
        XCTAssertNil(Longitude(rawValue: 180.1))
        XCTAssertNil(Longitude(rawValue: -180.1))
        XCTAssertNil(Longitude(rawValue: 360))
    }

    func testLongitudeValidatedThrows() throws {
        XCTAssertThrowsError(try Longitude.validated(181.0)) { error in
            guard case LocationError.invalidLongitude(let value) = error else {
                XCTFail("Expected invalidLongitude error")
                return
            }
            XCTAssertEqual(value, 181.0)
        }
    }

    // MARK: - Coordinates Tests

    func testCoordinatesValidated() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        XCTAssertEqual(coords.latitude.rawValue, 40.7128, accuracy: 0.0001)
        XCTAssertEqual(coords.longitude.rawValue, -74.0060, accuracy: 0.0001)
    }

    func testCoordinatesApproximatelyEqual() throws {
        let coords1 = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let coords2 = try Coordinates.validated(lat: 40.7129, lon: -74.0061)
        XCTAssertTrue(coords1.isApproximatelyEqual(to: coords2, toleranceDegrees: 0.001))
        XCTAssertFalse(coords1.isApproximatelyEqual(to: coords2, toleranceDegrees: 0.00001))
    }

    // MARK: - Elevation Tests

    func testElevation() throws {
        let elevation = Elevation.meters(100.5)
        XCTAssertEqual(elevation.rawValue, 100.5)
    }

    // MARK: - TimezoneId Tests

    func testTimezoneId() throws {
        let tz: TimezoneId = "America/New_York"
        XCTAssertEqual(tz.rawValue, "America/New_York")
        XCTAssertNotNil(tz.timeZone)
        XCTAssertTrue(tz.isValid)
    }

    func testTimezoneIdInvalid() throws {
        let tz = TimezoneId(rawValue: "Invalid/Timezone")
        XCTAssertNil(tz.timeZone)
        XCTAssertFalse(tz.isValid)
    }

    // MARK: - LocationEntity Tests

    func testLocationEntity() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let geocodingResult = GeocodingResult(
            name: "New York",
            coordinates: coords,
            country: "United States",
            countryCode: "US",
            region: "New York",
            timezone: "America/New_York"
        )
        let location = LocationEntity(query: "NYC", resolved: geocodingResult)

        XCTAssertEqual(location.name, "New York")
        XCTAssertEqual(location.query, "NYC")
        XCTAssertEqual(location.coordinates.latitude.rawValue, 40.7128, accuracy: 0.0001)
    }

    // MARK: - Codable Tests

    func testCoordinatesCodable() throws {
        let coords = try Coordinates.validated(lat: 40.7128, lon: -74.0060)
        let encoder = JSONEncoder()
        let data = try encoder.encode(coords)
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(Coordinates.self, from: data)
        XCTAssertEqual(coords, decoded)
    }
}

// MARK: - Forecast Series Tests

final class ForecastSeriesTests: XCTestCase {
    // MARK: - Temperature Tests

    func testCelsiusToFahrenheit() throws {
        let temp = Celsius(rawValue: 0)
        XCTAssertEqual(temp.fahrenheit, 32, accuracy: 0.01)

        let temp2 = Celsius(rawValue: 100)
        XCTAssertEqual(temp2.fahrenheit, 212, accuracy: 0.01)

        let temp3 = Celsius(rawValue: -40)
        XCTAssertEqual(temp3.fahrenheit, -40, accuracy: 0.01)
    }

    func testCelsiusFromFahrenheit() throws {
        let temp = Celsius.fromFahrenheit(32)
        XCTAssertEqual(temp.rawValue, 0, accuracy: 0.01)

        let temp2 = Celsius.fromFahrenheit(212)
        XCTAssertEqual(temp2.rawValue, 100, accuracy: 0.01)
    }

    // MARK: - Wind Tests

    func testMetersPerSecondConversions() throws {
        let speed = MetersPerSecond(rawValue: 10)!
        XCTAssertEqual(speed.kmPerHour, 36, accuracy: 0.01)
        XCTAssertEqual(speed.mph, 22.37, accuracy: 0.01)
    }

    func testWindDirectionNormalization() throws {
        let dir1 = WindDirection(rawValue: 0)
        XCTAssertEqual(dir1.rawValue, 0, accuracy: 0.01)

        let dir2 = WindDirection(rawValue: 360)
        XCTAssertEqual(dir2.rawValue, 0, accuracy: 0.01)

        let dir3 = WindDirection(rawValue: -90)
        XCTAssertEqual(dir3.rawValue, 270, accuracy: 0.01)

        let dir4 = WindDirection(rawValue: 450)
        XCTAssertEqual(dir4.rawValue, 90, accuracy: 0.01)
    }

    func testWindDirectionCardinal() throws {
        XCTAssertEqual(WindDirection(rawValue: 0).cardinal, "N")
        XCTAssertEqual(WindDirection(rawValue: 90).cardinal, "E")
        XCTAssertEqual(WindDirection(rawValue: 180).cardinal, "S")
        XCTAssertEqual(WindDirection(rawValue: 270).cardinal, "W")
        XCTAssertEqual(WindDirection(rawValue: 45).cardinal, "NE")
    }

    // MARK: - Validation Tests

    func testMillimetersValidation() throws {
        XCTAssertNotNil(Millimeters(rawValue: 0))
        XCTAssertNotNil(Millimeters(rawValue: 100))
        XCTAssertNil(Millimeters(rawValue: -1))
    }

    func testHumidityValidation() throws {
        XCTAssertNotNil(Humidity(rawValue: 0))
        XCTAssertNotNil(Humidity(rawValue: 50))
        XCTAssertNotNil(Humidity(rawValue: 100))
        XCTAssertNil(Humidity(rawValue: -1))
        XCTAssertNil(Humidity(rawValue: 101))
    }

    func testCloudCoverValidation() throws {
        XCTAssertNotNil(CloudCover(rawValue: 0))
        XCTAssertNotNil(CloudCover(rawValue: 100))
        XCTAssertNil(CloudCover(rawValue: -1))
        XCTAssertNil(CloudCover(rawValue: 101))
    }

    // MARK: - Clamped Values Tests

    func testClampedValues() throws {
        let mm = Millimeters.clamped(-5)
        XCTAssertEqual(mm.rawValue, 0)

        let humidity = Humidity.clamped(150)
        XCTAssertEqual(humidity.rawValue, 100)

        let cloudCover = CloudCover.clamped(-10)
        XCTAssertEqual(cloudCover.rawValue, 0)
    }

    // MARK: - Weather Code Tests

    func testWeatherCodeDescription() throws {
        XCTAssertEqual(WeatherCode.clearSky.description, "Clear sky")
        XCTAssertEqual(WeatherCode.thunderstorm.description, "Thunderstorm")
    }

    func testWeatherCodeSystemImage() throws {
        XCTAssertEqual(WeatherCode.clearSky.systemImageName, "sun.max.fill")
        XCTAssertEqual(WeatherCode.heavyRain.systemImageName, "cloud.heavyrain.fill")
        XCTAssertEqual(WeatherCode.thunderstorm.systemImageName, "cloud.bolt.rain.fill")
    }

    // MARK: - Model Name Tests

    func testModelNameProperties() throws {
        XCTAssertEqual(ModelName.ecmwf.displayName, "ECMWF IFS")
        XCTAssertEqual(ModelName.ecmwf.resolution, "9km")
        XCTAssertEqual(ModelName.ecmwf.updateFrequency, "6 hours")
        XCTAssertEqual(ModelName.gem.updateFrequency, "12 hours")
    }

    func testModelNameCases() throws {
        XCTAssertEqual(ModelName.allCases.count, 7)
    }

    // MARK: - Confidence Level Tests

    func testConfidenceLevelFromScore() throws {
        let high = ConfidenceLevel.from(score: 0.8)
        XCTAssertEqual(high?.level, .high)

        let medium = ConfidenceLevel.from(score: 0.5)
        XCTAssertEqual(medium?.level, .medium)

        let low = ConfidenceLevel.from(score: 0.2)
        XCTAssertEqual(low?.level, .low)

        let invalid = ConfidenceLevel.from(score: 1.5)
        XCTAssertNil(invalid)
    }

    // MARK: - UV Index Tests

    func testUVIndexCategory() throws {
        XCTAssertEqual(UVIndex(rawValue: 1)?.category, "Low")
        XCTAssertEqual(UVIndex(rawValue: 4)?.category, "Moderate")
        XCTAssertEqual(UVIndex(rawValue: 7)?.category, "High")
        XCTAssertEqual(UVIndex(rawValue: 9)?.category, "Very High")
        XCTAssertEqual(UVIndex(rawValue: 12)?.category, "Extreme")
    }

    // MARK: - Visibility Tests

    func testVisibilityKilometers() throws {
        let vis = Visibility(rawValue: 10000)!
        XCTAssertEqual(vis.kilometers, 10, accuracy: 0.01)
    }

    // MARK: - Visualization Token Tests

    func testVisualizationToken() throws {
        let token = VisualizationToken(
            name: "temperature",
            primaryColorHex: "#FF5733",
            secondaryColorHex: "#3357FF",
            gradientStops: [
                GradientStop(colorHex: "#FF5733", location: 0),
                GradientStop(colorHex: "#3357FF", location: 1),
            ],
            opacity: 0.8
        )
        XCTAssertEqual(token.name, "temperature")
        XCTAssertEqual(token.primaryColorHex, "#FF5733")
        XCTAssertEqual(token.gradientStops?.count, 2)
        XCTAssertEqual(token.opacity, 0.8)
    }

    // MARK: - Codable Tests

    func testWeatherMetricsCodable() throws {
        let metrics = WeatherMetrics(
            temperature: Celsius(rawValue: 20),
            feelsLike: Celsius(rawValue: 18),
            humidity: Humidity(rawValue: 65)!,
            pressure: Pressure(rawValue: 1013)!,
            windSpeed: MetersPerSecond(rawValue: 5)!,
            windDirection: WindDirection(rawValue: 180),
            precipitation: Millimeters(rawValue: 0)!,
            precipitationProbability: 0.1,
            cloudCover: CloudCover(rawValue: 25)!,
            visibility: Visibility(rawValue: 10000)!,
            uvIndex: UVIndex(rawValue: 5)!,
            weatherCode: .partlyCloudy
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(metrics)
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(WeatherMetrics.self, from: data)

        XCTAssertEqual(metrics.temperature.rawValue, decoded.temperature.rawValue)
        XCTAssertEqual(metrics.weatherCode, decoded.weatherCode)
    }

    func testModelNameCodable() throws {
        let model = ModelName.ecmwf
        let encoder = JSONEncoder()
        let data = try encoder.encode(model)
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ModelName.self, from: data)
        XCTAssertEqual(model, decoded)
    }
}
