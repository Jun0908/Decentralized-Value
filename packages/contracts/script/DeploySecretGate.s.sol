// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SecretGate} from "../src/SecretGate.sol";
import {ISemaphore} from "../src/interfaces/ISemaphore.sol";

interface SecretGateVm {
    function envAddress(string calldata name) external view returns (address value);
    function envUint(string calldata name) external view returns (uint256 value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeploySecretGate {
    SecretGateVm private constant vm =
        SecretGateVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event SecretGateDeployed(
        address indexed gate,
        address indexed semaphore,
        uint256 indexed groupId,
        uint256 message,
        uint256 scope
    );

    function run() external returns (SecretGate gate) {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        ISemaphore semaphore = ISemaphore(vm.envAddress("SEMAPHORE_ADDRESS"));
        uint256 groupId = vm.envUint("SEMAPHORE_GROUP_ID");
        uint256 message = vm.envUint("SECRET_GATE_MESSAGE");
        uint256 scope = vm.envUint("SECRET_GATE_SCOPE");

        vm.startBroadcast(privateKey);
        gate = new SecretGate(semaphore, groupId, message, scope);
        emit SecretGateDeployed(address(gate), address(semaphore), groupId, message, scope);
        vm.stopBroadcast();
    }
}
