// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AllowlistRunnerIdentityAdapter} from "../src/AllowlistRunnerIdentityAdapter.sol";
import {ArtifactRegistry} from "../src/ArtifactRegistry.sol";
import {BenchmarkAttestation} from "../src/BenchmarkAttestation.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {ParetoSettlement} from "../src/ParetoSettlement.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256 value);
    function addr(uint256 privateKey) external pure returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event Deployment(
        address challengeRegistry,
        address artifactRegistry,
        address runnerIdentityAdapter,
        address benchmarkAttestation,
        address paretoSettlement
    );

    function run() external {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        ChallengeRegistry challenges = new ChallengeRegistry(owner);
        ArtifactRegistry artifacts = new ArtifactRegistry(owner, challenges);
        AllowlistRunnerIdentityAdapter identities = new AllowlistRunnerIdentityAdapter(owner);
        ParetoSettlement settlement = new ParetoSettlement(owner);
        BenchmarkAttestation attestations =
            new BenchmarkAttestation(owner, challenges, artifacts, identities, settlement);
        settlement.setAttestationSubmitter(address(attestations));

        vm.stopBroadcast();
        emit Deployment(
            address(challenges), address(artifacts), address(identities), address(attestations), address(settlement)
        );
    }
}
