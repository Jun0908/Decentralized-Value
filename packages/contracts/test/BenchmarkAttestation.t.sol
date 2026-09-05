// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {TestBase} from "./TestBase.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AllowlistRunnerIdentityAdapter} from "../src/AllowlistRunnerIdentityAdapter.sol";
import {ArtifactRegistry} from "../src/ArtifactRegistry.sol";
import {BenchmarkAttestation} from "../src/BenchmarkAttestation.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {ParetoSettlement} from "../src/ParetoSettlement.sol";

contract BenchmarkAttestationTest is TestBase {
    uint256 private constant RUNNER_KEY = 0xA11CE;
    bytes32 private constant CHALLENGE_ID = keccak256("challenge/orderbook/v1");
    bytes32 private constant CONTEXT_HASH = keccak256("context/v1");
    bytes32 private constant CONSTRAINT_HASH = keccak256("constraints/v1");
    bytes32 private constant CONSTRAINT_RESULT_HASH = keccak256("constraints/v1/pass");
    bytes32 private constant REQUIREMENT_HASH = keccak256("runner/orderbook/v1");
    string private constant RUNNER_NAME = "runner.frontier.eth";

    ChallengeRegistry private challenges;
    ArtifactRegistry private artifacts;
    AllowlistRunnerIdentityAdapter private identities;
    ParetoSettlement private settlement;
    BenchmarkAttestation private attestations;
    address private runner;

    function setUp() external {
        vm.warp(1_800_000_000);
        runner = vm.addr(RUNNER_KEY);
        challenges = new ChallengeRegistry(address(this));
        artifacts = new ArtifactRegistry(address(this), challenges);
        identities = new AllowlistRunnerIdentityAdapter(address(this));
        settlement = new ParetoSettlement(address(this));
        attestations = new BenchmarkAttestation(address(this), challenges, artifacts, identities, settlement);
        settlement.setAttestationSubmitter(address(attestations));
        challenges.registerChallenge(
            CHALLENGE_ID, keccak256("orderbook"), CONTEXT_HASH, CONSTRAINT_HASH, REQUIREMENT_HASH, "ipfs://challenge"
        );
        identities.setAuthorization(keccak256(bytes(RUNNER_NAME)), runner, REQUIREMENT_HASH, true);
    }

    function testSignedAttestationUpdatesFrontierAndRejectsReplay() external {
        (BenchmarkAttestation.OutcomeAttestation memory attestation, bytes memory signature) =
            _signedAttestation(_registerArtifact("packed"), keccak256("packed"), 80, 200, block.timestamp, RUNNER_KEY);
        bytes32 digest = attestations.submit(attestation, signature);
        assertTrue(attestations.submittedDigests(digest));
        bytes32[] memory frontier = settlement.frontierOf(CHALLENGE_ID);
        assertEq(frontier.length, 1);
        assertEq(frontier[0], attestation.artifactId);

        vm.expectRevert(BenchmarkAttestation.DuplicateAttestation.selector);
        attestations.submit(attestation, signature);
    }

    function testRejectsUnauthorizedRunnerAndWrongSignature() external {
        uint256 otherKey = 0xB0B;
        (BenchmarkAttestation.OutcomeAttestation memory unauthorized, bytes memory signature) = _signedAttestation(
            _registerArtifact("unauthorized"), keccak256("unauthorized"), 100, 300, block.timestamp, otherKey
        );
        vm.expectRevert(BenchmarkAttestation.UnauthorizedRunner.selector);
        attestations.submit(unauthorized, signature);

        (BenchmarkAttestation.OutcomeAttestation memory valid, bytes memory wrongSignature) = _signedAttestation(
            _registerArtifact("wrong-sig"), keccak256("wrong-sig"), 101, 301, block.timestamp, otherKey
        );
        valid.runnerAddress = runner;
        valid.resultHash = attestations.computeResultHash(valid);
        vm.expectRevert(BenchmarkAttestation.UnauthorizedRunner.selector);
        attestations.submit(valid, wrongSignature);
    }

    function testRejectsExpiredMalformedAndMismatchedPayloads() external {
        (BenchmarkAttestation.OutcomeAttestation memory expired, bytes memory signature) = _signedAttestation(
            _registerArtifact("expired"), keccak256("expired"), 100, 300, block.timestamp - 1 days - 1, RUNNER_KEY
        );
        vm.expectRevert(BenchmarkAttestation.AttestationExpired.selector);
        attestations.submit(expired, signature);

        (BenchmarkAttestation.OutcomeAttestation memory mismatch, bytes memory mismatchSignature) = _signedAttestation(
            _registerArtifact("mismatch"), keccak256("mismatch"), 100, 300, block.timestamp, RUNNER_KEY
        );
        mismatch.contextHash = keccak256("wrong-context");
        vm.expectRevert(BenchmarkAttestation.HashMismatch.selector);
        attestations.submit(mismatch, mismatchSignature);

        (BenchmarkAttestation.OutcomeAttestation memory zeroMetric, bytes memory zeroSignature) =
            _signedAttestation(_registerArtifact("zero"), keccak256("zero"), 100, 300, block.timestamp, RUNNER_KEY);
        zeroMetric.gasPerOrder = 0;
        vm.expectRevert(BenchmarkAttestation.InvalidAttestation.selector);
        attestations.submit(zeroMetric, zeroSignature);

        (BenchmarkAttestation.OutcomeAttestation memory malformed,) = _signedAttestation(
            _registerArtifact("malformed"), keccak256("malformed"), 100, 300, block.timestamp, RUNNER_KEY
        );
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, uint256(2)));
        attestations.submit(malformed, hex"1234");
    }

    function testMultipleSignedResultsMoveTheFrontier() external {
        _submit(_registerArtifact("packed"), keccak256("packed"), 80, 200);
        _submit(_registerArtifact("sharded"), keccak256("sharded"), 150, 800);
        bytes32 improved = _registerArtifact("frontier");
        _submit(improved, keccak256("frontier"), 120, 900);
        bytes32[] memory frontier = settlement.frontierOf(CHALLENGE_ID);
        assertEq(frontier.length, 2);
    }

    function testCanonicalResultHashMatchesTypeScriptVector() external view {
        BenchmarkAttestation.OutcomeAttestation memory vector = BenchmarkAttestation.OutcomeAttestation({
            challengeId: bytes32(uint256(0x1111111111111111111111111111111111111111111111111111111111111111)),
            artifactId: bytes32(uint256(0x2222222222222222222222222222222222222222222222222222222222222222)),
            artifactHash: bytes32(uint256(0x3333333333333333333333333333333333333333333333333333333333333333)),
            contextHash: bytes32(uint256(0x4444444444444444444444444444444444444444444444444444444444444444)),
            constraintSpecHash: bytes32(uint256(0x6666666666666666666666666666666666666666666666666666666666666666)),
            constraintResultHash: bytes32(uint256(0x5555555555555555555555555555555555555555555555555555555555555555)),
            gasPerOrder: 48_321,
            parallelThroughput: 400,
            runnerEnsName: RUNNER_NAME,
            runnerAddress: address(0xaaaa),
            resultHash: bytes32(0),
            issuedAt: 1_800_000_000
        });
        assertEq(
            attestations.computeResultHash(vector), 0x6f957da2559b9e72d99bf5b83b91822fe4a87b40c3c857ad3cf3e7a1d8e50677
        );
    }

    function _submit(bytes32 artifactId, bytes32 artifactHash, uint256 gasPerOrder, uint256 throughput) private {
        (BenchmarkAttestation.OutcomeAttestation memory attestation, bytes memory signature) =
            _signedAttestation(artifactId, artifactHash, gasPerOrder, throughput, block.timestamp, RUNNER_KEY);
        attestations.submit(attestation, signature);
    }

    function _registerArtifact(string memory label) private returns (bytes32) {
        return artifacts.registerArtifact(
            CHALLENGE_ID,
            keccak256(bytes(label)),
            keccak256(abi.encode("commit", label)),
            "1.0.0",
            "MIT",
            "ipfs://artifact"
        );
    }

    function _signedAttestation(
        bytes32 artifactId,
        bytes32 artifactHash,
        uint256 gasPerOrder,
        uint256 throughput,
        uint256 issuedAt,
        uint256 signingKey
    ) private view returns (BenchmarkAttestation.OutcomeAttestation memory attestation, bytes memory signature) {
        attestation = BenchmarkAttestation.OutcomeAttestation({
            challengeId: CHALLENGE_ID,
            artifactId: artifactId,
            artifactHash: artifactHash,
            contextHash: CONTEXT_HASH,
            constraintSpecHash: CONSTRAINT_HASH,
            constraintResultHash: CONSTRAINT_RESULT_HASH,
            gasPerOrder: gasPerOrder,
            parallelThroughput: throughput,
            runnerEnsName: RUNNER_NAME,
            runnerAddress: vm.addr(signingKey),
            resultHash: bytes32(0),
            issuedAt: issuedAt
        });
        attestation.resultHash = attestations.computeResultHash(attestation);
        bytes32 digest = attestations.hashAttestation(attestation);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, digest);
        signature = abi.encodePacked(r, s, v);
    }
}
