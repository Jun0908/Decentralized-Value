// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IArtifactRegistry} from "./interfaces/IArtifactRegistry.sol";
import {IChallengeRegistry} from "./interfaces/IChallengeRegistry.sol";
import {IParetoSettlement} from "./interfaces/IParetoSettlement.sol";
import {IRunnerIdentityAdapter} from "./interfaces/IRunnerIdentityAdapter.sol";

contract BenchmarkAttestation is EIP712, Ownable, Pausable {
    struct OutcomeAttestation {
        bytes32 challengeId;
        bytes32 artifactId;
        bytes32 artifactHash;
        bytes32 contextHash;
        bytes32 constraintSpecHash;
        bytes32 constraintResultHash;
        uint256 gasPerOrder;
        uint256 parallelThroughput;
        string runnerEnsName;
        address runnerAddress;
        bytes32 resultHash;
        uint256 issuedAt;
    }

    bytes32 public constant OUTCOME_ATTESTATION_TYPEHASH = keccak256(
        "OutcomeAttestation(bytes32 challengeId,bytes32 artifactId,bytes32 artifactHash,bytes32 contextHash,bytes32 constraintSpecHash,bytes32 constraintResultHash,uint256 gasPerOrder,uint256 parallelThroughput,string runnerEnsName,address runnerAddress,bytes32 resultHash,uint256 issuedAt)"
    );
    uint256 public constant MAX_AGE = 1 days;
    uint256 public constant MAX_FUTURE_SKEW = 5 minutes;

    IChallengeRegistry public immutable challengeRegistry;
    IArtifactRegistry public immutable artifactRegistry;
    IRunnerIdentityAdapter public immutable runnerIdentityAdapter;
    IParetoSettlement public immutable settlement;
    mapping(bytes32 digest => bool submitted) public submittedDigests;

    error ArtifactMismatch();
    error AttestationExpired();
    error AttestationFromFuture();
    error ChallengeInactive();
    error DuplicateAttestation();
    error HashMismatch();
    error InvalidAttestation();
    error UnauthorizedRunner();

    event AttestationAccepted(
        bytes32 indexed digest,
        bytes32 indexed challengeId,
        bytes32 indexed artifactId,
        address runner,
        bytes32 resultHash
    );

    constructor(
        address initialOwner,
        IChallengeRegistry challengeRegistry_,
        IArtifactRegistry artifactRegistry_,
        IRunnerIdentityAdapter runnerIdentityAdapter_,
        IParetoSettlement settlement_
    ) EIP712("Frontier Protocol", "1") Ownable(initialOwner) {
        if (
            address(challengeRegistry_) == address(0) || address(artifactRegistry_) == address(0)
                || address(runnerIdentityAdapter_) == address(0) || address(settlement_) == address(0)
        ) revert InvalidAttestation();
        challengeRegistry = challengeRegistry_;
        artifactRegistry = artifactRegistry_;
        runnerIdentityAdapter = runnerIdentityAdapter_;
        settlement = settlement_;
    }

    function submit(OutcomeAttestation calldata attestation, bytes calldata signature)
        external
        whenNotPaused
        returns (bytes32 digest)
    {
        if (
            attestation.challengeId == bytes32(0) || attestation.artifactId == bytes32(0)
                || attestation.artifactHash == bytes32(0) || attestation.contextHash == bytes32(0)
                || attestation.constraintSpecHash == bytes32(0) || attestation.constraintResultHash == bytes32(0)
                || attestation.gasPerOrder == 0 || attestation.parallelThroughput == 0
                || bytes(attestation.runnerEnsName).length == 0 || attestation.runnerAddress == address(0)
                || attestation.resultHash == bytes32(0)
        ) revert InvalidAttestation();
        if (attestation.issuedAt > block.timestamp + MAX_FUTURE_SKEW) revert AttestationFromFuture();
        if (attestation.issuedAt <= block.timestamp && block.timestamp - attestation.issuedAt > MAX_AGE) {
            revert AttestationExpired();
        }

        IChallengeRegistry.Challenge memory challenge = challengeRegistry.getChallenge(attestation.challengeId);
        if (!challenge.active) revert ChallengeInactive();
        if (
            challenge.contextHash != attestation.contextHash
                || challenge.constraintSpecHash != attestation.constraintSpecHash
        ) revert HashMismatch();

        IArtifactRegistry.Artifact memory artifact = artifactRegistry.getArtifact(attestation.artifactId);
        if (artifact.challengeId != attestation.challengeId || artifact.artifactHash != attestation.artifactHash) {
            revert ArtifactMismatch();
        }
        if (computeResultHash(attestation) != attestation.resultHash) revert HashMismatch();

        digest = hashAttestation(attestation);
        if (submittedDigests[digest]) revert DuplicateAttestation();
        if (ECDSA.recover(digest, signature) != attestation.runnerAddress) revert UnauthorizedRunner();
        if (!runnerIdentityAdapter.isAuthorized(
                keccak256(bytes(attestation.runnerEnsName)), attestation.runnerAddress, challenge.runnerRequirementHash
            )) revert UnauthorizedRunner();

        submittedDigests[digest] = true;
        settlement.recordOutcome(
            attestation.challengeId, attestation.artifactId, attestation.gasPerOrder, attestation.parallelThroughput
        );
        emit AttestationAccepted(
            digest, attestation.challengeId, attestation.artifactId, attestation.runnerAddress, attestation.resultHash
        );
    }

    function computeResultHash(OutcomeAttestation calldata attestation) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                attestation.challengeId,
                attestation.artifactId,
                attestation.artifactHash,
                attestation.contextHash,
                attestation.constraintSpecHash,
                attestation.constraintResultHash,
                attestation.gasPerOrder,
                attestation.parallelThroughput,
                attestation.runnerEnsName,
                attestation.runnerAddress,
                attestation.issuedAt
            )
        );
    }

    function hashAttestation(OutcomeAttestation calldata attestation) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                OUTCOME_ATTESTATION_TYPEHASH,
                attestation.challengeId,
                attestation.artifactId,
                attestation.artifactHash,
                attestation.contextHash,
                attestation.constraintSpecHash,
                attestation.constraintResultHash,
                attestation.gasPerOrder,
                attestation.parallelThroughput,
                keccak256(bytes(attestation.runnerEnsName)),
                attestation.runnerAddress,
                attestation.resultHash,
                attestation.issuedAt
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
