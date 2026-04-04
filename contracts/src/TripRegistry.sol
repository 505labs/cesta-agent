// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TripRegistry — On-chain trip registry linking agents, trips, and 0G Storage
 * @notice Records trip lifecycle on 0G Chain: creation, storage references, and completion.
 *         Links each trip to the agent iNFT that managed it and the 0G Storage stream
 *         where trip data lives.
 */
contract TripRegistry {
    struct Trip {
        uint256 agentTokenId;       // iNFT of the agent used
        address organizer;
        string storageStreamId;     // 0G Storage KV stream ID (e.g., "trip:42")
        bytes32 itineraryHash;      // Root hash of itinerary on 0G Storage
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    uint256 public nextTripId;
    mapping(uint256 => Trip) public trips;
    // agent token ID => list of trip IDs managed by this agent
    mapping(uint256 => uint256[]) public agentTrips;

    event TripRegistered(uint256 indexed tripId, uint256 indexed agentTokenId, address indexed organizer, string storageStreamId);
    event TripEnded(uint256 indexed tripId, bytes32 finalReportHash);
    event ItineraryUpdated(uint256 indexed tripId, bytes32 itineraryHash);

    /**
     * @notice Register a new trip.
     * @param _agentTokenId The iNFT token ID of the agent managing this trip
     * @param _storageStreamId The 0G Storage KV stream ID for trip data
     */
    function registerTrip(
        uint256 _agentTokenId,
        string calldata _storageStreamId
    ) external returns (uint256 tripId) {
        tripId = nextTripId++;
        trips[tripId] = Trip({
            agentTokenId: _agentTokenId,
            organizer: msg.sender,
            storageStreamId: _storageStreamId,
            itineraryHash: bytes32(0),
            startTime: block.timestamp,
            endTime: 0,
            active: true
        });

        agentTrips[_agentTokenId].push(tripId);

        emit TripRegistered(tripId, _agentTokenId, msg.sender, _storageStreamId);
    }

    /**
     * @notice Update the itinerary hash (as the route changes during the trip).
     */
    function updateItinerary(uint256 _tripId, bytes32 _itineraryHash) external {
        Trip storage trip = trips[_tripId];
        require(trip.active, "Trip not active");
        require(msg.sender == trip.organizer, "Not organizer");

        trip.itineraryHash = _itineraryHash;
        emit ItineraryUpdated(_tripId, _itineraryHash);
    }

    /**
     * @notice End a trip and record the final report hash on 0G Storage.
     * @param _finalReportHash Root hash of the final trip report on 0G Storage
     */
    function endTrip(uint256 _tripId, bytes32 _finalReportHash) external {
        Trip storage trip = trips[_tripId];
        require(trip.active, "Trip not active");
        require(msg.sender == trip.organizer, "Not organizer");

        trip.active = false;
        trip.endTime = block.timestamp;

        emit TripEnded(_tripId, _finalReportHash);
    }

    /**
     * @notice Get full trip details.
     */
    function getTrip(uint256 _tripId) external view returns (Trip memory) {
        return trips[_tripId];
    }

    /**
     * @notice Get all trip IDs managed by an agent.
     */
    function getAgentTrips(uint256 _agentTokenId) external view returns (uint256[] memory) {
        return agentTrips[_agentTokenId];
    }

    /**
     * @notice Get total trips for an agent.
     */
    function getAgentTripCount(uint256 _agentTokenId) external view returns (uint256) {
        return agentTrips[_agentTokenId].length;
    }
}
