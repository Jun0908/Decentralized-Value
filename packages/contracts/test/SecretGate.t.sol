// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {TestBase} from "./TestBase.sol";
import {SecretGate} from "../src/SecretGate.sol";
import {ISemaphore} from "../src/interfaces/ISemaphore.sol";

contract MockSemaphore is ISemaphore {
    mapping(uint256 groupId => mapping(uint256 nullifier => bool used)) public usedNullifiers;
    uint256 public calls;

    error InvalidProof();
    error NullifierAlreadyUsed();

    function validateProof(uint256 groupId, SemaphoreProof calldata proof) external {
        if (proof.merkleTreeRoot == 0) revert InvalidProof();
        if (usedNullifiers[groupId][proof.nullifier]) revert NullifierAlreadyUsed();
        usedNullifiers[groupId][proof.nullifier] = true;
        calls += 1;
    }
}

contract SecretGateTest is TestBase {
    MockSemaphore private semaphore;
    SecretGate private gate;

    uint256 private constant GROUP_ID = 7;
    uint256 private constant MESSAGE = 11;
    uint256 private constant SCOPE = 13;

    function setUp() external {
        semaphore = new MockSemaphore();
        gate = new SecretGate(semaphore, GROUP_ID, MESSAGE, SCOPE);
    }

    function proof(uint256 nullifier) private pure returns (ISemaphore.SemaphoreProof memory value) {
        value.merkleTreeDepth = 3;
        value.merkleTreeRoot = 17;
        value.nullifier = nullifier;
        value.message = MESSAGE;
        value.scope = SCOPE;
    }

    function testValidatesThroughSemaphoreAndRecordsReplayThere() external {
        gate.enter(proof(19));
        assertEq(semaphore.calls(), 1);
        assertTrue(semaphore.usedNullifiers(GROUP_ID, 19));

        vm.expectRevert(MockSemaphore.NullifierAlreadyUsed.selector);
        gate.enter(proof(19));
    }

    function testRejectsWrongApplicationPolicyBeforeVerifierCall() external {
        ISemaphore.SemaphoreProof memory wrongMessage = proof(21);
        wrongMessage.message = 99;
        vm.expectRevert(SecretGate.WrongMessage.selector);
        gate.enter(wrongMessage);

        ISemaphore.SemaphoreProof memory wrongScope = proof(22);
        wrongScope.scope = 99;
        vm.expectRevert(SecretGate.WrongScope.selector);
        gate.enter(wrongScope);

        assertEq(semaphore.calls(), 0);
    }

    function testPropagatesInvalidRootOrProofFailure() external {
        ISemaphore.SemaphoreProof memory invalid = proof(23);
        invalid.merkleTreeRoot = 0;
        vm.expectRevert(MockSemaphore.InvalidProof.selector);
        gate.enter(invalid);
    }
}
