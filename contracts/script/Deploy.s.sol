// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {GroupTreasury} from "../src/GroupTreasury.sol";

contract DeployTreasury is Script {
    function run() external {
        vm.startBroadcast();
        GroupTreasury treasury = new GroupTreasury();
        vm.stopBroadcast();
        console.log("GroupTreasury deployed at:", address(treasury));
    }
}
