import type { Metadata } from "next";
import Link from "next/link";
import { SettlementEvidence } from "@/components/settlement-evidence";

const github = "https://github.com/Jun0908/Decentralized-Value";

export const metadata: Metadata = {
  title: "Architecture & Evidence | Value Decentralization",
  description:
    "How Frontier Protocol connects public challenge data to deterministic evaluation and Ethereum settlement.",
};

export default function ArchitecturePage() {
  return (
    <main className="page-shell architecture-page">
      <Link className="back-link" href="/">
        ← Back to live demo
      </Link>
      <header className="architecture-heading">
        <p className="eyebrow">Architecture and trust boundaries</p>
        <h1>Every result can be traced from public input to reward.</h1>
        <p>
          Measurement happens offchain because every failure case must be computed efficiently.
          Commitments and rewards belong on Ethereum because no sponsor should be able to rewrite
          the final result after seeing who won.
        </p>
      </header>

      <section className="architecture-flow" aria-labelledby="architecture-flow-heading">
        <h2 id="architecture-flow-heading">The complete evidence path</h2>
        <ol>
          <li>
            <span>01</span>
            <strong>Challenge manifest</strong>
            <p>Dataset, constraints, metric directions, and lifecycle are published.</p>
            <code>manifestHash</code>
          </li>
          <li>
            <span>02</span>
            <strong>Builder solution</strong>
            <p>A human or agent submits allocation values against one context.</p>
            <code>contextHash</code>
          </li>
          <li>
            <span>03</span>
            <strong>Deterministic evaluator</strong>
            <p>Correctness, every independent axis, and Frontier contribution are recalculated.</p>
            <code>resultHash</code>
          </li>
          <li>
            <span>04</span>
            <strong>Reward allocation</strong>
            <p>Exclusive contribution converts a fixed pool into participant amounts.</p>
            <code>allocationRoot</code>
          </li>
          <li>
            <span>05</span>
            <strong>Ethereum settlement</strong>
            <p>The pool commits once; each address can receive or claim once.</p>
            <code>transactionHash</code>
          </li>
        </ol>
      </section>

      <section className="hash-relationship" aria-labelledby="hash-heading">
        <div>
          <p className="eyebrow">Hash relationship</p>
          <h2 id="hash-heading">Change an input; change the evidence.</h2>
        </div>
        <div
          className="hash-diagram"
          role="img"
          aria-label="Manifest and context feed the evaluator result, which feeds reward allocation and an Ethereum transaction"
        >
          <span>Dataset</span>
          <b>+</b>
          <span>Constraints</span>
          <b>+</b>
          <span>Metrics</span>
          <b>→</b>
          <span>Context hash</span>
          <b>+</b>
          <span>Solution</span>
          <b>→</b>
          <span>Result hash</span>
          <b>→</b>
          <span>Allocation root</span>
          <b>→</b>
          <span>Sepolia tx</span>
        </div>
      </section>

      <section className="contract-safety" aria-labelledby="contract-safety-heading">
        <div>
          <p className="eyebrow">Settlement invariants</p>
          <h2 id="contract-safety-heading">The contract limits what any operator can change.</h2>
        </div>
        <ul>
          <li>A challenge allocation can be committed only once.</li>
          <li>The committed reward total cannot exceed the funded pool balance.</li>
          <li>A recipient cannot receive the same challenge reward twice.</li>
          <li>
            If batch distribution skips an address, that address retains an individual claim path.
          </li>
        </ul>
      </section>

      <SettlementEvidence />

      <section className="source-map" aria-labelledby="source-map-heading">
        <div>
          <p className="eyebrow">Verify in source</p>
          <h2 id="source-map-heading">Nothing important is hidden behind the interface.</h2>
        </div>
        <div className="trust-links">
          <a href={`${github}/blob/main/packages/emergency-supply/src/index.ts`}>Evaluator →</a>
          <a href={`${github}/blob/main/apps/api/src/index.ts`}>Public API →</a>
          <a href={`${github}/blob/main/packages/contracts/src/FrontierRewardPool.sol`}>
            Reward pool →
          </a>
          <a href={`${github}/blob/main/packages/contracts/test/FrontierRewardPool.t.sol`}>
            Contract tests →
          </a>
        </div>
      </section>
    </main>
  );
}
