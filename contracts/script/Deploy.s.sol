// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {GroupTreasury} from "../src/GroupTreasury.sol";

contract DeployTreasury is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        GroupTreasury treasury = new GroupTreasury();
        vm.stopBroadcast();
        console.log("GroupTreasury deployed at:", address(treasury));
    }
}
