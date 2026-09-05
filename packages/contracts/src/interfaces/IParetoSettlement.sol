// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IParetoSettlement {
    function recordOutcome(bytes32 challengeId, bytes32 artifactId, uint256 gasPerOrder, uint256 parallelThroughput)
        external;
}
