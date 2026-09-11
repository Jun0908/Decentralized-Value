// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Client-facing interface for the Rescue Room Sepolia payment showcase.
interface IRescueServiceEscrow {
    event ServiceOrderFunded(
        bytes32 indexed orderId,
        bytes32 indexed episodeContextHash,
        address indexed commander,
        address provider,
        address token,
        uint256 amount,
        uint64 deadline,
        bytes32 commanderActionHash,
        bytes32 serviceManifestHash
    );
    event ServiceDeliverableRecorded(
        bytes32 indexed orderId,
        address indexed commander,
        address indexed provider,
        bytes32 deliverableHash,
        bytes32 receiptHash,
        bytes32 serviceManifestHash
    );
    event ServicePaymentReleased(
        bytes32 indexed orderId,
        address indexed commander,
        address indexed provider,
        uint256 amount,
        bytes32 acceptanceHash
    );
    event ServicePaymentRefunded(bytes32 indexed orderId, address indexed commander, uint256 amount);

    function paymentToken() external view returns (IERC20);
    function maximumOrderAmount() external view returns (uint256);
    function maximumEpisodeAmount() external view returns (uint256);

    function fundOrder(
        bytes32 orderId,
        address provider,
        uint256 amount,
        uint64 deadline,
        bytes32 episodeContextHash,
        bytes32 commanderActionHash,
        bytes32 serviceManifestHash
    ) external;

    function recordDelivery(
        bytes32 orderId,
        address commander,
        address provider,
        bytes32 episodeContextHash,
        bytes32 commanderActionHash,
        bytes32 serviceManifestHash,
        bytes32 deliverableHash,
        bytes32 receiptHash
    ) external;
    function release(bytes32 orderId, address commander, bytes32 acceptanceHash) external;
    function refundExpired(bytes32 orderId, address commander) external;
}
