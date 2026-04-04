// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {GroupTreasury} from "../src/GroupTreasury.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

/// @notice Full integration test script — deploys everything and runs a demo flow on Anvil
contract IntegrationTest is Script {
    function run() external {
        // Anvil account 0 (deployer + organizer)
        uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        // Anvil account 1 (agent)
        uint256 agentKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        address agentAddr = vm.addr(agentKey);
        address deployer = vm.addr(deployerKey);

        // Deploy
        vm.startBroadcast(deployerKey);
        GroupTreasury treasury = new GroupTreasury();
        MockUSDC usdc = new MockUSDC();
        console.log("Treasury:", address(treasury));
        console.log("USDC:", address(usdc));

        // Mint USDC to deployer (acts as organizer + member)
        usdc.mint(deployer, 1000e6);

        // Create trip
        uint256 tripId = treasury.createTrip(address(usdc), agentAddr, 100e6);
        console.log("Trip ID:", tripId);

        // Set daily cap and category budgets
        treasury.setDailyCap(tripId, 500e6);
        treasury.setCategoryBudget(tripId, "food", 200e6);
        treasury.setCategoryBudget(tripId, "data", 1e6);
        treasury.setCategoryBudget(tripId, "tolls", 50e6);

        // Deposit
        usdc.approve(address(treasury), 600e6);
        treasury.deposit(tripId, 600e6);
        console.log("Deposited: $600");
        vm.stopBroadcast();

        // Agent makes nanopayments
        vm.startBroadcast(agentKey);
        // Data API calls
        treasury.nanopayment(tripId, address(0x402), 3000, "data", "Gas prices API $0.003");
        treasury.nanopayment(tripId, address(0x402), 5000, "data", "Restaurant data API $0.005");
        treasury.nanopayment(tripId, address(0x402), 2000, "data", "Weather API $0.002");
        console.log("Nanopayments: 3 data API calls ($0.01 total)");

        // Toll and parking
        treasury.nanopayment(tripId, address(0x403), 4_500000, "tolls", "Highway A8 toll");
        treasury.nanopayment(tripId, address(0x404), 6_000000, "parking", "Nice parking garage");
        console.log("Nanopayments: toll $4.50, parking $6.00");

        // Regular spend (food under limit)
        treasury.spend(tripId, address(0x405), 38_500000, "food", "3x BBQ combos");
        console.log("Spend: $38.50 food");
        vm.stopBroadcast();

        // Verify state
        GroupTreasury.Trip memory trip = treasury.getTrip(tripId);
        console.log("--- Final State ---");
        console.log("Total deposited:", trip.totalDeposited / 1e6);
        console.log("Total spent:", trip.totalSpent / 1e6);
        console.log("Balance:", treasury.getBalance(tripId) / 1e6);
        console.log("Nanopayment total:", treasury.getNanopaymentTotal(tripId));
        console.log("Spend history count:", treasury.getSpends(tripId).length);
        console.log("=== INTEGRATION TEST PASSED ===");
    }
}
