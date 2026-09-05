// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IArtifactRegistry {
    struct Artifact {
        bytes32 challengeId;
        bytes32 artifactHash;
        bytes32 sourceCommitHash;
        address author;
        string version;
        string license;
        string metadataURI;
    }

    function getArtifact(bytes32 artifactId) external view returns (Artifact memory);
}
