// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IOrderBook} from "./IOrderBook.sol";

library OrderCodec {
    uint256 internal constant MAX_PRICE = (uint256(1) << 47) - 1;
    uint256 internal constant MAX_AMOUNT = type(uint48).max;

    error InvalidAmount();
    error PriceOutOfRange();
    error AmountOutOfRange();

    function validate(uint256 price, uint256 amount) internal pure {
        if (amount == 0) revert InvalidAmount();
        if (price > MAX_PRICE) revert PriceOutOfRange();
        if (amount > MAX_AMOUNT) revert AmountOutOfRange();
    }

    function pack(address trader, IOrderBook.Side side, uint256 price, uint256 amount) internal pure returns (uint256) {
        return uint256(uint160(trader)) | (uint256(side) << 160) | (price << 161) | (amount << 208);
    }

    function unpack(uint256 value) internal pure returns (IOrderBook.Order memory order) {
        order.trader = address(uint160(value));
        order.side = IOrderBook.Side((value >> 160) & 1);
        order.price = (value >> 161) & MAX_PRICE;
        order.amount = (value >> 208) & MAX_AMOUNT;
    }

    function appendRoot(bytes32 previous, address trader, IOrderBook.Side side, uint256 price, uint256 amount)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(previous, trader, side, price, amount));
    }
}
