// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IArtifactRegistry} from "./interfaces/IArtifactRegistry.sol";
import {IChallengeRegistry} from "./interfaces/IChallengeRegistry.sol";

contract ArtifactRegistry is IArtifactRegistry, Ownable, Pausable {
    IChallengeRegistry public immutable challengeRegistry;
    mapping(bytes32 artifactId => Artifact artifact) private _artifacts;

    error ArtifactAlreadyExists();
    error ArtifactNotFound();
    error ChallengeInactive();
    error InvalidArtifact();

    event ArtifactRegistered(
        bytes32 indexed artifactId,
        bytes32 indexed challengeId,
        bytes32 indexed artifactHash,
        address author,
        bytes32 sourceCommitHash,
        string version,
        string license,
        string metadataURI
    );

    constructor(address initialOwner, IChallengeRegistry challengeRegistry_) Ownable(initialOwner) {
        if (address(challengeRegistry_) == address(0)) revert InvalidArtifact();
        challengeRegistry = challengeRegistry_;
    }

    function registerArtifact(
        bytes32 challengeId,
        bytes32 artifactHash,
        bytes32 sourceCommitHash,
        string calldata version,
        string calldata license,
        string calldata metadataURI
    ) external whenNotPaused returns (bytes32 artifactId) {
        if (
            artifactHash == bytes32(0) || sourceCommitHash == bytes32(0) || bytes(version).length == 0
                || bytes(license).length == 0 || bytes(metadataURI).length == 0
        ) revert InvalidArtifact();
        IChallengeRegistry.Challenge memory challenge = challengeRegistry.getChallenge(challengeId);
        if (!challenge.active) revert ChallengeInactive();

        artifactId = keccak256(abi.encode(challengeId, artifactHash, msg.sender, sourceCommitHash));
        if (_artifacts[artifactId].author != address(0)) revert ArtifactAlreadyExists();
        _artifacts[artifactId] = Artifact({
            challengeId: challengeId,
            artifactHash: artifactHash,
            sourceCommitHash: sourceCommitHash,
            author: msg.sender,
            version: version,
            license: license,
            metadataURI: metadataURI
        });
        emit ArtifactRegistered(
            artifactId, challengeId, artifactHash, msg.sender, sourceCommitHash, version, license, metadataURI
        );
    }

    function getArtifact(bytes32 artifactId) external view returns (Artifact memory artifact) {
        artifact = _artifacts[artifactId];
        if (artifact.author == address(0)) revert ArtifactNotFound();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
