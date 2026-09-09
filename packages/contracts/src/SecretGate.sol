// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ISemaphore} from "./interfaces/ISemaphore.sol";

contract SecretGate {
    ISemaphore public immutable semaphore;
    uint256 public immutable groupId;
    uint256 public immutable expectedMessage;
    uint256 public immutable expectedScope;

    error WrongMessage();
    error WrongScope();
    error ZeroSemaphore();

    event GateEntered(uint256 indexed groupId, uint256 indexed nullifier, uint256 merkleTreeRoot);

    constructor(ISemaphore semaphore_, uint256 groupId_, uint256 message_, uint256 scope_) {
        if (address(semaphore_) == address(0)) revert ZeroSemaphore();
        semaphore = semaphore_;
        groupId = groupId_;
        expectedMessage = message_;
        expectedScope = scope_;
    }

    function enter(ISemaphore.SemaphoreProof calldata proof) external {
        if (proof.message != expectedMessage) revert WrongMessage();
        if (proof.scope != expectedScope) revert WrongScope();
        semaphore.validateProof(groupId, proof);
        emit GateEntered(groupId, proof.nullifier, proof.merkleTreeRoot);
    }
}
