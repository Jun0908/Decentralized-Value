// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TestBase} from "./TestBase.sol";
import {ArtifactRegistry} from "../src/ArtifactRegistry.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {IArtifactRegistry} from "../src/interfaces/IArtifactRegistry.sol";
import {IChallengeRegistry} from "../src/interfaces/IChallengeRegistry.sol";

contract RegistryTest is TestBase {
    ChallengeRegistry private challenges;
    ArtifactRegistry private artifacts;
    bytes32 private constant CHALLENGE_ID = keccak256("challenge/orderbook/v1");

    function setUp() external {
        challenges = new ChallengeRegistry(address(this));
        artifacts = new ArtifactRegistry(address(this), challenges);
    }

    function testRegisterChallengeAndArtifact() external {
        _registerChallenge();
        bytes32 artifactId = artifacts.registerArtifact(
            CHALLENGE_ID, keccak256("bytecode"), keccak256("commit"), "1.0.0", "MIT", "ipfs://artifact"
        );
        IArtifactRegistry.Artifact memory artifact = artifacts.getArtifact(artifactId);
        assertEq(artifact.challengeId, CHALLENGE_ID);
        assertEq(artifact.author, address(this));
        assertEq(artifact.artifactHash, keccak256("bytecode"));
    }

    function testRejectsDuplicateChallengeAndUnknownArtifact() external {
        _registerChallenge();
        vm.expectRevert(ChallengeRegistry.ChallengeAlreadyExists.selector);
        _registerChallenge();
        vm.expectRevert(ArtifactRegistry.ArtifactNotFound.selector);
        artifacts.getArtifact(bytes32(uint256(999)));
    }

    function testOnlyOwnerCanRegisterChallengeOrPause() external {
        address stranger = address(0xBEEF);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        _registerChallenge();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        challenges.pause();
    }

    function testInactiveChallengeRejectsArtifact() external {
        _registerChallenge();
        challenges.setChallengeActive(CHALLENGE_ID, false);
        vm.expectRevert(ArtifactRegistry.ChallengeInactive.selector);
        artifacts.registerArtifact(
            CHALLENGE_ID, keccak256("bytecode"), keccak256("commit"), "1.0.0", "MIT", "ipfs://artifact"
        );
    }

    function _registerChallenge() private {
        challenges.registerChallenge(
            CHALLENGE_ID,
            keccak256("orderbook"),
            keccak256("context"),
            keccak256("constraints"),
            keccak256("runner-requirements"),
            "ipfs://challenge"
        );
    }
}
