// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentReputation — On-chain reputation system for AI agent iNFTs
 * @notice Trip members rate agents after trips. Ratings accumulate on-chain,
 *         creating a verifiable track record tied to the agent's iNFT token ID.
 */
contract AgentReputation {
    struct TripRating {
        uint256 tripId;
        address rater;
        uint8 rating;       // 1-5
        string comment;
        uint256 timestamp;
    }

    // iNFT token ID => list of ratings
    mapping(uint256 => TripRating[]) public ratingsList;
    // iNFT token ID => cumulative score (sum of all ratings)
    mapping(uint256 => uint256) public totalScore;
    // iNFT token ID => total number of ratings
    mapping(uint256 => uint256) public totalRatings;
    // iNFT token ID => total trips completed
    mapping(uint256 => uint256) public totalTrips;
    // Prevent double-rating: agentTokenId => tripId => rater => rated
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasRated;

    event AgentRated(uint256 indexed agentTokenId, uint256 indexed tripId, address indexed rater, uint8 rating);
    event TripCompleted(uint256 indexed agentTokenId, uint256 indexed tripId);

    /**
     * @notice Rate an agent after a trip.
     * @param _agentTokenId The iNFT token ID of the agent
     * @param _tripId The trip ID being rated
     * @param _rating Score from 1 to 5
     * @param _comment Optional text feedback
     */
    function rateAgent(
        uint256 _agentTokenId,
        uint256 _tripId,
        uint8 _rating,
        string calldata _comment
    ) external {
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");
        require(!hasRated[_agentTokenId][_tripId][msg.sender], "Already rated this trip");

        hasRated[_agentTokenId][_tripId][msg.sender] = true;

        ratingsList[_agentTokenId].push(TripRating({
            tripId: _tripId,
            rater: msg.sender,
            rating: _rating,
            comment: _comment,
            timestamp: block.timestamp
        }));

        totalScore[_agentTokenId] += _rating;
        totalRatings[_agentTokenId]++;

        emit AgentRated(_agentTokenId, _tripId, msg.sender, _rating);
    }

    /**
     * @notice Record a trip completion for the agent. Anyone can call — used by
     *         the TripRegistry when a trip ends.
     */
    function recordTripCompleted(uint256 _agentTokenId, uint256 _tripId) external {
        totalTrips[_agentTokenId]++;
        emit TripCompleted(_agentTokenId, _tripId);
    }

    /**
     * @notice Get the average rating scaled to 2 decimal places (e.g., 450 = 4.50).
     */
    function getAverageRating(uint256 _agentTokenId) external view returns (uint256) {
        if (totalRatings[_agentTokenId] == 0) return 0;
        return (totalScore[_agentTokenId] * 100) / totalRatings[_agentTokenId];
    }

    /**
     * @notice Get all ratings for an agent.
     */
    function getRatings(uint256 _agentTokenId) external view returns (TripRating[] memory) {
        return ratingsList[_agentTokenId];
    }

    /**
     * @notice Get summary stats for an agent.
     */
    function getAgentStats(uint256 _agentTokenId) external view returns (
        uint256 avgRating,
        uint256 numRatings,
        uint256 numTrips
    ) {
        numRatings = totalRatings[_agentTokenId];
        numTrips = totalTrips[_agentTokenId];
        avgRating = numRatings > 0 ? (totalScore[_agentTokenId] * 100) / numRatings : 0;
    }
}
