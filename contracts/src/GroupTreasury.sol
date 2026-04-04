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
        address agent;
        address usdc;
        uint256 spendLimit;
        uint256 dailyCap;
        uint256 totalDeposited;
        uint256 totalSpent;
        TripStatus status;
        uint256 memberCount;
    }

    struct Spend {
        address recipient;
        uint256 amount;
        string category;
        string description;
        uint256 timestamp;
    }

    struct CategoryBudget {
        uint256 budget;
        uint256 spent;
    }

    struct VoteRequest {
        uint256 tripId;
        address recipient;
        uint256 amount;
        string category;
        string description;
        uint256 approvals;
        uint256 threshold;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    // --- State ---
    uint256 public nextTripId;
    uint256 public nextVoteId;
    mapping(uint256 => Trip) public trips;
    mapping(uint256 => mapping(address => uint256)) public deposits;
    mapping(uint256 => address[]) public members;
    mapping(uint256 => Spend[]) public spends;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(uint256 => uint256)) public dailySpending;
    mapping(uint256 => mapping(string => CategoryBudget)) public categoryBudgets;
    mapping(uint256 => uint256) public nanopaymentTotal;
    mapping(uint256 => VoteRequest) public voteRequests;

    // --- Events ---
    event TripCreated(uint256 indexed tripId, address indexed organizer, address agent, address usdc);
    event MemberJoined(uint256 indexed tripId, address indexed member, uint256 amount);
    event FundsSpent(uint256 indexed tripId, address indexed recipient, uint256 amount, string category, string description);
    event TripSettled(uint256 indexed tripId, uint256 totalSpent, uint256 totalReturned);
    event EmergencyWithdraw(uint256 indexed tripId, address indexed member, uint256 amount);
    event CategoryBudgetSet(uint256 indexed tripId, string category, uint256 budget);
    event NanopaymentProcessed(uint256 indexed tripId, address indexed recipient, uint256 amount, string category, string description);
    event VoteRequested(uint256 indexed voteId, uint256 indexed tripId, uint256 amount, string description);
    event VoteCast(uint256 indexed voteId, address indexed voter, bool approved);
    event VoteExecuted(uint256 indexed voteId, uint256 indexed tripId);

    function createTrip(address _usdc, address _agent, uint256 _spendLimit) external returns (uint256 tripId) {
        tripId = nextTripId++;
        Trip storage trip = trips[tripId];
        trip.organizer = msg.sender;
        trip.agent = _agent;
        trip.usdc = _usdc;
        trip.spendLimit = _spendLimit;
        trip.status = TripStatus.Active;
        emit TripCreated(tripId, msg.sender, _agent, _usdc);
    }

    function setDailyCap(uint256 _tripId, uint256 _dailyCap) external {
        require(msg.sender == trips[_tripId].organizer, "Not organizer");
        trips[_tripId].dailyCap = _dailyCap;
    }

    function setCategoryBudget(uint256 _tripId, string calldata _category, uint256 _budget) external {
        require(msg.sender == trips[_tripId].organizer, "Not organizer");
        categoryBudgets[_tripId][_category].budget = _budget;
        emit CategoryBudgetSet(_tripId, _category, _budget);
    }

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

    function spend(uint256 _tripId, address _recipient, uint256 _amount, string calldata _category, string calldata _description) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.agent, "Not authorized agent");
        require(_amount <= trip.spendLimit, "Exceeds spend limit");
        require(_amount <= trip.totalDeposited - trip.totalSpent, "Insufficient funds");
        if (trip.dailyCap > 0) {
            uint256 today = block.timestamp / 1 days;
            require(dailySpending[_tripId][today] + _amount <= trip.dailyCap, "Exceeds daily cap");
            dailySpending[_tripId][today] += _amount;
        }
        CategoryBudget storage catBudget = categoryBudgets[_tripId][_category];
        if (catBudget.budget > 0) {
            require(catBudget.spent + _amount <= catBudget.budget, "Exceeds category budget");
        }
        catBudget.spent += _amount;
        trip.totalSpent += _amount;
        spends[_tripId].push(Spend({recipient: _recipient, amount: _amount, category: _category, description: _description, timestamp: block.timestamp}));
        IERC20(trip.usdc).safeTransfer(_recipient, _amount);
        emit FundsSpent(_tripId, _recipient, _amount, _category, _description);
    }

    function nanopayment(uint256 _tripId, address _recipient, uint256 _amount, string calldata _category, string calldata _description) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.agent, "Not authorized agent");
        require(_amount <= trip.totalDeposited - trip.totalSpent, "Insufficient funds");
        if (trip.dailyCap > 0) {
            dailySpending[_tripId][block.timestamp / 1 days] += _amount;
        }
        categoryBudgets[_tripId][_category].spent += _amount;
        trip.totalSpent += _amount;
        nanopaymentTotal[_tripId] += _amount;
        spends[_tripId].push(Spend({recipient: _recipient, amount: _amount, category: _category, description: _description, timestamp: block.timestamp}));
        IERC20(trip.usdc).safeTransfer(_recipient, _amount);
        emit NanopaymentProcessed(_tripId, _recipient, _amount, _category, _description);
    }

    function requestVote(uint256 _tripId, address _recipient, uint256 _amount, string calldata _category, string calldata _description, uint256 _threshold) external returns (uint256 voteId) {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.agent || msg.sender == trip.organizer, "Not authorized");
        voteId = nextVoteId++;
        VoteRequest storage vote = voteRequests[voteId];
        vote.tripId = _tripId;
        vote.recipient = _recipient;
        vote.amount = _amount;
        vote.category = _category;
        vote.description = _description;
        vote.threshold = _threshold;
        emit VoteRequested(voteId, _tripId, _amount, _description);
    }

    function castVote(uint256 _voteId) external {
        VoteRequest storage vote = voteRequests[_voteId];
        require(isMember[vote.tripId][msg.sender], "Not a member");
        require(!vote.hasVoted[msg.sender], "Already voted");
        require(!vote.executed, "Already executed");
        vote.hasVoted[msg.sender] = true;
        vote.approvals++;
        emit VoteCast(_voteId, msg.sender, true);
    }

    function executeVote(uint256 _voteId) external {
        VoteRequest storage vote = voteRequests[_voteId];
        Trip storage trip = trips[vote.tripId];
        require(!vote.executed, "Already executed");
        require(vote.approvals >= vote.threshold, "Not enough approvals");
        require(vote.amount <= trip.totalDeposited - trip.totalSpent, "Insufficient funds");
        vote.executed = true;
        trip.totalSpent += vote.amount;
        categoryBudgets[vote.tripId][vote.category].spent += vote.amount;
        spends[vote.tripId].push(Spend({recipient: vote.recipient, amount: vote.amount, category: vote.category, description: vote.description, timestamp: block.timestamp}));
        IERC20(trip.usdc).safeTransfer(vote.recipient, vote.amount);
        emit FundsSpent(vote.tripId, vote.recipient, vote.amount, vote.category, vote.description);
        emit VoteExecuted(_voteId, vote.tripId);
    }

    function settle(uint256 _tripId) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.organizer || isMember[_tripId][msg.sender], "Not a member");
        trip.status = TripStatus.Settled;
        uint256 remaining = trip.totalDeposited - trip.totalSpent;
        if (remaining > 0) {
            for (uint256 i = 0; i < members[_tripId].length; i++) {
                address member = members[_tripId][i];
                uint256 share = (remaining * deposits[_tripId][member]) / trip.totalDeposited;
                if (share > 0) { IERC20(trip.usdc).safeTransfer(member, share); }
            }
        }
        emit TripSettled(_tripId, trip.totalSpent, remaining);
    }

    function emergencyWithdraw(uint256 _tripId) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(isMember[_tripId][msg.sender], "Not a member");
        uint256 remaining = trip.totalDeposited - trip.totalSpent;
        uint256 share = (remaining * deposits[_tripId][msg.sender]) / trip.totalDeposited;
        require(share > 0, "Nothing to withdraw");
        uint256 originalDeposit = deposits[_tripId][msg.sender];
        deposits[_tripId][msg.sender] = 0;
        trip.totalDeposited -= originalDeposit;
        IERC20(trip.usdc).safeTransfer(msg.sender, share);
        emit EmergencyWithdraw(_tripId, msg.sender, share);
    }

    // --- View Helpers ---
    function getTrip(uint256 _tripId) external view returns (Trip memory) { return trips[_tripId]; }
    function getMembers(uint256 _tripId) external view returns (address[] memory) { return members[_tripId]; }
    function getSpends(uint256 _tripId) external view returns (Spend[] memory) { return spends[_tripId]; }
    function getBalance(uint256 _tripId) external view returns (uint256) { return trips[_tripId].totalDeposited - trips[_tripId].totalSpent; }
    function getMemberDeposit(uint256 _tripId, address _member) external view returns (uint256) { return deposits[_tripId][_member]; }
    function getCategoryBudget(uint256 _tripId, string calldata _category) external view returns (uint256 budget, uint256 spent) {
        CategoryBudget storage cb = categoryBudgets[_tripId][_category];
        return (cb.budget, cb.spent);
    }
    function getDailySpending(uint256 _tripId) external view returns (uint256) { return dailySpending[_tripId][block.timestamp / 1 days]; }
    function getNanopaymentTotal(uint256 _tripId) external view returns (uint256) { return nanopaymentTotal[_tripId]; }
    function getVoteRequest(uint256 _voteId) external view returns (uint256 tripId, address recipient, uint256 amount, string memory category, string memory description, uint256 approvals, uint256 threshold, bool executed) {
        VoteRequest storage v = voteRequests[_voteId];
        return (v.tripId, v.recipient, v.amount, v.category, v.description, v.approvals, v.threshold, v.executed);
    }
}
