// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {TestBase} from "./TestBase.sol";
import {FrontierDemoToken} from "../src/FrontierDemoToken.sol";
import {OceanCommonsSettlement} from "../src/OceanCommonsSettlement.sol";

/// @dev The tests worth having here are the ones that pin the claim: three
///      outcomes settle separately, several entries survive at once, and a
///      season's worth of luck cannot be paid out on.
contract OceanCommonsSettlementTest is TestBase {
    bytes32 private constant MATCH_ONE = keccak256("ocean-match-one");
    bytes32 private constant WORK = keccak256("work-the-season");
    bytes32 private constant FILL = keccak256("fill-the-hold");
    bytes32 private constant HOLD = keccak256("hold-back");

    address private constant ATTESTOR = address(0xA77E57);
    address private constant SKIPPER_ONE = address(0x51A1);
    address private constant SKIPPER_TWO = address(0x51A2);
    address private constant OUTSIDER = address(0xBAD);

    FrontierDemoToken private token;
    OceanCommonsSettlement private settlement;

    function setUp() external {
        token = new FrontierDemoToken(address(this));
        settlement = new OceanCommonsSettlement(address(this), token);
        settlement.setAttestor(ATTESTOR);
        token.mint(address(this), 9_000 ether);
        token.approve(address(settlement), type(uint256).max);
    }

    function _record(bytes32 entryId, uint256 livelihood, uint256 restraint, uint256 cooperation) private {
        uint256[3] memory outcomes = [livelihood, restraint, cooperation];
        uint8[3] memory seasonsWon = [uint8(2), uint8(2), uint8(3)];
        vm.prank(ATTESTOR);
        settlement.recordEntry(MATCH_ONE, entryId, 7, outcomes, seasonsWon);
    }

    /// Three approaches, none of which beats another on all three outcomes.
    function _recordThree() private {
        _record(WORK, 304, 220, 41);
        _record(FILL, 267, 0, 0);
        _record(HOLD, 317, 450, 59);
    }

    function test_seals_a_match_and_keeps_every_undominated_entry() external {
        _recordThree();
        vm.prank(ATTESTOR);
        settlement.sealMatch(MATCH_ONE);

        bytes32[] memory frontier = settlement.frontierOf(MATCH_ONE);

        // Hold back leads on all three, so it survives; Work the season is
        // behind on every one of them and is dominated. The contract makes no
        // further statement about which of the survivors is better.
        assertEq(frontier.length, 1);
        assertEq(frontier[0], HOLD);
    }

    function test_several_entries_survive_when_each_leads_somewhere() external {
        _record(WORK, 304, 220, 90);
        _record(FILL, 500, 10, 5);
        _record(HOLD, 317, 450, 59);
        vm.prank(ATTESTOR);
        settlement.sealMatch(MATCH_ONE);

        bytes32[] memory frontier = settlement.frontierOf(MATCH_ONE);

        // Each leads on something, so nothing dominates anything: the partial
        // order leaves all three standing, which is the arena's whole claim.
        assertEq(frontier.length, 3);
    }

    function test_three_outcomes_can_back_three_different_entries() external {
        _record(WORK, 304, 220, 90);
        _record(FILL, 500, 10, 5);
        _record(HOLD, 317, 450, 59);
        vm.prank(ATTESTOR);
        settlement.sealMatch(MATCH_ONE);

        settlement.supportOutcome(MATCH_ONE, settlement.LIVELIHOOD(), FILL, SKIPPER_ONE, 1_000 ether);
        settlement.supportOutcome(MATCH_ONE, settlement.RESTRAINT(), HOLD, SKIPPER_TWO, 1_000 ether);
        settlement.supportOutcome(MATCH_ONE, settlement.COOPERATION(), WORK, SKIPPER_ONE, 500 ether);

        // Nothing reconciles the three funders, and nothing needs to.
        assertEq(settlement.supportedBy(MATCH_ONE, settlement.LIVELIHOOD()), FILL);
        assertEq(settlement.supportedBy(MATCH_ONE, settlement.RESTRAINT()), HOLD);
        assertEq(settlement.supportedBy(MATCH_ONE, settlement.COOPERATION()), WORK);
        assertEq(settlement.claimable(MATCH_ONE, SKIPPER_ONE), 1_500 ether);

        vm.prank(SKIPPER_ONE);
        settlement.claim(MATCH_ONE);
        assertEq(token.balanceOf(SKIPPER_ONE), 1_500 ether);
        assertEq(settlement.claimable(MATCH_ONE, SKIPPER_ONE), 0);
    }

    function test_refuses_to_settle_on_fewer_than_three_seasons() external {
        uint256[3] memory outcomes = [uint256(304), 220, 41];
        uint8[3] memory seasonsWon = [uint8(1), uint8(1), uint8(1)];

        // One season is mostly the draw, so a result taken from one is the
        // weather rather than the skipper.
        vm.prank(ATTESTOR);
        vm.expectRevert(OceanCommonsSettlement.TooFewSeasons.selector);
        settlement.recordEntry(MATCH_ONE, WORK, 1, outcomes, seasonsWon);
    }

    function test_only_the_attestor_records_and_only_once() external {
        uint256[3] memory outcomes = [uint256(304), 220, 41];
        uint8[3] memory seasonsWon = [uint8(2), uint8(2), uint8(3)];

        vm.prank(OUTSIDER);
        vm.expectRevert(OceanCommonsSettlement.UnauthorizedAttestor.selector);
        settlement.recordEntry(MATCH_ONE, WORK, 7, outcomes, seasonsWon);

        _record(WORK, 304, 220, 41);
        vm.prank(ATTESTOR);
        vm.expectRevert(OceanCommonsSettlement.AlreadyRecorded.selector);
        settlement.recordEntry(MATCH_ONE, WORK, 7, outcomes, seasonsWon);
    }

    function test_a_sealed_match_cannot_be_rewritten() external {
        _recordThree();
        vm.prank(ATTESTOR);
        settlement.sealMatch(MATCH_ONE);

        uint256[3] memory outcomes = [uint256(999), 999, 999];
        uint8[3] memory seasonsWon = [uint8(7), uint8(7), uint8(7)];
        vm.prank(ATTESTOR);
        vm.expectRevert(OceanCommonsSettlement.AlreadySealed.selector);
        settlement.recordEntry(MATCH_ONE, keccak256("late-entry"), 7, outcomes, seasonsWon);
    }

    function test_payouts_wait_for_the_match_to_close() external {
        _recordThree();
        // Read the constant first: expectRevert applies to the very next call,
        // and an argument that is itself a staticcall would consume it.
        uint256 restraint = settlement.RESTRAINT();

        vm.expectRevert(OceanCommonsSettlement.MatchNotSealed.selector);
        settlement.supportOutcome(MATCH_ONE, restraint, HOLD, SKIPPER_TWO, 100 ether);
    }

    function test_keeps_the_season_counts_that_separate_skill_from_luck() external {
        _recordThree();
        vm.prank(ATTESTOR);
        settlement.sealMatch(MATCH_ONE);

        (uint256[3] memory outcomes, uint8[3] memory seasonsWon, bool onFrontier) =
            settlement.entryOf(MATCH_ONE, HOLD);

        // A median alone cannot say whether a lead was a habit or one good
        // season, so the counts are published beside it.
        assertEq(outcomes[settlement.RESTRAINT()], 450);
        assertEq(seasonsWon[settlement.COOPERATION()], 3);
        assertTrue(onFrontier);
    }
}
