// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IChallengeRegistry {
    struct Challenge {
        bytes32 artifactTypeHash;
        bytes32 contextHash;
        bytes32 constraintSpecHash;
        bytes32 runnerRequirementHash;
        string metadataURI;
        bool active;
    }

    function getChallenge(bytes32 challengeId) external view returns (Challenge memory);
}
