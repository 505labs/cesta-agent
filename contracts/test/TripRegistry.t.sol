// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TripRegistry} from "../src/TripRegistry.sol";

contract TripRegistryTest is Test {
    TripRegistry registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant AGENT_TOKEN_ID = 0;
    string constant STREAM_ID = "trip:42";

    function setUp() public {
        registry = new TripRegistry();
    }

    // --- Registration ---

    function test_registerTrip() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        assertEq(tripId, 0);

        TripRegistry.Trip memory trip = registry.getTrip(tripId);
        assertEq(trip.agentTokenId, AGENT_TOKEN_ID);
        assertEq(trip.organizer, alice);
        assertEq(trip.storageStreamId, STREAM_ID);
        assertEq(trip.itineraryHash, bytes32(0));
        assertGt(trip.startTime, 0);
        assertEq(trip.endTime, 0);
        assertTrue(trip.active);
    }

    function test_registerTrip_incrementsId() public {
        vm.prank(alice);
        uint256 id1 = registry.registerTrip(AGENT_TOKEN_ID, "trip:1");
        vm.prank(alice);
        uint256 id2 = registry.registerTrip(AGENT_TOKEN_ID, "trip:2");

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(registry.nextTripId(), 2);
    }

    function test_registerTrip_tracksAgentTrips() public {
        vm.prank(alice);
        registry.registerTrip(AGENT_TOKEN_ID, "trip:1");
        vm.prank(alice);
        registry.registerTrip(AGENT_TOKEN_ID, "trip:2");

        uint256[] memory trips = registry.getAgentTrips(AGENT_TOKEN_ID);
        assertEq(trips.length, 2);
        assertEq(trips[0], 0);
        assertEq(trips[1], 1);
    }

    function test_registerTrip_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit TripRegistry.TripRegistered(0, AGENT_TOKEN_ID, alice, STREAM_ID);

        vm.prank(alice);
        registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);
    }

    // --- Itinerary Update ---

    function test_updateItinerary() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        bytes32 hash = keccak256("itinerary-v1");
        vm.prank(alice);
        registry.updateItinerary(tripId, hash);

        assertEq(registry.getTrip(tripId).itineraryHash, hash);
    }

    function test_updateItinerary_revertNotOrganizer() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        vm.prank(bob);
        vm.expectRevert("Not organizer");
        registry.updateItinerary(tripId, keccak256("hacked"));
    }

    function test_updateItinerary_revertInactive() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        vm.prank(alice);
        registry.endTrip(tripId, bytes32(0));

        vm.prank(alice);
        vm.expectRevert("Trip not active");
        registry.updateItinerary(tripId, keccak256("late update"));
    }

    function test_updateItinerary_emitsEvent() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        bytes32 hash = keccak256("itinerary-v1");
        vm.expectEmit(true, false, false, true);
        emit TripRegistry.ItineraryUpdated(tripId, hash);

        vm.prank(alice);
        registry.updateItinerary(tripId, hash);
    }

    // --- End Trip ---

    function test_endTrip() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        bytes32 reportHash = keccak256("final-report");
        vm.prank(alice);
        registry.endTrip(tripId, reportHash);

        TripRegistry.Trip memory trip = registry.getTrip(tripId);
        assertFalse(trip.active);
        assertGt(trip.endTime, 0);
    }

    function test_endTrip_revertNotOrganizer() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        vm.prank(bob);
        vm.expectRevert("Not organizer");
        registry.endTrip(tripId, bytes32(0));
    }

    function test_endTrip_revertAlreadyEnded() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        vm.prank(alice);
        registry.endTrip(tripId, bytes32(0));

        vm.prank(alice);
        vm.expectRevert("Trip not active");
        registry.endTrip(tripId, bytes32(0));
    }

    function test_endTrip_emitsEvent() public {
        vm.prank(alice);
        uint256 tripId = registry.registerTrip(AGENT_TOKEN_ID, STREAM_ID);

        bytes32 reportHash = keccak256("final-report");
        vm.expectEmit(true, false, false, true);
        emit TripRegistry.TripEnded(tripId, reportHash);

        vm.prank(alice);
        registry.endTrip(tripId, reportHash);
    }

    // --- View Helpers ---

    function test_getAgentTripCount() public {
        vm.startPrank(alice);
        registry.registerTrip(AGENT_TOKEN_ID, "trip:1");
        registry.registerTrip(AGENT_TOKEN_ID, "trip:2");
        registry.registerTrip(AGENT_TOKEN_ID, "trip:3");
        vm.stopPrank();

        assertEq(registry.getAgentTripCount(AGENT_TOKEN_ID), 3);
    }

    function test_getAgentTripCount_zero() public view {
        assertEq(registry.getAgentTripCount(999), 0);
    }
}
