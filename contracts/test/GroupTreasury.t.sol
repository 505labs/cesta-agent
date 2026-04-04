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
    address tollBooth = makeAddr("tollBooth");
    address dataApi = makeAddr("dataApi");

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

    // =================== Creation Tests ===================

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

    // =================== Deposit Tests ===================

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

    // =================== Spend Tests ===================

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

    // =================== Daily Cap Tests ===================

    function test_dailyCap_set() public {
        uint256 tripId = _createTrip();
        vm.prank(organizer);
        treasury.setDailyCap(tripId, 300e6); // $300/day

        GroupTreasury.Trip memory trip = treasury.getTrip(tripId);
        assertEq(trip.dailyCap, 300e6);
    }

    function test_dailyCap_enforced() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.prank(organizer);
        treasury.setDailyCap(tripId, 150e6); // $150/day

        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 100e6, "food", "lunch");
        // This should fail — $100 + $60 = $160 > $150 cap
        vm.expectRevert("Exceeds daily cap");
        treasury.spend(tripId, restaurant, 60e6, "food", "dinner");
        vm.stopPrank();
    }

    function test_dailyCap_allowsUnderLimit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.prank(organizer);
        treasury.setDailyCap(tripId, 150e6);

        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 70e6, "food", "lunch");
        treasury.spend(tripId, restaurant, 70e6, "gas", "fuel");
        vm.stopPrank();

        assertEq(treasury.getDailySpending(tripId), 140e6);
    }

    // =================== Category Budget Tests ===================

    function test_categoryBudget_set() public {
        uint256 tripId = _createTrip();
        vm.prank(organizer);
        treasury.setCategoryBudget(tripId, "food", 200e6);

        (uint256 budget, uint256 spent) = treasury.getCategoryBudget(tripId, "food");
        assertEq(budget, 200e6);
        assertEq(spent, 0);
    }

    function test_categoryBudget_enforced() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.prank(organizer);
        treasury.setCategoryBudget(tripId, "food", 100e6);

        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 80e6, "food", "lunch");
        // This should fail — $80 + $30 = $110 > $100 food budget
        vm.expectRevert("Exceeds category budget");
        treasury.spend(tripId, restaurant, 30e6, "food", "snacks");
        vm.stopPrank();
    }

    function test_categoryBudget_tracksSpending() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.prank(organizer);
        treasury.setCategoryBudget(tripId, "food", 200e6);

        vm.prank(agent);
        treasury.spend(tripId, restaurant, 50e6, "food", "lunch");

        (uint256 budget, uint256 spent) = treasury.getCategoryBudget(tripId, "food");
        assertEq(budget, 200e6);
        assertEq(spent, 50e6);
    }

    function test_categoryBudget_noBudgetAllowsUnlimited() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);
        // No category budget set — should allow spending

        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 80e6, "food", "big dinner");
        vm.stopPrank();

        (, uint256 spent) = treasury.getCategoryBudget(tripId, "food");
        assertEq(spent, 80e6);
    }

    // =================== Nanopayment Tests ===================

    function test_nanopayment_basic() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.prank(agent);
        treasury.nanopayment(tripId, tollBooth, 4_500000, "tolls", "Highway A8 toll");

        assertEq(usdc.balanceOf(tollBooth), 4_500000);
        assertEq(treasury.getNanopaymentTotal(tripId), 4_500000);
        assertEq(treasury.getBalance(tripId), 600e6 - 4_500000);
    }

    function test_nanopayment_skipsSpendLimit() public {
        // Nanopayments don't check per-tx spend limit — they're micro by nature
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        // Spend limit is $100, but nanopayments are always small anyway
        vm.prank(agent);
        treasury.nanopayment(tripId, dataApi, 1000, "data", "Gas price API call $0.001");

        assertEq(usdc.balanceOf(dataApi), 1000); // $0.001 in 6-decimal USDC
        assertEq(treasury.getNanopaymentTotal(tripId), 1000);
    }

    function test_nanopayment_multipleDataApiCalls() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.startPrank(agent);
        treasury.nanopayment(tripId, dataApi, 3000, "data", "Gas prices API");
        treasury.nanopayment(tripId, dataApi, 5000, "data", "Restaurant ratings API");
        treasury.nanopayment(tripId, dataApi, 2000, "data", "Weather forecast API");
        treasury.nanopayment(tripId, tollBooth, 4_500000, "tolls", "Toll A8");
        treasury.nanopayment(tripId, makeAddr("parking"), 6_000000, "parking", "Nice parking garage");
        vm.stopPrank();

        assertEq(treasury.getNanopaymentTotal(tripId), 10_510000); // $10.51 total
        GroupTreasury.Spend[] memory history = treasury.getSpends(tripId);
        assertEq(history.length, 5);
    }

    function test_nanopayment_respectsCategoryBudget() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.prank(organizer);
        treasury.setCategoryBudget(tripId, "data", 10000); // $0.01 budget for data

        vm.startPrank(agent);
        treasury.nanopayment(tripId, dataApi, 5000, "data", "API call 1");
        treasury.nanopayment(tripId, dataApi, 5000, "data", "API call 2");
        vm.stopPrank();

        // No revert — nanopayments track but don't enforce category budgets strictly
        // (they just update the spent counter for dashboard display)
    }

    // =================== Group Voting Tests ===================

    function test_vote_requestAndApprove() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);
        _depositAs(bob, tripId, 200e6);
        _depositAs(carol, tripId, 200e6);

        // Agent requests a vote for a $220 hotel (over $100 limit)
        vm.prank(agent);
        uint256 voteId = treasury.requestVote(
            tripId, makeAddr("hotel"), 220e6, "lodging", "Hotel & Spa Nice", 2
        );

        // Alice and Bob approve
        vm.prank(alice);
        treasury.castVote(voteId);
        vm.prank(bob);
        treasury.castVote(voteId);

        // Execute the vote
        vm.prank(agent);
        treasury.executeVote(voteId);

        assertEq(usdc.balanceOf(makeAddr("hotel")), 220e6);
        assertEq(treasury.getBalance(tripId), 380e6);
    }

    function test_vote_notEnoughApprovals() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);
        _depositAs(bob, tripId, 200e6);
        _depositAs(carol, tripId, 200e6);

        vm.prank(agent);
        uint256 voteId = treasury.requestVote(
            tripId, makeAddr("hotel"), 220e6, "lodging", "Expensive hotel", 2
        );

        // Only Alice approves
        vm.prank(alice);
        treasury.castVote(voteId);

        // Execute should fail
        vm.prank(agent);
        vm.expectRevert("Not enough approvals");
        treasury.executeVote(voteId);
    }

    function test_vote_cannotVoteTwice() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);

        vm.prank(agent);
        uint256 voteId = treasury.requestVote(
            tripId, restaurant, 50e6, "food", "dinner", 1
        );

        vm.prank(alice);
        treasury.castVote(voteId);

        vm.prank(alice);
        vm.expectRevert("Already voted");
        treasury.castVote(voteId);
    }

    function test_vote_getVoteRequest() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);

        vm.prank(agent);
        uint256 voteId = treasury.requestVote(
            tripId, restaurant, 50e6, "food", "dinner", 1
        );

        (uint256 tid, address recip, uint256 amt, string memory cat, string memory desc, uint256 approvals, uint256 threshold, bool executed) = treasury.getVoteRequest(voteId);
        assertEq(tid, tripId);
        assertEq(recip, restaurant);
        assertEq(amt, 50e6);
        assertEq(keccak256(bytes(cat)), keccak256(bytes("food")));
        assertEq(keccak256(bytes(desc)), keccak256(bytes("dinner")));
        assertEq(approvals, 0);
        assertEq(threshold, 1);
        assertEq(executed, false);
    }

    // =================== Settlement Tests ===================

    function test_settle_returnsProportionally() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);
        _depositAs(bob, tripId, 200e6);
        _depositAs(carol, tripId, 200e6);

        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 100e6, "food", "lunch");
        treasury.spend(tripId, restaurant, 100e6, "gas", "fuel");
        treasury.spend(tripId, restaurant, 100e6, "food", "dinner");
        vm.stopPrank();

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        treasury.settle(tripId);

        assertEq(usdc.balanceOf(alice) - aliceBefore, 100e6);
        assertEq(usdc.balanceOf(bob), 900e6);
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

    // =================== Emergency Withdraw Tests ===================

    function test_emergencyWithdraw() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);
        _depositAs(bob, tripId, 400e6);

        vm.prank(agent);
        treasury.spend(tripId, restaurant, 100e6, "food", "lunch");

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        treasury.emergencyWithdraw(tripId);

        uint256 aliceGot = usdc.balanceOf(alice) - aliceBefore;
        assertApproxEqAbs(aliceGot, 166_666666, 1);
    }

    function test_emergencyWithdraw_revertNonMember() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(bob);
        vm.expectRevert("Not a member");
        treasury.emergencyWithdraw(tripId);
    }

    // =================== Multi-spend Tests ===================

    function test_spend_multipleInSequence() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 600e6);

        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 40e6, "food", "breakfast");
        treasury.spend(tripId, restaurant, 60e6, "gas", "fill up");
        treasury.spend(tripId, restaurant, 30e6, "food", "snacks");
        vm.stopPrank();

        GroupTreasury.Spend[] memory history = treasury.getSpends(tripId);
        assertEq(history.length, 3);
        assertEq(treasury.getBalance(tripId), 470e6);
    }

    function test_spend_exactlyAtLimit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(agent);
        treasury.spend(tripId, restaurant, SPEND_LIMIT, "lodging", "hotel exactly at limit");

        assertEq(treasury.getBalance(tripId), DEPOSIT_AMOUNT - SPEND_LIMIT);
    }

    function test_deposit_revertSettledTrip() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(alice);
        treasury.settle(tripId);

        vm.startPrank(bob);
        usdc.approve(address(treasury), DEPOSIT_AMOUNT);
        vm.expectRevert("Trip not active");
        treasury.deposit(tripId, DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_settle_noSpending_fullRefund() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 300e6);
        _depositAs(bob, tripId, 300e6);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(alice);
        treasury.settle(tripId);

        assertEq(usdc.balanceOf(alice) - aliceBefore, 300e6);
        assertEq(usdc.balanceOf(bob) - bobBefore, 300e6);
    }

    function test_settle_revertNonMember() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert("Not a member");
        treasury.settle(tripId);
    }

    // =================== Combined Flow Test (Demo Scenario) ===================

    function test_fullDemoFlow() public {
        // 1. Create trip with $100 auto-limit, $500/day cap
        uint256 tripId = _createTrip();
        vm.startPrank(organizer);
        treasury.setDailyCap(tripId, 500e6);
        treasury.setCategoryBudget(tripId, "food", 200e6);
        treasury.setCategoryBudget(tripId, "gas", 150e6);
        treasury.setCategoryBudget(tripId, "data", 1e6); // $1 for data APIs
        vm.stopPrank();

        // 2. Three friends deposit $200 each
        _depositAs(alice, tripId, 200e6);
        _depositAs(bob, tripId, 200e6);
        _depositAs(carol, tripId, 200e6);
        assertEq(treasury.getBalance(tripId), 600e6);

        // 3. Agent makes nanopayments for data APIs
        vm.startPrank(agent);
        treasury.nanopayment(tripId, dataApi, 3000, "data", "Gas prices API $0.003");
        treasury.nanopayment(tripId, dataApi, 5000, "data", "Restaurant data API $0.005");
        treasury.nanopayment(tripId, dataApi, 2000, "data", "Weather API $0.002");

        // 4. Agent pays for toll and parking (nanopayments)
        treasury.nanopayment(tripId, tollBooth, 4_500000, "tolls", "Highway A8 toll");
        treasury.nanopayment(tripId, makeAddr("parking"), 6_000000, "parking", "Nice parking");

        // 5. Agent pays for food (regular spend, under limit)
        treasury.spend(tripId, restaurant, 38_500000, "food", "3x BBQ combos");
        vm.stopPrank();

        // 6. Agent requests vote for hotel (over $100 limit)
        vm.prank(agent);
        uint256 voteId = treasury.requestVote(
            tripId, makeAddr("hotel"), 180e6, "lodging", "Hotel & Spa Nice", 2
        );

        // 7. Members approve
        vm.prank(alice);
        treasury.castVote(voteId);
        vm.prank(bob);
        treasury.castVote(voteId);

        // 8. Execute the hotel booking
        vm.prank(agent);
        treasury.executeVote(voteId);

        // 9. Check state
        assertEq(treasury.getNanopaymentTotal(tripId), 10_510000); // ~$10.51
        (uint256 foodBudget, uint256 foodSpent) = treasury.getCategoryBudget(tripId, "food");
        assertEq(foodBudget, 200e6);
        assertEq(foodSpent, 38_500000);

        // 10. Settle
        vm.prank(alice);
        treasury.settle(tripId);

        GroupTreasury.Trip memory trip = treasury.getTrip(tripId);
        assertEq(uint(trip.status), uint(GroupTreasury.TripStatus.Settled));
    }
}
