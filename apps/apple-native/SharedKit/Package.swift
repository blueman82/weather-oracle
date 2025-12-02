// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "SharedKit",
    platforms: [
        .iOS(.v17),
        .watchOS(.v10),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "SharedKit",
            targets: ["SharedKit"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "SharedKit",
            dependencies: [],
            path: "Sources/SharedKit"
        ),
        .testTarget(
            name: "SharedKitTests",
            dependencies: ["SharedKit"],
            path: "Tests/SharedKitTests"
        ),
    ]
)
