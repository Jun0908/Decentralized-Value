import { emergencySupplyManifestHash } from "@frontier/emergency-supply";
import Link from "next/link";
import { WalletCommitProof } from "@/components/wallet-commit-proof";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;

function shorten(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function SettlementEvidence() {
  const poolAddress = process.env.NEXT_PUBLIC_REWARD_POOL_ADDRESS ?? "";
  const tokenAddress = process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS ?? "";
  const transactionHash = process.env.NEXT_PUBLIC_SETTLEMENT_TX_HASH ?? "";
  const blockNumber = process.env.NEXT_PUBLIC_SETTLEMENT_BLOCK_NUMBER ?? "";
  const allocationHash = process.env.NEXT_PUBLIC_ALLOCATION_TX_HASH ?? "";
  const resultRoot = process.env.NEXT_PUBLIC_RESULT_ROOT ?? "";
  const recipient = process.env.NEXT_PUBLIC_REWARD_RECIPIENT ?? "";
  const rewardAmount = process.env.NEXT_PUBLIC_REWARD_AMOUNT ?? "";
  const balanceBefore = process.env.NEXT_PUBLIC_REWARD_BALANCE_BEFORE ?? "";
  const balanceAfter = process.env.NEXT_PUBLIC_REWARD_BALANCE_AFTER ?? "";
  const deployed =
    ADDRESS.test(poolAddress) &&
    ADDRESS.test(tokenAddress) &&
    HASH.test(transactionHash) &&
    /^\d+$/.test(blockNumber);

  return (
    <section
      className="settlement-evidence"
      id="reward-evidence"
      aria-labelledby="settlement-heading"
    >
      <div>
        <p className="eyebrow">Ethereum settlement evidence</p>
        <h2 id="settlement-heading">
          {deployed
            ? "Demo reward allocation recorded on Sepolia."
            : "Settlement path built; Sepolia activation pending."}
        </h2>
        <p>
          Ethereum fixes the challenge commitment and final allocation, prevents a second commit or
          double claim, and lets anyone verify who received the reward.
        </p>
      </div>
      <div className="settlement-proof-stack">
        {deployed ? (
          <dl className="settlement-record">
            <div>
              <dt>Status</dt>
              <dd className="status-good">Recorded on Sepolia</dd>
            </div>
            <div>
              <dt>Reward pool</dt>
              <dd>
                <a href={`https://sepolia.etherscan.io/address/${poolAddress}`}>
                  {shorten(poolAddress)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Demo token</dt>
              <dd>
                <a href={`https://sepolia.etherscan.io/address/${tokenAddress}`}>
                  {shorten(tokenAddress)}
                </a>
              </dd>
            </div>
            {HASH.test(resultRoot) ? (
              <div>
                <dt>Final result root</dt>
                <dd>{shorten(resultRoot)}</dd>
              </div>
            ) : null}
            {HASH.test(allocationHash) ? (
              <div>
                <dt>Allocation commitment</dt>
                <dd>
                  <a href={`https://sepolia.etherscan.io/tx/${allocationHash}`}>
                    {shorten(allocationHash)}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>RewardPaid tx / block</dt>
              <dd>
                <a href={`https://sepolia.etherscan.io/tx/${transactionHash}`}>
                  {shorten(transactionHash)} · #{blockNumber}
                </a>
              </dd>
            </div>
            {ADDRESS.test(recipient) && rewardAmount && balanceBefore && balanceAfter ? (
              <div>
                <dt>Recipient balance</dt>
                <dd>
                  <a href={`https://sepolia.etherscan.io/address/${recipient}`}>
                    {balanceBefore} → {balanceAfter} · +{rewardAmount}
                  </a>
                </dd>
              </div>
            ) : null}
            <div className="settlement-demo-note">
              <dt>Scope</dt>
              <dd>
                Sepolia demonstration payout to the deployer wallet—not a completed public
                tournament.
              </dd>
            </div>
          </dl>
        ) : (
          <div className="settlement-pending">
            <span>NOT DEPLOYED</span>
            <strong>No funded pool or payout transaction is claimed.</strong>
            <p>
              The tested contracts are ready for a credentialed Sepolia deployment. Until verified
              addresses and a transaction are configured, practice rewards remain credits only.
            </p>
            <div className="actions">
              <a
                className="secondary-action"
                href="https://github.com/Jun0908/Decentralized-Value/blob/main/packages/contracts/src/FrontierRewardPool.sol"
              >
                Inspect reward contract
              </a>
              <Link className="secondary-action" href="/architecture">
                View architecture
              </Link>
            </div>
          </div>
        )}
        <WalletCommitProof manifestHash={emergencySupplyManifestHash} />
      </div>
    </section>
  );
}
