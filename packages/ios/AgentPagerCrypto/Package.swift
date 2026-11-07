// swift-tools-version: 6.2
// The phone's side of the encrypted-part format (packages/contract/envelope.ts and parts.ts), for the app and its
// alert extension. `swift test` here (in `pnpm test`) runs it against packages/contract/vectors/envelope.json.
import PackageDescription

let package = Package(
    name: "AgentPagerCrypto",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [.library(name: "AgentPagerCrypto", targets: ["AgentPagerCrypto"])],
    targets: [
        .target(name: "AgentPagerCrypto"),
        .testTarget(name: "AgentPagerCryptoTests", dependencies: ["AgentPagerCrypto"]),
    ]
)
