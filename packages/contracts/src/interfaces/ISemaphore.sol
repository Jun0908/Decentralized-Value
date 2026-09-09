// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface ISemaphore {
    struct SemaphoreProof {
        uint256 merkleTreeDepth;
        uint256 merkleTreeRoot;
        uint256 nullifier;
        uint256 message;
        uint256 scope;
        uint256[8] points;
    }

    function validateProof(uint256 groupId, SemaphoreProof calldata proof) external;
}
