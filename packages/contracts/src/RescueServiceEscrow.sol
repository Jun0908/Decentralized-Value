// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRescueServiceEscrow} from "./interfaces/IRescueServiceEscrow.sol";

/// @notice Escrows one curated Rescue Room service order at a time.
/// @dev The deterministic evaluator validates deliverables offchain. Its attestor records only
/// accepted hashes; the policy executor may release only a recorded delivery.
contract RescueServiceEscrow is IRescueServiceEscrow, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OrderState {
        NONE,
        FUNDED,
        DELIVERED,
        RELEASED,
        REFUNDED
    }

    struct Order {
        address commander;
        address provider;
        bytes32 episodeContextHash;
        bytes32 commanderActionHash;
        bytes32 serviceManifestHash;
        uint256 amount;
        uint64 deadline;
        bytes32 deliverableHash;
        bytes32 receiptHash;
        bytes32 acceptanceHash;
        OrderState state;
    }

    IERC20 public immutable paymentToken;
    uint256 public immutable maximumOrderAmount;
    uint256 public immutable maximumEpisodeAmount;
    address public policyExecutor;
    address public deliveryAttestor;

    mapping(address provider => bool allowed) public allowedProviders;
    mapping(bytes32 orderKey => Order order) private orders;
    mapping(address commander => mapping(bytes32 episodeContextHash => uint256 amount))
        public episodeCommitted;

    error ZeroAddress();
    error ZeroHash();
    error ZeroAmount();
    error ProviderNotAllowed();
    error OrderAlreadyExists();
    error OrderAmountExceeded();
    error EpisodeAmountExceeded();
    error InvalidDeadline();
    error InvalidOrderState();
    error DeliveryBindingMismatch();
    error UnauthorizedDeliveryReporter();
    error UnauthorizedPolicyExecutor();
    error DeliveryDeadlinePassed();
    error DeadlineNotReached();

    event ProviderAuthorizationChanged(address indexed provider, bool allowed);
    event PolicyExecutorChanged(address indexed previousExecutor, address indexed nextExecutor);
    event DeliveryAttestorChanged(address indexed previousAttestor, address indexed nextAttestor);

    constructor(
        address initialOwner,
        IERC20 token,
        address initialPolicyExecutor,
        address initialDeliveryAttestor,
        uint256 orderLimit,
        uint256 episodeLimit
    ) Ownable(initialOwner) {
        if (
            address(token) == address(0) || initialPolicyExecutor == address(0)
                || initialDeliveryAttestor == address(0)
        ) revert ZeroAddress();
        if (orderLimit == 0 || episodeLimit == 0) revert ZeroAmount();
        if (orderLimit > episodeLimit) revert OrderAmountExceeded();
        paymentToken = token;
        policyExecutor = initialPolicyExecutor;
        deliveryAttestor = initialDeliveryAttestor;
        maximumOrderAmount = orderLimit;
        maximumEpisodeAmount = episodeLimit;
    }

    function setProvider(address provider, bool allowed) external onlyOwner {
        if (provider == address(0)) revert ZeroAddress();
        allowedProviders[provider] = allowed;
        emit ProviderAuthorizationChanged(provider, allowed);
    }

    function setPolicyExecutor(address nextExecutor) external onlyOwner {
        if (nextExecutor == address(0)) revert ZeroAddress();
        address previousExecutor = policyExecutor;
        policyExecutor = nextExecutor;
        emit PolicyExecutorChanged(previousExecutor, nextExecutor);
    }

    function setDeliveryAttestor(address nextAttestor) external onlyOwner {
        if (nextAttestor == address(0)) revert ZeroAddress();
        address previousAttestor = deliveryAttestor;
        deliveryAttestor = nextAttestor;
        emit DeliveryAttestorChanged(previousAttestor, nextAttestor);
    }

    function orderKey(address commander, bytes32 orderId) public pure returns (bytes32) {
        return keccak256(abi.encode(commander, orderId));
    }

    function getOrder(address commander, bytes32 orderId) external view returns (Order memory) {
        return orders[orderKey(commander, orderId)];
    }

    function orderState(address commander, bytes32 orderId) external view returns (OrderState) {
        return orders[orderKey(commander, orderId)].state;
    }

    function fundOrder(
        bytes32 orderId,
        address provider,
        uint256 amount,
        uint64 deadline,
        bytes32 episodeContextHash,
        bytes32 commanderActionHash,
        bytes32 serviceManifestHash
    ) external override nonReentrant {
        if (orderId == bytes32(0) || episodeContextHash == bytes32(0)) revert ZeroHash();
        if (commanderActionHash == bytes32(0) || serviceManifestHash == bytes32(0)) {
            revert ZeroHash();
        }
        if (!allowedProviders[provider]) revert ProviderNotAllowed();
        bytes32 key = orderKey(msg.sender, orderId);
        if (orders[key].state != OrderState.NONE) revert OrderAlreadyExists();
        if (amount == 0) revert ZeroAmount();
        if (amount > maximumOrderAmount) revert OrderAmountExceeded();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        uint256 nextEpisodeAmount = episodeCommitted[msg.sender][episodeContextHash] + amount;
        if (nextEpisodeAmount > maximumEpisodeAmount) revert EpisodeAmountExceeded();
        episodeCommitted[msg.sender][episodeContextHash] = nextEpisodeAmount;
        orders[key] = Order({
            commander: msg.sender,
            provider: provider,
            episodeContextHash: episodeContextHash,
            commanderActionHash: commanderActionHash,
            serviceManifestHash: serviceManifestHash,
            amount: amount,
            deadline: deadline,
            deliverableHash: bytes32(0),
            receiptHash: bytes32(0),
            acceptanceHash: bytes32(0),
            state: OrderState.FUNDED
        });
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit ServiceOrderFunded(
            orderId,
            episodeContextHash,
            msg.sender,
            provider,
            address(paymentToken),
            amount,
            deadline,
            commanderActionHash,
            serviceManifestHash
        );
    }

    function recordDelivery(
        bytes32 orderId,
        address commander,
        address provider,
        bytes32 episodeContextHash,
        bytes32 commanderActionHash,
        bytes32 serviceManifestHash,
        bytes32 deliverableHash,
        bytes32 receiptHash
    ) external override {
        Order storage order = orders[orderKey(commander, orderId)];
        if (order.state != OrderState.FUNDED) revert InvalidOrderState();
        if (msg.sender != deliveryAttestor && msg.sender != order.provider) {
            revert UnauthorizedDeliveryReporter();
        }
        if (block.timestamp > order.deadline) revert DeliveryDeadlinePassed();
        if (
            provider != order.provider || episodeContextHash != order.episodeContextHash
                || commanderActionHash != order.commanderActionHash
                || serviceManifestHash != order.serviceManifestHash
        ) revert DeliveryBindingMismatch();
        if (deliverableHash == bytes32(0) || receiptHash == bytes32(0)) revert ZeroHash();
        order.deliverableHash = deliverableHash;
        order.receiptHash = receiptHash;
        order.state = OrderState.DELIVERED;
        emit ServiceDeliverableRecorded(
            orderId,
            order.commander,
            order.provider,
            deliverableHash,
            receiptHash,
            order.serviceManifestHash
        );
    }

    function release(bytes32 orderId, address commander, bytes32 acceptanceHash)
        external
        override
        nonReentrant
    {
        if (msg.sender != policyExecutor) revert UnauthorizedPolicyExecutor();
        Order storage order = orders[orderKey(commander, orderId)];
        if (order.state != OrderState.DELIVERED) revert InvalidOrderState();
        if (acceptanceHash == bytes32(0)) revert ZeroHash();
        order.acceptanceHash = acceptanceHash;
        order.state = OrderState.RELEASED;
        paymentToken.safeTransfer(order.provider, order.amount);
        emit ServicePaymentReleased(
            orderId, order.commander, order.provider, order.amount, acceptanceHash
        );
    }

    /// @notice Anyone may complete a timed-out refund; funds always return to the Commander.
    function refundExpired(bytes32 orderId, address commander) external override nonReentrant {
        Order storage order = orders[orderKey(commander, orderId)];
        if (order.state != OrderState.FUNDED && order.state != OrderState.DELIVERED) {
            revert InvalidOrderState();
        }
        if (block.timestamp <= order.deadline) revert DeadlineNotReached();
        order.state = OrderState.REFUNDED;
        episodeCommitted[order.commander][order.episodeContextHash] -= order.amount;
        paymentToken.safeTransfer(order.commander, order.amount);
        emit ServicePaymentRefunded(orderId, order.commander, order.amount);
    }
}
