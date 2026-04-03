// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract GroupTreasury {
    using SafeERC20 for IERC20;

    // --- Types ---
    enum TripStatus { Active, Settled }

    struct Trip {
        address organizer;
        address agent;           // Authorized AI agent wallet
        address usdc;            // USDC token address
        uint256 spendLimit;      // Per-tx auto-spend limit (in USDC base units)
        uint256 totalDeposited;
        uint256 totalSpent;
        TripStatus status;
        uint256 memberCount;
    }

    struct Spend {
        address recipient;
        uint256 amount;
        string category;         // "food", "gas", "lodging", "activities"
        string description;
        uint256 timestamp;
    }

    // --- State ---
    uint256 public nextTripId;
    mapping(uint256 => Trip) public trips;
    mapping(uint256 => mapping(address => uint256)) public deposits;   // tripId => member => amount
    mapping(uint256 => address[]) public members;                      // tripId => member list
    mapping(uint256 => Spend[]) public spends;                         // tripId => spend history
    mapping(uint256 => mapping(address => bool)) public isMember;

    // --- Events ---
    event TripCreated(uint256 indexed tripId, address indexed organizer, address agent, address usdc);
    event MemberJoined(uint256 indexed tripId, address indexed member, uint256 amount);
    event FundsSpent(uint256 indexed tripId, address indexed recipient, uint256 amount, string category, string description);
    event TripSettled(uint256 indexed tripId, uint256 totalSpent, uint256 totalReturned);
    event EmergencyWithdraw(uint256 indexed tripId, address indexed member, uint256 amount);

    // --- Create Trip ---
    function createTrip(
        address _usdc,
        address _agent,
        uint256 _spendLimit
    ) external returns (uint256 tripId) {
        tripId = nextTripId++;
        trips[tripId] = Trip({
            organizer: msg.sender,
            agent: _agent,
            usdc: _usdc,
            spendLimit: _spendLimit,
            totalDeposited: 0,
            totalSpent: 0,
            status: TripStatus.Active,
            memberCount: 0
        });
        emit TripCreated(tripId, msg.sender, _agent, _usdc);
    }

    // --- Join & Deposit ---
    function deposit(uint256 _tripId, uint256 _amount) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(_amount > 0, "Zero amount");

        IERC20(trip.usdc).safeTransferFrom(msg.sender, address(this), _amount);

        if (!isMember[_tripId][msg.sender]) {
            isMember[_tripId][msg.sender] = true;
            members[_tripId].push(msg.sender);
            trip.memberCount++;
        }
        deposits[_tripId][msg.sender] += _amount;
        trip.totalDeposited += _amount;

        emit MemberJoined(_tripId, msg.sender, _amount);
    }

    // --- Agent Spend ---
    function spend(
        uint256 _tripId,
        address _recipient,
        uint256 _amount,
        string calldata _category,
        string calldata _description
    ) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.agent, "Not authorized agent");
        require(_amount <= trip.spendLimit, "Exceeds spend limit");
        require(_amount <= trip.totalDeposited - trip.totalSpent, "Insufficient funds");

        trip.totalSpent += _amount;
        spends[_tripId].push(Spend({
            recipient: _recipient,
            amount: _amount,
            category: _category,
            description: _description,
            timestamp: block.timestamp
        }));

        IERC20(trip.usdc).safeTransfer(_recipient, _amount);

        emit FundsSpent(_tripId, _recipient, _amount, _category, _description);
    }

    // --- Settle Trip ---
    function settle(uint256 _tripId) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.organizer || isMember[_tripId][msg.sender], "Not a member");

        trip.status = TripStatus.Settled;

        uint256 remaining = trip.totalDeposited - trip.totalSpent;
        if (remaining > 0) {
            // Return proportionally to depositors
            for (uint256 i = 0; i < members[_tripId].length; i++) {
                address member = members[_tripId][i];
                uint256 share = (remaining * deposits[_tripId][member]) / trip.totalDeposited;
                if (share > 0) {
                    IERC20(trip.usdc).safeTransfer(member, share);
                }
            }
        }

        emit TripSettled(_tripId, trip.totalSpent, remaining);
    }

    // --- Emergency Withdraw ---
    function emergencyWithdraw(uint256 _tripId) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(isMember[_tripId][msg.sender], "Not a member");

        uint256 remaining = trip.totalDeposited - trip.totalSpent;
        uint256 share = (remaining * deposits[_tripId][msg.sender]) / trip.totalDeposited;
        require(share > 0, "Nothing to withdraw");

        // Reduce deposit record so proportions remain correct
        uint256 originalDeposit = deposits[_tripId][msg.sender];
        deposits[_tripId][msg.sender] = 0;
        trip.totalDeposited -= originalDeposit;

        IERC20(trip.usdc).safeTransfer(msg.sender, share);

        emit EmergencyWithdraw(_tripId, msg.sender, share);
    }

    // --- View Helpers ---
    function getTrip(uint256 _tripId) external view returns (Trip memory) {
        return trips[_tripId];
    }

    function getMembers(uint256 _tripId) external view returns (address[] memory) {
        return members[_tripId];
    }

    function getSpends(uint256 _tripId) external view returns (Spend[] memory) {
        return spends[_tripId];
    }

    function getBalance(uint256 _tripId) external view returns (uint256) {
        Trip storage trip = trips[_tripId];
        return trip.totalDeposited - trip.totalSpent;
    }

    function getMemberDeposit(uint256 _tripId, address _member) external view returns (uint256) {
        return deposits[_tripId][_member];
    }
}
