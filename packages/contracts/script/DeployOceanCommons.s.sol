// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {FrontierDemoToken} from "../src/FrontierDemoToken.sol";
import {OceanCommonsSettlement} from "../src/OceanCommonsSettlement.sol";

interface OceanDeployVm {
    function envUint(string calldata name) external view returns (uint256 value);
    function envOr(string calldata name, address defaultValue) external view returns (address value);
    function addr(uint256 privateKey) external pure returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys the Ocean Commons settlement and the demo token it pays in.
/// @dev The attestor is the account allowed to publish a match result. It
///      defaults to the deployer so a single run leaves a usable showcase, and
///      `OCEAN_ATTESTOR` overrides it when the evaluator has its own key.
contract DeployOceanCommons {
    OceanDeployVm private constant vm = OceanDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev Practice credits, not money. Minted so the three value pools have
    ///      something to allocate without anyone buying anything.
    uint256 private constant PRACTICE_CREDITS = 30_000 ether;

    event OceanCommonsDeployed(address indexed token, address indexed settlement, address indexed attestor);

    function run() external returns (FrontierDemoToken token, OceanCommonsSettlement settlement) {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(privateKey);
        address attestor = vm.envOr("OCEAN_ATTESTOR", owner);

        vm.startBroadcast(privateKey);
        token = new FrontierDemoToken(owner);
        settlement = new OceanCommonsSettlement(owner, token);
        settlement.setAttestor(attestor);
        token.mint(owner, PRACTICE_CREDITS);
        vm.stopBroadcast();

        emit OceanCommonsDeployed(address(token), address(settlement), attestor);
    }
}
