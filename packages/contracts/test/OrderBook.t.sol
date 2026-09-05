// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {TestBase} from "./TestBase.sol";
import {BadBook} from "../src/orderbook/BadBook.sol";
import {FrontierBook} from "../src/orderbook/FrontierBook.sol";
import {IOrderBook} from "../src/orderbook/IOrderBook.sol";
import {OrderCodec} from "../src/orderbook/OrderCodec.sol";
import {PackedBook} from "../src/orderbook/PackedBook.sol";
import {ShardedBook} from "../src/orderbook/ShardedBook.sol";

contract OrderBookTest is TestBase {
    bytes32 private constant MARKET = keccak256("ETH-USD");

    function testValidArtifactsReachTheSameLogicalState() external {
        IOrderBook packed = new PackedBook();
        IOrderBook sharded = new ShardedBook();
        IOrderBook frontier = new FrontierBook();

        _placeReferenceWorkload(packed);
        _placeReferenceWorkload(sharded);
        _placeReferenceWorkload(frontier);

        assertEq(packed.orderCount(MARKET), 4);
        assertEq(sharded.stateRoot(MARKET), packed.stateRoot(MARKET));
        assertEq(frontier.stateRoot(MARKET), packed.stateRoot(MARKET));
        for (uint256 i = 0; i < 4; ++i) {
            _assertSameOrder(packed.getOrder(MARKET, i), sharded.getOrder(MARKET, i));
            _assertSameOrder(packed.getOrder(MARKET, i), frontier.getOrder(MARKET, i));
        }
    }

    function testBadBookFailsTheCorrectnessConstraint() external {
        IOrderBook referenceBook = new PackedBook();
        IOrderBook bad = new BadBook();
        _placeReferenceWorkload(referenceBook);
        _placeReferenceWorkload(bad);
        assertTrue(referenceBook.stateRoot(MARKET) != bad.stateRoot(MARKET));
        assertEq(bad.getOrder(MARKET, 0).amount, 0);
    }

    function testRevertSemanticsAreShared() external {
        IOrderBook[4] memory books = [
            IOrderBook(address(new PackedBook())),
            IOrderBook(address(new ShardedBook())),
            IOrderBook(address(new FrontierBook())),
            IOrderBook(address(new BadBook()))
        ];
        for (uint256 i = 0; i < books.length; ++i) {
            vm.expectRevert(OrderCodec.InvalidAmount.selector);
            books[i].placeOrder(MARKET, IOrderBook.Side.Bid, 100, 0);
            vm.expectRevert(OrderCodec.PriceOutOfRange.selector);
            books[i].placeOrder(MARKET, IOrderBook.Side.Bid, uint256(1) << 47, 1);
            vm.expectRevert(OrderCodec.AmountOutOfRange.selector);
            books[i].placeOrder(MARKET, IOrderBook.Side.Bid, 1, uint256(type(uint48).max) + 1);
        }
    }

    function testFuzzValidImplementationsAreDeterministic(bytes32 marketId, uint256 priceSeed, uint256 amountSeed)
        external
    {
        uint256 price = priceSeed % (uint256(1) << 47);
        uint256 amount = (amountSeed % type(uint48).max) + 1;
        IOrderBook left = new PackedBook();
        IOrderBook right = new PackedBook();
        left.placeOrder(marketId, IOrderBook.Side.Ask, price, amount);
        right.placeOrder(marketId, IOrderBook.Side.Ask, price, amount);
        assertEq(left.stateRoot(marketId), right.stateRoot(marketId));
        _assertSameOrder(left.getOrder(marketId, 0), right.getOrder(marketId, 0));
    }

    function _placeReferenceWorkload(IOrderBook book) private {
        book.placeOrder(MARKET, IOrderBook.Side.Bid, 3_000, 2);
        book.placeOrder(MARKET, IOrderBook.Side.Ask, 3_010, 4);
        book.placeOrder(MARKET, IOrderBook.Side.Bid, 2_990, 8);
        book.placeOrder(MARKET, IOrderBook.Side.Ask, 3_020, 16);
    }

    function _assertSameOrder(IOrderBook.Order memory left, IOrderBook.Order memory right) private pure {
        assertEq(left.trader, right.trader);
        assertEq(uint256(left.side), uint256(right.side));
        assertEq(left.price, right.price);
        assertEq(left.amount, right.amount);
    }
}

contract OrderBookBenchmark is TestBase {
    event log_named_uint(string key, uint256 value);
    event log_named_bytes32(string key, bytes32 value);

    function testBenchmarkPacked() external {
        _emitBenchmark(new PackedBook(), true);
    }

    function testBenchmarkFrontier() external {
        _emitBenchmark(new FrontierBook(), true);
    }

    function testBenchmarkSharded() external {
        _emitBenchmark(new ShardedBook(), true);
    }

    function testBenchmarkBad() external {
        _emitBenchmark(new BadBook(), false);
    }

    function _emitBenchmark(IOrderBook book, bool expectedCorrectness) private {
        bytes32[8] memory markets = [
            bytes32(uint256(4)),
            bytes32(uint256(5)),
            bytes32(uint256(6)),
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            bytes32(uint256(9)),
            bytes32(uint256(10)),
            bytes32(uint256(11))
        ];
        uint256 beforeGas = gasleft();
        for (uint256 i = 0; i < 32; ++i) {
            book.placeOrder(markets[i % 8], IOrderBook.Side(i % 2), 2_900 + i, 1 + i);
        }
        uint256 gasPerOrder = (beforeGas - gasleft()) / 32;
        bool correct = _check(book, markets);
        assertTrue(correct == expectedCorrectness);
        emit log_named_uint("gasPerOrder", gasPerOrder);
        emit log_named_uint("correctness", correct ? 1 : 0);
        emit log_named_bytes32("constraintResultHash", keccak256(abi.encode(correct, bytes32("orderbook-v1"))));
    }

    function _check(IOrderBook book, bytes32[8] memory markets) private view returns (bool) {
        for (uint256 marketIndex = 0; marketIndex < markets.length; ++marketIndex) {
            if (book.orderCount(markets[marketIndex]) != 4) return false;
            for (uint256 localIndex = 0; localIndex < 4; ++localIndex) {
                uint256 globalIndex = marketIndex + localIndex * 8;
                IOrderBook.Order memory order = book.getOrder(markets[marketIndex], localIndex);
                if (
                    order.trader != address(this) || uint256(order.side) != globalIndex % 2
                        || order.price != 2_900 + globalIndex || order.amount != 1 + globalIndex
                ) return false;
            }
        }
        return true;
    }
}
