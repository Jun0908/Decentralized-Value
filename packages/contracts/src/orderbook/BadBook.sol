// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IOrderBook} from "./IOrderBook.sol";
import {OrderCodec} from "./OrderCodec.sol";

/// @notice Negative control. It intentionally drops `amount`, so correctness must fail closed.
contract BadBook is IOrderBook {
    mapping(bytes32 marketId => mapping(uint256 index => uint256 packedOrder)) private _orders;
    mapping(bytes32 marketId => uint256 count) private _counts;
    mapping(bytes32 marketId => bytes32 root) private _roots;

    function placeOrder(bytes32 marketId, Side side, uint256 price, uint256 amount) external returns (uint256 index) {
        OrderCodec.validate(price, amount);
        index = _counts[marketId]++;
        _orders[marketId][index] = OrderCodec.pack(msg.sender, side, price, 0);
        _roots[marketId] = OrderCodec.appendRoot(_roots[marketId], msg.sender, side, price, 0);
    }

    function orderCount(bytes32 marketId) external view returns (uint256) {
        return _counts[marketId];
    }

    function getOrder(bytes32 marketId, uint256 index) external view returns (Order memory) {
        require(index < _counts[marketId], "ORDER_NOT_FOUND");
        return OrderCodec.unpack(_orders[marketId][index]);
    }

    function stateRoot(bytes32 marketId) external view returns (bytes32) {
        return _roots[marketId];
    }
}
