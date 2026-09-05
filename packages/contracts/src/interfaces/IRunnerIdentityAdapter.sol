// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IRunnerIdentityAdapter {
    function isAuthorized(bytes32 runnerNameHash, address signer, bytes32 requirementHash) external view returns (bool);
}
