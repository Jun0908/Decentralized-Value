// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IOrderBook {
    enum Side {
        Bid,
        Ask
    }

    struct Order {
        address trader;
        Side side;
        uint256 price;
        uint256 amount;
    }

    function placeOrder(bytes32 marketId, Side side, uint256 price, uint256 amount) external returns (uint256 index);
    function orderCount(bytes32 marketId) external view returns (uint256);
    function getOrder(bytes32 marketId, uint256 index) external view returns (Order memory);
    function stateRoot(bytes32 marketId) external view returns (bytes32);
}
