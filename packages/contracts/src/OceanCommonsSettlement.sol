// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Settles an Ocean Commons match across three outcomes that are never combined.
/// @dev There is deliberately no function here that ranks entries or sums their
///      outcomes. Three funders each hold their own pool and each supports the
///      entry that served the outcome they care about, so "who won" is not a
///      question this contract can answer — the Arena's whole claim is that the
///      question has three different answers. An entry is on the frontier when
///      nothing beats it on all three at once; that is the only comparison the
///      contract makes, and it is a partial order, not a ranking.
contract OceanCommonsSettlement is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The three outcomes, fixed at deployment so no later vote can merge them.
    uint256 public constant OUTCOME_COUNT = 3;
    uint256 public constant LIVELIHOOD = 0;
    uint256 public constant RESTRAINT = 1;
    uint256 public constant COOPERATION = 2;

    struct Entry {
        /// @dev Medians across the match, scaled by the caller. Never summed here.
        uint256[OUTCOME_COUNT] outcomes;
        /// @dev How many seasons of the match the entry took each outcome.
        uint8[OUTCOME_COUNT] seasonsWon;
        bool recorded;
        bool onFrontier;
    }

    IERC20 public immutable rewardToken;

    /// @notice Who may record a match result. Set once, so the owner cannot rewrite history later.
    address public attestor;

    mapping(bytes32 matchId => bool sealed_) public sealedMatch;
    mapping(bytes32 matchId => uint8 seasons) public seasonsInMatch;
    mapping(bytes32 matchId => bytes32[] entryIds) private _entries;
    mapping(bytes32 matchId => mapping(bytes32 entryId => Entry entry)) private _entryById;
    mapping(bytes32 matchId => mapping(uint256 outcome => bytes32 entryId)) public supportedBy;
    mapping(bytes32 matchId => mapping(uint256 outcome => uint256 amount)) public poolAmount;
    mapping(bytes32 matchId => mapping(address recipient => uint256 amount)) public claimable;

    error AlreadyRecorded();
    error AlreadySealed();
    error AttestorAlreadySet();
    error EmptyMatch();
    error MatchNotSealed();
    error NothingToClaim();
    error TooFewSeasons();
    error UnknownEntry();
    error UnknownOutcome();
    error UnauthorizedAttestor();
    error ZeroRecipient();

    event AttestorSet(address indexed attestor);
    event EntryRecorded(bytes32 indexed matchId, bytes32 indexed entryId, bool onFrontier);
    event MatchSealed(bytes32 indexed matchId, uint8 seasons, uint256 entryCount);
    event OutcomeSupported(
        bytes32 indexed matchId, uint256 indexed outcome, bytes32 indexed entryId, address recipient, uint256 amount
    );
    event RewardClaimed(bytes32 indexed matchId, address indexed recipient, uint256 amount);

    constructor(address initialOwner, IERC20 token) Ownable(initialOwner) {
        require(address(token) != address(0), "ZERO_TOKEN");
        rewardToken = token;
    }

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert UnauthorizedAttestor();
        _;
    }

    function setAttestor(address newAttestor) external onlyOwner {
        if (attestor != address(0)) revert AttestorAlreadySet();
        if (newAttestor == address(0)) revert ZeroRecipient();
        attestor = newAttestor;
        emit AttestorSet(newAttestor);
    }

    /// @notice Record one entry's match outcomes.
    /// @dev A match must run several seasons before anything is recorded. One
    ///      season of this Arena is close to one hand of cards: measured over
    ///      7,200 scripted seasons the draw accounts for a fifth to two fifths
    ///      of an outcome, so settling on a single season would be paying out on
    ///      the weather.
    function recordEntry(
        bytes32 matchId,
        bytes32 entryId,
        uint8 seasons,
        uint256[OUTCOME_COUNT] calldata outcomes,
        uint8[OUTCOME_COUNT] calldata seasonsWon
    ) external onlyAttestor {
        if (sealedMatch[matchId]) revert AlreadySealed();
        if (seasons < 3) revert TooFewSeasons();
        if (_entryById[matchId][entryId].recorded) revert AlreadyRecorded();

        seasonsInMatch[matchId] = seasons;
        Entry storage entry = _entryById[matchId][entryId];
        entry.outcomes = outcomes;
        entry.seasonsWon = seasonsWon;
        entry.recorded = true;
        _entries[matchId].push(entryId);

        emit EntryRecorded(matchId, entryId, false);
    }

    /// @notice Close the match and mark which entries nothing dominates.
    /// @dev Dominance is the only comparison made: an entry leaves the frontier
    ///      when another is at least equal on all three outcomes and better on
    ///      one. Several entries normally survive, which is the point.
    function sealMatch(bytes32 matchId) external onlyAttestor {
        if (sealedMatch[matchId]) revert AlreadySealed();
        bytes32[] storage ids = _entries[matchId];
        if (ids.length == 0) revert EmptyMatch();

        for (uint256 i = 0; i < ids.length; ++i) {
            Entry storage candidate = _entryById[matchId][ids[i]];
            bool dominated = false;
            for (uint256 j = 0; j < ids.length && !dominated; ++j) {
                if (i == j) continue;
                dominated = _dominates(_entryById[matchId][ids[j]], candidate);
            }
            candidate.onFrontier = !dominated;
            emit EntryRecorded(matchId, ids[i], candidate.onFrontier);
        }

        sealedMatch[matchId] = true;
        emit MatchSealed(matchId, seasonsInMatch[matchId], ids.length);
    }

    /// @notice One funder backs the entry that served its own outcome.
    /// @dev Each outcome is funded and decided separately. Nothing checks that
    ///      the three funders agree, and nothing stops them backing three
    ///      different entries — that disagreement is the result being published.
    function supportOutcome(bytes32 matchId, uint256 outcome, bytes32 entryId, address recipient, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (!sealedMatch[matchId]) revert MatchNotSealed();
        if (outcome >= OUTCOME_COUNT) revert UnknownOutcome();
        if (!_entryById[matchId][entryId].recorded) revert UnknownEntry();
        if (recipient == address(0)) revert ZeroRecipient();

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        supportedBy[matchId][outcome] = entryId;
        poolAmount[matchId][outcome] = amount;
        claimable[matchId][recipient] += amount;

        emit OutcomeSupported(matchId, outcome, entryId, recipient, amount);
    }

    function claim(bytes32 matchId) external nonReentrant {
        uint256 amount = claimable[matchId][msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[matchId][msg.sender] = 0;
        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardClaimed(matchId, msg.sender, amount);
    }

    function entryIds(bytes32 matchId) external view returns (bytes32[] memory) {
        return _entries[matchId];
    }

    function entryOf(bytes32 matchId, bytes32 entryId)
        external
        view
        returns (uint256[OUTCOME_COUNT] memory outcomes, uint8[OUTCOME_COUNT] memory seasonsWon, bool onFrontier)
    {
        Entry storage entry = _entryById[matchId][entryId];
        if (!entry.recorded) revert UnknownEntry();
        return (entry.outcomes, entry.seasonsWon, entry.onFrontier);
    }

    function frontierOf(bytes32 matchId) external view returns (bytes32[] memory) {
        if (!sealedMatch[matchId]) revert MatchNotSealed();
        bytes32[] storage ids = _entries[matchId];
        uint256 count;
        for (uint256 i = 0; i < ids.length; ++i) {
            if (_entryById[matchId][ids[i]].onFrontier) ++count;
        }
        bytes32[] memory out = new bytes32[](count);
        uint256 cursor;
        for (uint256 i = 0; i < ids.length; ++i) {
            if (_entryById[matchId][ids[i]].onFrontier) out[cursor++] = ids[i];
        }
        return out;
    }

    function _dominates(Entry storage a, Entry storage b) private view returns (bool) {
        bool strictlyBetter = false;
        for (uint256 k = 0; k < OUTCOME_COUNT; ++k) {
            if (a.outcomes[k] < b.outcomes[k]) return false;
            if (a.outcomes[k] > b.outcomes[k]) strictlyBetter = true;
        }
        return strictlyBetter;
    }
}
