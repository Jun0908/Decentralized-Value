// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IChallengeRegistry} from "./interfaces/IChallengeRegistry.sol";

contract ChallengeRegistry is IChallengeRegistry, Ownable, Pausable {
    mapping(bytes32 challengeId => Challenge challenge) private _challenges;

    error ChallengeAlreadyExists();
    error ChallengeNotFound();
    error InvalidChallenge();

    event ChallengeRegistered(
        bytes32 indexed challengeId,
        bytes32 indexed artifactTypeHash,
        bytes32 contextHash,
        bytes32 constraintSpecHash,
        bytes32 runnerRequirementHash,
        string metadataURI
    );
    event ChallengeStatusChanged(bytes32 indexed challengeId, bool active);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerChallenge(
        bytes32 challengeId,
        bytes32 artifactTypeHash,
        bytes32 contextHash,
        bytes32 constraintSpecHash,
        bytes32 runnerRequirementHash,
        string calldata metadataURI
    ) external onlyOwner whenNotPaused {
        if (
            challengeId == bytes32(0) || artifactTypeHash == bytes32(0) || contextHash == bytes32(0)
                || constraintSpecHash == bytes32(0) || runnerRequirementHash == bytes32(0)
                || bytes(metadataURI).length == 0
        ) revert InvalidChallenge();
        if (_challenges[challengeId].artifactTypeHash != bytes32(0)) revert ChallengeAlreadyExists();

        _challenges[challengeId] = Challenge({
            artifactTypeHash: artifactTypeHash,
            contextHash: contextHash,
            constraintSpecHash: constraintSpecHash,
            runnerRequirementHash: runnerRequirementHash,
            metadataURI: metadataURI,
            active: true
        });
        emit ChallengeRegistered(
            challengeId, artifactTypeHash, contextHash, constraintSpecHash, runnerRequirementHash, metadataURI
        );
    }

    function setChallengeActive(bytes32 challengeId, bool active) external onlyOwner {
        if (_challenges[challengeId].artifactTypeHash == bytes32(0)) revert ChallengeNotFound();
        _challenges[challengeId].active = active;
        emit ChallengeStatusChanged(challengeId, active);
    }

    function getChallenge(bytes32 challengeId) external view returns (Challenge memory challenge) {
        challenge = _challenges[challengeId];
        if (challenge.artifactTypeHash == bytes32(0)) revert ChallengeNotFound();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
