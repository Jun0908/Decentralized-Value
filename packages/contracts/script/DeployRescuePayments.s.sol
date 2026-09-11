// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RescueUSDDemo} from "../src/RescueUSDDemo.sol";
import {RescueServiceEscrow} from "../src/RescueServiceEscrow.sol";

interface RescuePaymentsVm {
    function envAddress(string calldata name) external view returns (address value);
    function envUint(string calldata name) external view returns (uint256 value);
    function addr(uint256 privateKey) external pure returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys the isolated Sepolia Rescue Room payment showcase.
contract DeployRescuePayments {
    uint256 private constant TOKEN_UNIT = 1e6;
    RescuePaymentsVm private constant vm =
        RescuePaymentsVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event RescuePaymentsDeployed(
        address indexed token,
        address indexed escrow,
        address indexed commander,
        address policyExecutor,
        address deliveryAttestor
    );

    function run() external returns (RescueUSDDemo token, RescueServiceEscrow escrow) {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(privateKey);
        address commander = vm.envAddress("RESCUE_COMMANDER_WALLET");
        address policyExecutor = vm.envAddress("RESCUE_POLICY_EXECUTOR");
        address deliveryAttestor = vm.envAddress("RESCUE_DELIVERY_ATTESTOR");

        vm.startBroadcast(privateKey);
        token = new RescueUSDDemo(owner);
        escrow = new RescueServiceEscrow(
            owner,
            token,
            policyExecutor,
            deliveryAttestor,
            50 * TOKEN_UNIT,
            100 * TOKEN_UNIT
        );
        escrow.setProvider(vm.envAddress("RESCUE_MONITORING_AGENT_WALLET"), true);
        escrow.setProvider(vm.envAddress("RESCUE_TRACE_AUDIT_AGENT_WALLET"), true);
        escrow.setProvider(vm.envAddress("RESCUE_ACCOUNTING_AUDIT_AGENT_WALLET"), true);
        escrow.setProvider(vm.envAddress("RESCUE_SECOND_OPINION_AGENT_WALLET"), true);
        escrow.setProvider(vm.envAddress("RESCUE_PATCH_AGENT_WALLET"), true);
        escrow.setProvider(vm.envAddress("RESCUE_PATCH_VERIFIER_WALLET"), true);
        token.mint(commander, 100 * TOKEN_UNIT);
        emit RescuePaymentsDeployed(
            address(token), address(escrow), commander, policyExecutor, deliveryAttestor
        );
        vm.stopBroadcast();
    }
}
