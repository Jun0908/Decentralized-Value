// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IParetoSettlement} from "./interfaces/IParetoSettlement.sol";

contract ParetoSettlement is IParetoSettlement, Ownable, Pausable {
    struct Point {
        uint256 gasPerOrder;
        uint256 parallelThroughput;
        bool evaluated;
        bool onFrontier;
    }

    address public attestationSubmitter;
    mapping(bytes32 challengeId => mapping(bytes32 artifactId => Point point)) public points;
    mapping(bytes32 challengeId => bytes32[] artifactIds) private _frontiers;

    error AlreadyEvaluated();
    error InvalidMetric();
    error SubmitterAlreadySet();
    error UnauthorizedSubmitter();

    event AttestationSubmitterSet(address indexed submitter);
    event FrontierAdded(
        bytes32 indexed challengeId, bytes32 indexed artifactId, uint256 gasPerOrder, uint256 parallelThroughput
    );
    event FrontierDominated(bytes32 indexed challengeId, bytes32 indexed artifactId, bytes32 indexed byArtifactId);
    event FrontierRemoved(bytes32 indexed challengeId, bytes32 indexed artifactId, bytes32 indexed byArtifactId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyAttestationSubmitter() {
        if (msg.sender != attestationSubmitter) revert UnauthorizedSubmitter();
        _;
    }

    function setAttestationSubmitter(address submitter) external onlyOwner {
        if (attestationSubmitter != address(0)) revert SubmitterAlreadySet();
        require(submitter != address(0), "ZERO_SUBMITTER");
        attestationSubmitter = submitter;
        emit AttestationSubmitterSet(submitter);
    }

    function recordOutcome(bytes32 challengeId, bytes32 artifactId, uint256 gasPerOrder, uint256 parallelThroughput)
        external
        onlyAttestationSubmitter
        whenNotPaused
    {
        if (challengeId == bytes32(0) || artifactId == bytes32(0) || gasPerOrder == 0 || parallelThroughput == 0) {
            revert InvalidMetric();
        }
        Point storage candidate = points[challengeId][artifactId];
        if (candidate.evaluated) revert AlreadyEvaluated();
        candidate.gasPerOrder = gasPerOrder;
        candidate.parallelThroughput = parallelThroughput;
        candidate.evaluated = true;

        bytes32[] storage frontier = _frontiers[challengeId];
        for (uint256 i = 0; i < frontier.length; ++i) {
            bytes32 existingId = frontier[i];
            Point storage existing = points[challengeId][existingId];
            if (_dominates(existing, candidate)) {
                emit FrontierDominated(challengeId, artifactId, existingId);
                return;
            }
        }

        uint256 cursor;
        while (cursor < frontier.length) {
            bytes32 existingId = frontier[cursor];
            Point storage existing = points[challengeId][existingId];
            if (_dominates(candidate, existing)) {
                existing.onFrontier = false;
                frontier[cursor] = frontier[frontier.length - 1];
                frontier.pop();
                emit FrontierRemoved(challengeId, existingId, artifactId);
            } else {
                unchecked {
                    ++cursor;
                }
            }
        }

        candidate.onFrontier = true;
        frontier.push(artifactId);
        emit FrontierAdded(challengeId, artifactId, gasPerOrder, parallelThroughput);
    }

    function frontierOf(bytes32 challengeId) external view returns (bytes32[] memory) {
        return _frontiers[challengeId];
    }

    function dominates(bytes32 challengeId, bytes32 leftId, bytes32 rightId) external view returns (bool) {
        return _dominates(points[challengeId][leftId], points[challengeId][rightId]);
    }

    function _dominates(Point storage left, Point storage right) private view returns (bool) {
        bool noWorse = left.gasPerOrder <= right.gasPerOrder && left.parallelThroughput >= right.parallelThroughput;
        bool strictlyBetter = left.gasPerOrder < right.gasPerOrder || left.parallelThroughput > right.parallelThroughput;
        return noWorse && strictlyBetter;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
