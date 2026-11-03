// swift-tools-version:5.9
// S8B-06 CP2 (iOS) — the engine's decisions and the call coordinator as a package, so they are built and tested without
// the app: `swift test` on the macOS host (the AVFoundation / CallKit adapters compile out there) and
// `xcodebuild test -destination 'platform=iOS Simulator,…'` (everything compiles, the adapters included). The app links the
// same files through `QandeelVoiceCall.podspec`; the Expo module (`Expo/`) is the pod's only extra.
import PackageDescription

let package = Package(
  name: "QandeelVoiceCall",
  platforms: [.iOS("16.4"), .macOS(.v13)],
  products: [.library(name: "QandeelCallCore", targets: ["QandeelCallCore"])],
  targets: [
    .target(
      name: "COpus",
      path: "opus",
      exclude: ["COPYING", "AUTHORS", "VENDORED.md", "sources.txt"],
      publicHeadersPath: "include",
      cSettings: [
        .define("OPUS_BUILD"), .define("VAR_ARRAYS"), .define("HAVE_LRINTF"), .define("HAVE_LRINT"),
        .headerSearchPath("."), .headerSearchPath("celt"), .headerSearchPath("silk"), .headerSearchPath("silk/float"),
        .headerSearchPath("src"), .unsafeFlags(["-w"]),
      ]
    ),
    .target(name: "QandeelCallCore", dependencies: ["COpus"], path: "Core"),
    .testTarget(
      name: "QandeelCallCoreTests",
      dependencies: ["QandeelCallCore", "COpus"],
      path: "Tests",
      resources: [.copy("Fixtures")]
    ),
  ]
)
