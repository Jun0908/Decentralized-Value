// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {TestBase} from "./TestBase.sol";
import {ParetoSettlement} from "../src/ParetoSettlement.sol";

contract ParetoSettlementTest is TestBase {
    ParetoSettlement private settlement;
    bytes32 private constant CHALLENGE = keccak256("challenge");

    function setUp() external {
        settlement = new ParetoSettlement(address(this));
        settlement.setAttestationSubmitter(address(this));
    }

    function testMaintainsFrontierAcrossAddedDominatedAndRemovedPoints() external {
        bytes32 cheap = bytes32(uint256(1));
        bytes32 fast = bytes32(uint256(2));
        bytes32 improvedFast = bytes32(uint256(3));
        settlement.recordOutcome(CHALLENGE, cheap, 80, 200);
        settlement.recordOutcome(CHALLENGE, fast, 120, 800);
        settlement.recordOutcome(CHALLENGE, improvedFast, 100, 900);
        bytes32[] memory frontier = settlement.frontierOf(CHALLENGE);
        assertEq(frontier.length, 2);
        (,,, bool fastOnFrontier) = settlement.points(CHALLENGE, fast);
        (,,, bool improvedOnFrontier) = settlement.points(CHALLENGE, improvedFast);
        assertFalse(fastOnFrontier);
        assertTrue(improvedOnFrontier);
    }

    function testTieRemainsOnFrontierAndDuplicateArtifactReverts() external {
        settlement.recordOutcome(CHALLENGE, bytes32(uint256(1)), 100, 400);
        settlement.recordOutcome(CHALLENGE, bytes32(uint256(2)), 100, 400);
        assertEq(settlement.frontierOf(CHALLENGE).length, 2);
        vm.expectRevert(ParetoSettlement.AlreadyEvaluated.selector);
        settlement.recordOutcome(CHALLENGE, bytes32(uint256(1)), 99, 401);
    }

    function testRejectsZeroAndAcceptsUintMaximumWithoutOverflow() external {
        vm.expectRevert(ParetoSettlement.InvalidMetric.selector);
        settlement.recordOutcome(CHALLENGE, bytes32(uint256(1)), 0, 1);
        settlement.recordOutcome(CHALLENGE, bytes32(uint256(2)), type(uint256).max, type(uint256).max);
        assertEq(settlement.frontierOf(CHALLENGE).length, 1);
    }

    function testFuzzDominatingCandidateReplacesExisting(uint128 gasSeed, uint128 throughputSeed) external {
        uint256 gasValue = uint256(gasSeed) + 2;
        uint256 throughput = uint256(throughputSeed) + 1;
        bytes32 oldArtifact = bytes32(uint256(1));
        bytes32 newArtifact = bytes32(uint256(2));
        settlement.recordOutcome(CHALLENGE, oldArtifact, gasValue, throughput);
        settlement.recordOutcome(CHALLENGE, newArtifact, gasValue - 1, throughput);
        bytes32[] memory frontier = settlement.frontierOf(CHALLENGE);
        assertEq(frontier.length, 1);
        assertEq(frontier[0], newArtifact);
    }
}
