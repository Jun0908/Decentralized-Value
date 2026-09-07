// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FrontierRewardPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    uint256 public reserved;

    mapping(bytes32 challengeId => bool committed) public allocationCommitted;
    mapping(bytes32 challengeId => bytes32 resultRoot) public resultRoots;
    mapping(bytes32 challengeId => mapping(address recipient => uint256 amount)) public claimable;
    mapping(bytes32 challengeId => mapping(address recipient => bool assigned)) public allocationAssigned;
    mapping(bytes32 challengeId => mapping(address recipient => bool paid)) public paid;

    error AlreadyCommitted();
    error ArrayLengthMismatch();
    error DuplicateRecipient();
    error InsufficientFunding();
    error NothingToClaim();
    error ZeroRecipient();

    event AllocationCommitted(bytes32 indexed challengeId, bytes32 indexed resultRoot, uint256 total);
    event RewardPaid(bytes32 indexed challengeId, address indexed recipient, uint256 amount);

    constructor(address initialOwner, IERC20 token) Ownable(initialOwner) {
        require(address(token) != address(0), "ZERO_TOKEN");
        rewardToken = token;
    }

    function commitAllocation(
        bytes32 challengeId,
        bytes32 resultRoot,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (allocationCommitted[challengeId]) revert AlreadyCommitted();
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();
        uint256 total;
        for (uint256 i = 0; i < recipients.length; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroRecipient();
            if (allocationAssigned[challengeId][recipient]) revert DuplicateRecipient();
            allocationAssigned[challengeId][recipient] = true;
            claimable[challengeId][recipient] = amounts[i];
            total += amounts[i];
        }
        if (reserved + total > rewardToken.balanceOf(address(this))) revert InsufficientFunding();
        allocationCommitted[challengeId] = true;
        resultRoots[challengeId] = resultRoot;
        reserved += total;
        emit AllocationCommitted(challengeId, resultRoot, total);
    }

    function distribute(bytes32 challengeId, address[] calldata recipients) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < recipients.length; ++i) {
            _pay(challengeId, recipients[i]);
        }
    }

    function claim(bytes32 challengeId) external nonReentrant {
        _pay(challengeId, msg.sender);
    }

    function _pay(bytes32 challengeId, address recipient) private {
        uint256 amount = claimable[challengeId][recipient];
        if (amount == 0 || paid[challengeId][recipient]) revert NothingToClaim();
        paid[challengeId][recipient] = true;
        reserved -= amount;
        rewardToken.safeTransfer(recipient, amount);
        emit RewardPaid(challengeId, recipient, amount);
    }
}
