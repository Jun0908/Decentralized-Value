// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AllowlistRunnerIdentityAdapter} from "../src/AllowlistRunnerIdentityAdapter.sol";
import {ArtifactRegistry} from "../src/ArtifactRegistry.sol";
import {BenchmarkAttestation} from "../src/BenchmarkAttestation.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {ParetoSettlement} from "../src/ParetoSettlement.sol";
import {FrontierDemoToken} from "../src/FrontierDemoToken.sol";
import {FrontierRewardPool} from "../src/FrontierRewardPool.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256 value);
    function addr(uint256 privateKey) external pure returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event ContractDeployed(bytes32 indexed kind, address indexed deployedAt);

    function run() external {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        ChallengeRegistry challenges = new ChallengeRegistry(owner);
        emit ContractDeployed("CHALLENGE_REGISTRY", address(challenges));
        ArtifactRegistry artifacts = new ArtifactRegistry(owner, challenges);
        emit ContractDeployed("ARTIFACT_REGISTRY", address(artifacts));
        AllowlistRunnerIdentityAdapter identities = new AllowlistRunnerIdentityAdapter(owner);
        emit ContractDeployed("RUNNER_IDENTITY", address(identities));
        ParetoSettlement settlement = new ParetoSettlement(owner);
        emit ContractDeployed("PARETO_SETTLEMENT", address(settlement));
        BenchmarkAttestation attestations =
            new BenchmarkAttestation(owner, challenges, artifacts, identities, settlement);
        emit ContractDeployed("BENCHMARK_ATTESTATION", address(attestations));
        settlement.setAttestationSubmitter(address(attestations));
        FrontierDemoToken demoToken = new FrontierDemoToken(owner);
        emit ContractDeployed("DEMO_TOKEN", address(demoToken));
        FrontierRewardPool rewardPool = new FrontierRewardPool(owner, demoToken);
        emit ContractDeployed("REWARD_POOL", address(rewardPool));
        demoToken.mint(address(rewardPool), 1_000_000 ether);

        vm.stopBroadcast();
    }
}
