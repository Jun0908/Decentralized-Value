// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IOrderBook} from "./IOrderBook.sol";
import {OrderCodec} from "./OrderCodec.sol";

/// @notice Parallel-oriented design: every mutable key is scoped to one market, at higher storage cost.
contract ShardedBook is IOrderBook {
    struct WideOrder {
        address trader;
        uint256 price;
        uint256 amount;
        Side side;
    }

    mapping(bytes32 marketId => mapping(uint256 index => WideOrder order)) private _orders;
    mapping(bytes32 marketId => uint256 count) private _counts;
    mapping(bytes32 marketId => bytes32 root) private _roots;

    function placeOrder(bytes32 marketId, Side side, uint256 price, uint256 amount) external returns (uint256 index) {
        OrderCodec.validate(price, amount);
        index = _counts[marketId]++;
        _orders[marketId][index] = WideOrder(msg.sender, price, amount, side);
        _roots[marketId] = OrderCodec.appendRoot(_roots[marketId], msg.sender, side, price, amount);
    }

    function orderCount(bytes32 marketId) external view returns (uint256) {
        return _counts[marketId];
    }

    function getOrder(bytes32 marketId, uint256 index) external view returns (Order memory) {
        require(index < _counts[marketId], "ORDER_NOT_FOUND");
        WideOrder storage stored = _orders[marketId][index];
        return Order(stored.trader, stored.side, stored.price, stored.amount);
    }

    function stateRoot(bytes32 marketId) external view returns (bytes32) {
        return _roots[marketId];
    }
}
