// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentReputation} from "../src/AgentReputation.sol";

contract AgentReputationTest is Test {
    AgentReputation reputation;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant AGENT_TOKEN_ID = 0;
    uint256 constant TRIP_ID = 42;

    function setUp() public {
        reputation = new AgentReputation();
    }

    // --- Rating ---

    function test_rateAgent() public {
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 5, "Excellent trip!");

        AgentReputation.TripRating[] memory ratings = reputation.getRatings(AGENT_TOKEN_ID);
        assertEq(ratings.length, 1);
        assertEq(ratings[0].rating, 5);
        assertEq(ratings[0].rater, alice);
        assertEq(ratings[0].tripId, TRIP_ID);
        assertEq(ratings[0].comment, "Excellent trip!");
    }

    function test_rateAgent_multipleRaters() public {
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 5, "Great!");
        vm.prank(bob);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 4, "Good");
        vm.prank(carol);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 3, "OK");

        assertEq(reputation.totalRatings(AGENT_TOKEN_ID), 3);
        assertEq(reputation.totalScore(AGENT_TOKEN_ID), 12);
    }

    function test_rateAgent_revertInvalidRating_zero() public {
        vm.prank(alice);
        vm.expectRevert("Rating must be 1-5");
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 0, "");
    }

    function test_rateAgent_revertInvalidRating_six() public {
        vm.prank(alice);
        vm.expectRevert("Rating must be 1-5");
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 6, "");
    }

    function test_rateAgent_revertDoubleRating() public {
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 5, "Great!");

        vm.prank(alice);
        vm.expectRevert("Already rated this trip");
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 4, "Changed my mind");
    }

    function test_rateAgent_canRateDifferentTrips() public {
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, 1, 5, "Trip 1");
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, 2, 4, "Trip 2");

        assertEq(reputation.totalRatings(AGENT_TOKEN_ID), 2);
    }

    function test_rateAgent_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit AgentReputation.AgentRated(AGENT_TOKEN_ID, TRIP_ID, alice, 5);

        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 5, "Great!");
    }

    // --- Average Rating ---

    function test_getAverageRating_noRatings() public view {
        assertEq(reputation.getAverageRating(AGENT_TOKEN_ID), 0);
    }

    function test_getAverageRating_single() public {
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 4, "");

        // 4 * 100 / 1 = 400
        assertEq(reputation.getAverageRating(AGENT_TOKEN_ID), 400);
    }

    function test_getAverageRating_multiple() public {
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 5, "");
        vm.prank(bob);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 4, "");
        vm.prank(carol);
        reputation.rateAgent(AGENT_TOKEN_ID, TRIP_ID, 3, "");

        // (5+4+3)*100 / 3 = 400
        assertEq(reputation.getAverageRating(AGENT_TOKEN_ID), 400);
    }

    // --- Trip Completed ---

    function test_recordTripCompleted() public {
        reputation.recordTripCompleted(AGENT_TOKEN_ID, TRIP_ID);
        assertEq(reputation.totalTrips(AGENT_TOKEN_ID), 1);
    }

    function test_recordTripCompleted_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit AgentReputation.TripCompleted(AGENT_TOKEN_ID, TRIP_ID);

        reputation.recordTripCompleted(AGENT_TOKEN_ID, TRIP_ID);
    }

    // --- Stats ---

    function test_getAgentStats() public {
        vm.prank(alice);
        reputation.rateAgent(AGENT_TOKEN_ID, 1, 5, "");
        vm.prank(bob);
        reputation.rateAgent(AGENT_TOKEN_ID, 1, 3, "");
        reputation.recordTripCompleted(AGENT_TOKEN_ID, 1);
        reputation.recordTripCompleted(AGENT_TOKEN_ID, 2);

        (uint256 avg, uint256 numRatings, uint256 numTrips) = reputation.getAgentStats(AGENT_TOKEN_ID);
        assertEq(avg, 400); // (5+3)*100/2
        assertEq(numRatings, 2);
        assertEq(numTrips, 2);
    }

    function test_getAgentStats_noData() public view {
        (uint256 avg, uint256 numRatings, uint256 numTrips) = reputation.getAgentStats(999);
        assertEq(avg, 0);
        assertEq(numRatings, 0);
        assertEq(numTrips, 0);
    }
}
