// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentNFT} from "../src/AgentNFT.sol";
import {AgentReputation} from "../src/AgentReputation.sol";
import {TripRegistry} from "../src/TripRegistry.sol";

/**
 * @title Deploy0G — Deploy agent contracts to 0G Galileo testnet
 *
 * Usage:
 *   forge script script/Deploy0G.s.sol:Deploy0G \
 *     --rpc-url og_testnet \
 *     --private-key $AGENT_PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 *
 * After deployment, verify:
 *   forge verify-contract <ADDRESS> src/AgentNFT.sol:AgentNFT \
 *     --chain 16602 \
 *     --verifier-url https://chainscan-galileo.0g.ai/open/api
 */
contract Deploy0G is Script {
    function run() external {
        vm.startBroadcast();

        AgentNFT agentNFT = new AgentNFT();
        console.log("AgentNFT deployed at:", address(agentNFT));

        AgentReputation reputation = new AgentReputation();
        console.log("AgentReputation deployed at:", address(reputation));

        TripRegistry registry = new TripRegistry();
        console.log("TripRegistry deployed at:", address(registry));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("Network: 0G Galileo Testnet (Chain ID: 16602)");
        console.log("AgentNFT:        ", address(agentNFT));
        console.log("AgentReputation: ", address(reputation));
        console.log("TripRegistry:    ", address(registry));
    }
}
