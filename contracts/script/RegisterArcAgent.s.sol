// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface IIdentityRegistry {
    function register(string memory agentURI) external returns (uint256 agentId);
    function ownerOf(uint256 tokenId) external view returns (address);
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external;
}

/**
 * @title RegisterArcAgent — Register the RoadTrip Co-Pilot agent on Arc's ERC-8004 IdentityRegistry
 *
 * This gives the agent a verifiable on-chain identity on Arc with:
 * - NFT-based identity token
 * - Metadata URI pointing to agent capabilities
 * - Reputation tracking via Arc's ReputationRegistry
 *
 * Usage:
 *   AGENT_METADATA_URI="https://raw.githubusercontent.com/.../agent-metadata.json" \
 *   forge script script/RegisterArcAgent.s.sol:RegisterArcAgent \
 *     --rpc-url arc_testnet \
 *     --private-key $DEPLOYER_KEY \
 *     --broadcast \
 *     -vvvv
 */
contract RegisterArcAgent is Script {
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        string memory metadataURI = vm.envOr(
            "AGENT_METADATA_URI",
            string("https://roadtrip-copilot.vercel.app/agent-metadata.json")
        );

        IIdentityRegistry registry = IIdentityRegistry(IDENTITY_REGISTRY);

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        uint256 agentId = registry.register(metadataURI);

        vm.stopBroadcast();

        console.log("=== Agent Registered on Arc ERC-8004 ===");
        console.log("Agent ID:", agentId);
        console.log("Registry:", IDENTITY_REGISTRY);
        console.log("Owner:", msg.sender);
        console.log("Metadata URI:", metadataURI);
        console.log("");
        console.log("View on ArcScan: https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/", agentId);
    }
}
