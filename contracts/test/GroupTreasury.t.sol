// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {GroupTreasury} from "../src/GroupTreasury.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract GroupTreasuryTest is Test {
    GroupTreasury treasury;
    MockUSDC usdc;

    address organizer = makeAddr("organizer");
    address agent = makeAddr("agent");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address restaurant = makeAddr("restaurant");

    uint256 constant SPEND_LIMIT = 100e6;  // $100 USDC
    uint256 constant DEPOSIT_AMOUNT = 200e6; // $200 USDC each

    function setUp() public {
        treasury = new GroupTreasury();
        usdc = new MockUSDC();

        // Mint USDC to members
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        usdc.mint(carol, 1000e6);
    }

    function _createTrip() internal returns (uint256) {
        vm.prank(organizer);
        return treasury.createTrip(address(usdc), agent, SPEND_LIMIT);
    }

    function _depositAs(address member, uint256 tripId, uint256 amount) internal {
        vm.startPrank(member);
        usdc.approve(address(treasury), amount);
        treasury.deposit(tripId, amount);
        vm.stopPrank();
    }

    // --- Creation Tests ---

    function test_createTrip() public {
        uint256 tripId = _createTrip();
        GroupTreasury.Trip memory trip = treasury.getTrip(tripId);

        assertEq(trip.organizer, organizer);
        assertEq(trip.agent, agent);
        assertEq(trip.usdc, address(usdc));
        assertEq(trip.spendLimit, SPEND_LIMIT);
        assertEq(uint(trip.status), uint(GroupTreasury.TripStatus.Active));
    }

    function test_createTrip_incrementsId() public {
        uint256 id1 = _createTrip();
        uint256 id2 = _createTrip();
        assertEq(id2, id1 + 1);
    }

    // --- Deposit Tests ---

    function test_deposit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        assertEq(treasury.getMemberDeposit(tripId, alice), DEPOSIT_AMOUNT);
        assertEq(treasury.getBalance(tripId), DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(treasury)), DEPOSIT_AMOUNT);
    }

    function test_deposit_multipleMembers() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);
        _depositAs(bob, tripId, DEPOSIT_AMOUNT);
        _depositAs(carol, tripId, DEPOSIT_AMOUNT);

        assertEq(treasury.getBalance(tripId), 600e6);
        assertEq(treasury.getMembers(tripId).length, 3);
    }

    function test_deposit_additionalDeposit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 100e6);
        _depositAs(alice, tripId, 100e6);

        assertEq(treasury.getMemberDeposit(tripId, alice), 200e6);
        // Member count should still be 1
        assertEq(treasury.getMembers(tripId).length, 1);
    }

    function test_deposit_revertZero() public {
        uint256 tripId = _createTrip();
        vm.startPrank(alice);
        usdc.approve(address(treasury), 0);
        vm.expectRevert("Zero amount");
        treasury.deposit(tripId, 0);
        vm.stopPrank();
    }

    // --- Spend Tests ---

    function test_spend() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(agent);
        treasury.spend(tripId, restaurant, 38_500000, "food", "3x pulled pork combos");

        assertEq(usdc.balanceOf(restaurant), 38_500000);
        assertEq(treasury.getBalance(tripId), DEPOSIT_AMOUNT - 38_500000);

        GroupTreasury.Spend[] memory history = treasury.getSpends(tripId);
        assertEq(history.length, 1);
        assertEq(history[0].amount, 38_500000);
        assertEq(history[0].category, "food");
    }

    function test_spend_revertNotAgent() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vm.expectRevert("Not authorized agent");
        treasury.spend(tripId, restaurant, 50e6, "food", "dinner");
    }

    function test_spend_revertExceedsLimit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(agent);
        vm.expectRevert("Exceeds spend limit");
        treasury.spend(tripId, restaurant, 150e6, "lodging", "hotel");
    }

    function test_spend_revertInsufficientFunds() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 50e6);

        vm.prank(agent);
        vm.expectRevert("Insufficient funds");
        treasury.spend(tripId, restaurant, 80e6, "food", "dinner");
    }

    // --- Settlement Tests ---

    function test_settle_returnsProportionally() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);  // 1/3
        _depositAs(bob, tripId, 200e6);    // 1/3
        _depositAs(carol, tripId, 200e6);  // 1/3

        // Spend $300 of $600
        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 100e6, "food", "lunch");
        treasury.spend(tripId, restaurant, 100e6, "gas", "fuel");
        treasury.spend(tripId, restaurant, 100e6, "food", "dinner");
        vm.stopPrank();

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        treasury.settle(tripId);

        // Each should get $100 back (1/3 of $300 remaining)
        assertEq(usdc.balanceOf(alice) - aliceBefore, 100e6);
        assertEq(usdc.balanceOf(bob), 900e6); // 1000 - 200 deposit + 100 return
        assertEq(usdc.balanceOf(carol), 900e6);
    }

    function test_settle_revertAlreadySettled() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(alice);
        treasury.settle(tripId);

        vm.prank(alice);
        vm.expectRevert("Trip not active");
        treasury.settle(tripId);
    }

    function test_spend_revertAfterSettle() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(alice);
        treasury.settle(tripId);

        vm.prank(agent);
        vm.expectRevert("Trip not active");
        treasury.spend(tripId, restaurant, 50e6, "food", "late snack");
    }

    // --- Emergency Withdraw Tests ---

    function test_emergencyWithdraw() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);
        _depositAs(bob, tripId, 400e6);

        // Spend $100
        vm.prank(agent);
        treasury.spend(tripId, restaurant, 100e6, "food", "lunch");

        // Alice emergency withdraws her proportional share
        // Remaining: 600 - 100(spent) = 500. Alice's share: 500 * 200/600 = 166.666...
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        treasury.emergencyWithdraw(tripId);

        uint256 aliceGot = usdc.balanceOf(alice) - aliceBefore;
        assertApproxEqAbs(aliceGot, 166_666666, 1); // allow 1 wei rounding
    }
}
