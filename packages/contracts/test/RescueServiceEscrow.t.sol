// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {TestBase} from "./TestBase.sol";
import {RescueUSDDemo} from "../src/RescueUSDDemo.sol";
import {RescueServiceEscrow} from "../src/RescueServiceEscrow.sol";

contract RescueServiceEscrowTest is TestBase {
    uint256 private constant UNIT = 1e6;
    bytes32 private constant ORDER_ONE = keccak256("order-one");
    bytes32 private constant ORDER_TWO = keccak256("order-two");
    bytes32 private constant ORDER_THREE = keccak256("order-three");
    bytes32 private constant EPISODE = keccak256("episode-context");
    bytes32 private constant ACTION = keccak256("commander-action");
    bytes32 private constant MANIFEST = keccak256("service-manifest");
    bytes32 private constant DELIVERABLE = keccak256("deliverable");
    bytes32 private constant RECEIPT = keccak256("receipt");
    bytes32 private constant ACCEPTANCE = keccak256("acceptance");
    address private constant COMMANDER = address(0xC0A11);
    address private constant OTHER_COMMANDER = address(0xC0A12);
    address private constant PROVIDER = address(0xA6E17);
    address private constant OUTSIDER = address(0xBAD);
    address private constant EXECUTOR = address(0xE0EC);
    address private constant ATTESTOR = address(0xA77E57);

    RescueUSDDemo private token;
    RescueServiceEscrow private escrow;

    function setUp() external {
        token = new RescueUSDDemo(address(this));
        escrow = new RescueServiceEscrow(
            address(this), token, EXECUTOR, ATTESTOR, 50 * UNIT, 100 * UNIT
        );
        escrow.setProvider(PROVIDER, true);
        token.mint(COMMANDER, 150 * UNIT);
        vm.prank(COMMANDER);
        token.approve(address(escrow), 150 * UNIT);
        token.mint(OTHER_COMMANDER, 100 * UNIT);
        vm.prank(OTHER_COMMANDER);
        token.approve(address(escrow), 100 * UNIT);
    }

    function testTokenUsesFixedDemoIdentityAndSixDecimals() external view {
        assertEq(uint256(token.decimals()), 6);
        assertEq(keccak256(bytes(token.name())), keccak256(bytes("RescueUSD Demo")));
        assertEq(keccak256(bytes(token.symbol())), keccak256(bytes("rUSD-DEMO")));
    }

    function testOnlyTokenOwnerMayMint() external {
        vm.expectRevert(bytes4(keccak256("OwnableUnauthorizedAccount(address)")));
        vm.prank(OUTSIDER);
        token.mint(OUTSIDER, UNIT);
    }

    function testFundsDeliversAndReleasesExactServicePayment() external {
        _fund(ORDER_ONE, 5 * UNIT, uint64(block.timestamp + 1 hours));
        assertEq(token.balanceOf(COMMANDER), 145 * UNIT);
        assertEq(token.balanceOf(address(escrow)), 5 * UNIT);
        assertEq(
            uint256(escrow.orderState(COMMANDER, ORDER_ONE)),
            uint256(RescueServiceEscrow.OrderState.FUNDED)
        );

        _recordDelivery(ORDER_ONE, ATTESTOR);
        vm.prank(EXECUTOR);
        escrow.release(ORDER_ONE, COMMANDER, ACCEPTANCE);

        assertEq(token.balanceOf(PROVIDER), 5 * UNIT);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(
            uint256(escrow.orderState(COMMANDER, ORDER_ONE)),
            uint256(RescueServiceEscrow.OrderState.RELEASED)
        );
        assertEq(escrow.episodeCommitted(COMMANDER, EPISODE), 5 * UNIT);
    }

    function testProviderMayRecordItsOwnDeliverableButCannotReplaceIt() external {
        _fund(ORDER_ONE, 5 * UNIT, uint64(block.timestamp + 1 hours));
        _recordDelivery(ORDER_ONE, PROVIDER);

        vm.expectRevert(RescueServiceEscrow.InvalidOrderState.selector);
        _recordDelivery(ORDER_ONE, PROVIDER);
    }

    function testRejectsDuplicateOrderAndUnknownProvider() external {
        _fund(ORDER_ONE, 5 * UNIT, uint64(block.timestamp + 1 hours));
        vm.expectRevert(RescueServiceEscrow.OrderAlreadyExists.selector);
        _fund(ORDER_ONE, 5 * UNIT, uint64(block.timestamp + 1 hours));

        vm.expectRevert(RescueServiceEscrow.ProviderNotAllowed.selector);
        vm.prank(COMMANDER);
        escrow.fundOrder(
            ORDER_TWO,
            OUTSIDER,
            5 * UNIT,
            uint64(block.timestamp + 1 hours),
            EPISODE,
            ACTION,
            MANIFEST
        );
    }

    function testScopesDeterministicOrderIdsByCommanderWallet() external {
        _fund(ORDER_ONE, 5 * UNIT, uint64(block.timestamp + 1 hours));
        vm.prank(OTHER_COMMANDER);
        escrow.fundOrder(
            ORDER_ONE,
            PROVIDER,
            5 * UNIT,
            uint64(block.timestamp + 1 hours),
            EPISODE,
            ACTION,
            MANIFEST
        );

        assertEq(
            uint256(escrow.orderState(COMMANDER, ORDER_ONE)),
            uint256(RescueServiceEscrow.OrderState.FUNDED)
        );
        assertEq(
            uint256(escrow.orderState(OTHER_COMMANDER, ORDER_ONE)),
            uint256(RescueServiceEscrow.OrderState.FUNDED)
        );
    }

    function testRejectsOrderAndEpisodeOverspend() external {
        vm.expectRevert(RescueServiceEscrow.OrderAmountExceeded.selector);
        _fund(ORDER_ONE, 51 * UNIT, uint64(block.timestamp + 1 hours));

        _fund(ORDER_ONE, 50 * UNIT, uint64(block.timestamp + 1 hours));
        _fund(ORDER_TWO, 50 * UNIT, uint64(block.timestamp + 1 hours));
        vm.expectRevert(RescueServiceEscrow.EpisodeAmountExceeded.selector);
        _fund(ORDER_THREE, UNIT, uint64(block.timestamp + 1 hours));
    }

    function testRejectsUnattestedOrDuplicateRelease() external {
        _fund(ORDER_ONE, 5 * UNIT, uint64(block.timestamp + 1 hours));
        vm.expectRevert(RescueServiceEscrow.InvalidOrderState.selector);
        vm.prank(EXECUTOR);
        escrow.release(ORDER_ONE, COMMANDER, ACCEPTANCE);

        vm.expectRevert(RescueServiceEscrow.UnauthorizedDeliveryReporter.selector);
        _recordDelivery(ORDER_ONE, OUTSIDER);

        _recordDelivery(ORDER_ONE, ATTESTOR);
        vm.prank(EXECUTOR);
        escrow.release(ORDER_ONE, COMMANDER, ACCEPTANCE);
        vm.expectRevert(RescueServiceEscrow.InvalidOrderState.selector);
        vm.prank(EXECUTOR);
        escrow.release(ORDER_ONE, COMMANDER, ACCEPTANCE);
    }

    function testRejectsDeliverableBoundToAnotherContextOrProvider() external {
        _fund(ORDER_ONE, 5 * UNIT, uint64(block.timestamp + 1 hours));
        vm.expectRevert(RescueServiceEscrow.DeliveryBindingMismatch.selector);
        vm.prank(ATTESTOR);
        escrow.recordDelivery(
            ORDER_ONE,
            COMMANDER,
            PROVIDER,
            keccak256("different-episode"),
            ACTION,
            MANIFEST,
            DELIVERABLE,
            RECEIPT
        );

        vm.expectRevert(RescueServiceEscrow.DeliveryBindingMismatch.selector);
        vm.prank(ATTESTOR);
        escrow.recordDelivery(
            ORDER_ONE, COMMANDER, OUTSIDER, EPISODE, ACTION, MANIFEST, DELIVERABLE, RECEIPT
        );
    }

    function testRefundsOnlyAfterTimeoutAndRestoresEpisodeCapacity() external {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        _fund(ORDER_ONE, 50 * UNIT, deadline);
        _fund(ORDER_TWO, 50 * UNIT, deadline);

        vm.expectRevert(RescueServiceEscrow.DeadlineNotReached.selector);
        escrow.refundExpired(ORDER_ONE, COMMANDER);

        vm.warp(uint256(deadline) + 1);
        vm.prank(OUTSIDER);
        escrow.refundExpired(ORDER_ONE, COMMANDER);
        assertEq(token.balanceOf(COMMANDER), 100 * UNIT);
        assertEq(escrow.episodeCommitted(COMMANDER, EPISODE), 50 * UNIT);
        assertEq(
            uint256(escrow.orderState(COMMANDER, ORDER_ONE)),
            uint256(RescueServiceEscrow.OrderState.REFUNDED)
        );

        _fund(ORDER_THREE, 50 * UNIT, uint64(block.timestamp + 1 hours));
        vm.expectRevert(RescueServiceEscrow.InvalidOrderState.selector);
        _recordDelivery(ORDER_ONE, ATTESTOR);
    }

    function testRefundsAnUnreleasedDeliveryAfterTimeout() external {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        _fund(ORDER_ONE, 5 * UNIT, deadline);
        _recordDelivery(ORDER_ONE, ATTESTOR);

        vm.warp(uint256(deadline) + 1);
        escrow.refundExpired(ORDER_ONE, COMMANDER);
        assertEq(token.balanceOf(COMMANDER), 150 * UNIT);
        assertEq(escrow.episodeCommitted(COMMANDER, EPISODE), 0);
        assertEq(
            uint256(escrow.orderState(COMMANDER, ORDER_ONE)),
            uint256(RescueServiceEscrow.OrderState.REFUNDED)
        );
    }

    function testRejectsDeliveryAfterDeadline() external {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        _fund(ORDER_ONE, 5 * UNIT, deadline);
        vm.warp(uint256(deadline) + 1);

        vm.expectRevert(RescueServiceEscrow.DeliveryDeadlinePassed.selector);
        _recordDelivery(ORDER_ONE, ATTESTOR);
    }

    function _fund(bytes32 orderId, uint256 amount, uint64 deadline) private {
        vm.prank(COMMANDER);
        escrow.fundOrder(orderId, PROVIDER, amount, deadline, EPISODE, ACTION, MANIFEST);
    }

    function _recordDelivery(bytes32 orderId, address reporter) private {
        vm.prank(reporter);
        escrow.recordDelivery(
            orderId, COMMANDER, PROVIDER, EPISODE, ACTION, MANIFEST, DELIVERABLE, RECEIPT
        );
    }
}
