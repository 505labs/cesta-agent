// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentNFT} from "../src/AgentNFT.sol";

/**
 * @title MintAgent — Mint the RoadTrip Co-Pilot agent as an iNFT
 *
 * Usage:
 *   AGENT_NFT_ADDRESS=0x... \
 *   METADATA_URI="0g://..." \
 *   DESCRIPTION_URI="0g://..." \
 *   forge script script/MintAgent.s.sol:MintAgent \
 *     --rpc-url og_testnet \
 *     --private-key $AGENT_PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 */
contract MintAgent is Script {
    function run() external {
        address nftAddress = vm.envAddress("AGENT_NFT_ADDRESS");
        string memory metadataURI = vm.envOr("METADATA_URI", string("0g://placeholder-metadata"));
        string memory descriptionURI = vm.envOr("DESCRIPTION_URI", string("0g://placeholder-description"));

        AgentNFT nft = AgentNFT(nftAddress);

        vm.startBroadcast();

        uint256 tokenId = nft.mintAgent(
            "RoadTrip Co-Pilot",
            metadataURI,
            descriptionURI
        );

        vm.stopBroadcast();

        console.log("=== Agent iNFT Minted ===");
        console.log("Token ID:", tokenId);
        console.log("Contract:", nftAddress);
        console.log("Owner:", msg.sender);
        console.log("Metadata URI:", metadataURI);
    }
}
