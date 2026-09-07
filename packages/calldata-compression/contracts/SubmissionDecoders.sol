// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

struct Action {
    address recipient;
    uint64 amount;
    uint32 nonce;
}

abstract contract Digest {
    function append(bytes32 previous, address recipient, uint64 amount, uint32 nonce)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(previous, recipient, amount, nonce));
    }
}

contract AbiDecoder is Digest {
    function decodeAndExecute(bytes calldata encoded) external pure returns (bytes32 digest) {
        Action[] memory actions = abi.decode(encoded, (Action[]));
        for (uint256 i; i < actions.length; ++i) {
            Action memory action = actions[i];
            digest = append(digest, action.recipient, action.amount, action.nonce);
        }
    }
}

contract PackedDecoder is Digest {
    function decodeAndExecute(bytes calldata encoded) external pure returns (bytes32 digest) {
        if (encoded.length == 0) revert("EMPTY");
        uint256 count = uint8(encoded[0]);
        if (encoded.length != 1 + count * 32) revert("LENGTH");

        uint256 cursor = 1;
        for (uint256 i; i < count; ++i) {
            address recipient;
            uint64 amount;
            uint32 nonce;
            assembly ("memory-safe") {
                recipient := shr(96, calldataload(add(encoded.offset, cursor)))
                amount := shr(192, calldataload(add(add(encoded.offset, cursor), 20)))
                nonce := shr(224, calldataload(add(add(encoded.offset, cursor), 28)))
            }
            digest = append(digest, recipient, amount, nonce);
            cursor += 32;
        }
    }
}

contract DictionaryDecoder is Digest {
    function decodeAndExecute(bytes calldata encoded) external pure returns (bytes32 digest) {
        if (encoded.length < 2) revert("EMPTY");
        uint256 dictionaryLength = uint8(encoded[0]);
        if (dictionaryLength == 0) revert("DICTIONARY");

        address[] memory dictionary = new address[](dictionaryLength);
        uint256 cursor = 1;
        if (encoded.length < cursor + dictionaryLength * 20 + 1) revert("LENGTH");
        for (uint256 i; i < dictionaryLength; ++i) {
            address recipient;
            assembly ("memory-safe") {
                recipient := shr(96, calldataload(add(encoded.offset, cursor)))
            }
            dictionary[i] = recipient;
            cursor += 20;
        }

        uint256 count = uint8(encoded[cursor]);
        ++cursor;
        if (encoded.length != cursor + count * 13) revert("LENGTH");
        for (uint256 i; i < count; ++i) {
            uint256 dictionaryIndex = uint8(encoded[cursor]);
            if (dictionaryIndex >= dictionaryLength) revert("INDEX");
            uint64 amount;
            uint32 nonce;
            assembly ("memory-safe") {
                amount := shr(192, calldataload(add(add(encoded.offset, cursor), 1)))
                nonce := shr(224, calldataload(add(add(encoded.offset, cursor), 9)))
            }
            digest = append(digest, dictionary[dictionaryIndex], amount, nonce);
            cursor += 13;
        }
    }
}
