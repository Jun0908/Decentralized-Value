// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRunnerIdentityAdapter} from "./interfaces/IRunnerIdentityAdapter.sol";

/// @notice Phase 2 adapter. Phase 3 supplies an ENSv2-backed implementation of the same interface.
contract AllowlistRunnerIdentityAdapter is IRunnerIdentityAdapter, Ownable {
    mapping(bytes32 runnerNameHash => mapping(address signer => mapping(bytes32 requirementHash => bool allowed)))
        private _authorizations;

    event RunnerAuthorizationSet(
        bytes32 indexed runnerNameHash, address indexed signer, bytes32 indexed requirementHash, bool allowed
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setAuthorization(bytes32 runnerNameHash, address signer, bytes32 requirementHash, bool allowed)
        external
        onlyOwner
    {
        require(runnerNameHash != bytes32(0) && signer != address(0) && requirementHash != bytes32(0), "INVALID_RUNNER");
        _authorizations[runnerNameHash][signer][requirementHash] = allowed;
        emit RunnerAuthorizationSet(runnerNameHash, signer, requirementHash, allowed);
    }

    function isAuthorized(bytes32 runnerNameHash, address signer, bytes32 requirementHash)
        external
        view
        returns (bool)
    {
        return _authorizations[runnerNameHash][signer][requirementHash];
    }
}
