// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Sepolia-only demonstration token. It makes no monetary-value claim.
contract FrontierDemoToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Frontier Demo Token", "FDT") Ownable(initialOwner) {}

    function mint(address recipient, uint256 amount) external onlyOwner {
        _mint(recipient, amount);
    }
}
