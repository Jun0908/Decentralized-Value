// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {TestBase} from "./TestBase.sol";
import {FrontierDemoToken} from "../src/FrontierDemoToken.sol";
import {FrontierRewardPool} from "../src/FrontierRewardPool.sol";

contract FrontierRewardPoolTest is TestBase {
    FrontierDemoToken private token;
    FrontierRewardPool private pool;
    bytes32 private constant CHALLENGE = keccak256("challenge");
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    function setUp() external {
        token = new FrontierDemoToken(address(this));
        pool = new FrontierRewardPool(address(this), token);
        token.mint(address(pool), 1_000 ether);
    }

    function testCommitsAndDistributesExactAllocation() external {
        address[] memory recipients = new address[](2);
        recipients[0] = ALICE;
        recipients[1] = BOB;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 600 ether;
        amounts[1] = 400 ether;

        pool.commitAllocation(CHALLENGE, keccak256("root"), recipients, amounts);
        assertEq(pool.reserved(), 1_000 ether);
        pool.distribute(CHALLENGE, recipients);
        assertEq(token.balanceOf(ALICE), 600 ether);
        assertEq(token.balanceOf(BOB), 400 ether);
        assertEq(pool.reserved(), 0);
    }

    function testRejectsReplayAndOverAllocation() external {
        address[] memory recipients = new address[](1);
        recipients[0] = ALICE;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_001 ether;
        vm.expectRevert(FrontierRewardPool.InsufficientFunding.selector);
        pool.commitAllocation(CHALLENGE, keccak256("root"), recipients, amounts);

        amounts[0] = 100 ether;
        pool.commitAllocation(CHALLENGE, keccak256("root"), recipients, amounts);
        vm.expectRevert(FrontierRewardPool.AlreadyCommitted.selector);
        pool.commitAllocation(CHALLENGE, keccak256("root"), recipients, amounts);
    }

    function testParticipantCanClaimFallback() external {
        address[] memory recipients = new address[](1);
        recipients[0] = ALICE;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 ether;
        pool.commitAllocation(CHALLENGE, keccak256("root"), recipients, amounts);
        vm.prank(ALICE);
        pool.claim(CHALLENGE);
        assertEq(token.balanceOf(ALICE), 100 ether);
        vm.expectRevert(FrontierRewardPool.NothingToClaim.selector);
        vm.prank(ALICE);
        pool.claim(CHALLENGE);
    }

    function testRejectsDuplicateRecipientEvenWhenFirstAmountIsZero() external {
        address[] memory recipients = new address[](2);
        recipients[0] = ALICE;
        recipients[1] = ALICE;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = 100 ether;

        vm.expectRevert(FrontierRewardPool.DuplicateRecipient.selector);
        pool.commitAllocation(CHALLENGE, keccak256("root"), recipients, amounts);
    }
}
