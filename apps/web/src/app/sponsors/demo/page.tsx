import type { Metadata } from "next";
import Link from "next/link";
import ens from "../../../../../../Docs/evidence/deployments/ensv2-rescue-demo.json";
import cre from "../../../../../../Docs/evidence/deployments/chainlink-cre-private-pack.json";
import bazantic from "../../../../../../Docs/evidence/deployments/bazantic-rescue-agent-demo.json";
import styles from "../../rescue-room/submission/submission.module.css";

export const metadata: Metadata = { title: "Sponsor demonstrations | Value Decentralization" };

export default function SponsorDemoPage() {
  const baseline = bazantic.proofs[0]!;
  const candidate = bazantic.proofs[1]!;
  return (
    <main className={styles.demo}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>RESCUE ROOM · SPONSOR DEMONSTRATIONS</p>
        <h1>Discover. Evaluate. Preserve the tradeoffs.</h1>
        <p className={styles.lead}>
          ENS discovers a service. Chainlink CRE runs a committed private scenario in local
          simulation. An external AI uses Bazantic MCP to compare strategies—without a weighted
          score.
        </p>
        <p className={styles.note}>
          Recorded execution evidence, September 12, 2026. Opening this page does not run AI, send
          transactions, or execute a new CRE workflow. These are separate integration
          demonstrations, not one completed Final tournament.
        </p>
        <nav className={styles.links} aria-label="Demonstration chapters">
          <a href="#ens">1 · ENS discovery</a>
          <a href="#cre">2 · CRE evaluation</a>
          <a href="#bazantic">3 · AI via Bazantic</a>
          <Link href="/arenas/rescue-room">Play Rescue Room</Link>
        </nav>
      </header>
      <section id="ens" aria-labelledby="ens-title">
        <p className={styles.eyebrow}>01 · ENSv2 · SEPOLIA TRANSACTIONS</p>
        <h2 id="ens-title">A service name with scoped permissions.</h2>
        <div className={styles.flow}>
          <article>
            <span>DISCOVER</span>
            <h3>{ens.parent}</h3>
            <p>
              The dedicated text record resolves an active Rescue practice service. The resolved API
              returned valid, repeatable evaluations.
            </p>
            <code>{ens.recordKey}</code>
          </article>
          <article>
            <span>DELEGATE</span>
            <h3>One record, not the whole name.</h3>
            <p>
              The owner granted a temporary operator permission to activate and pause this service.
              Paused discovery was rejected.
            </p>
          </article>
          <article>
            <span>REVOKE</span>
            <h3>Access ends. The service stays active.</h3>
            <p>
              The owner revoked that permission. A subsequent simulated write reverted. Existing
              unrelated records were not changed.
            </p>
          </article>
        </div>
        <div className={styles.badges}>
          <span>{ens.transactions.length} confirmed transactions</span>
          <span>Final permission: {ens.finalDelegatePermission}</span>
        </div>
        <details>
          <summary>Inspect the onchain steps</summary>
          <ul>
            {ens.transactions.map((tx) => (
              <li key={tx.hash}>
                <span>{tx.label}</span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Block {tx.block} ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
        <p className={styles.note}>
          Recorded check: {ens.checkedAt}. The post-revocation rejection was an eth_call, not
          another transaction. This operator-managed service is not a third-party marketplace or
          service payment.
        </p>
        <div className={styles.links}>
          <a href="/sponsors/demo/evidence/ens" download>
            Download ENS evidence
          </a>
        </div>
      </section>
      <section id="cre" aria-labelledby="cre-title">
        <p className={styles.eyebrow}>02 · CHAINLINK CRE · OFFICIAL CLI SIMULATION</p>
        <h2 id="cre-title">Commit first. Evaluate privately. Reveal and replay.</h2>
        <div className={styles.flow}>
          <article>
            <span>COMMIT</span>
            <h3>A fresh scenario, fixed before execution.</h3>
            <p>
              The public configuration contains a salted commitment and evaluator hash. The seed and
              salt enter through the workflow secret input.
            </p>
          </article>
          <article>
            <span>EVALUATE</span>
            <h3>A confidential handler runs the evaluator.</h3>
            <p>
              Official CRE CLI {cre.cliVersion} / SDK {cre.sdkVersion}. The handler returns a salted
              evaluation receipt, not the unrevealed outcomes.
            </p>
          </article>
          <article>
            <span>REPLAY</span>
            <h3>Independent Node execution agrees.</h3>
            <p>
              The full receipt matched Node. After explicit reveal, the scenario was replayed and
              verified. This demonstration pack is now public.
            </p>
          </article>
        </div>
        <div className={styles.badges}>
          <span>Official simulation: {cre.simulation}</span>
          <span>Receipt match + reveal replay passed</span>
        </div>
        <details>
          <summary>Inspect the commitment and build</summary>
          <p>Scenario commitment</p>
          <code>{cre.commitment}</code>
          <p>Evaluator bundle hash</p>
          <code>{cre.evaluatorBundleHash}</code>
          <p>Executed WASM SHA-256</p>
          <code>{cre.wasmSha256}</code>
        </details>
        <p className={styles.note}>
          Recorded check: {cre.checkedAt}. Local simulation only: no live TEE attestation, no
          onchain commitment, no completed hidden Final, and no reward eligibility.
        </p>
        <div className={styles.links}>
          <a href="/sponsors/demo/evidence/cre" download>
            Download revealed CRE evidence
          </a>
        </div>
      </section>
      <section id="bazantic" aria-labelledby="bazantic-title">
        <p className={styles.eyebrow}>03 · BAZANTIC MCP · REAL EXTERNAL AI EXECUTION</p>
        <h2 id="bazantic-title">An AI changes a strategy. The evidence decides.</h2>
        <p className={styles.lead}>
          The {bazantic.model} agent read the public manifest through Bazantic, then evaluated the
          baseline and a lower-budget candidate on the same episode and context.
        </p>
        <div className={styles.flow}>
          {bazantic.comparison.metrics.map((metric) => (
            <article key={metric.key}>
              <span>
                {metric.direction === "MINIMIZE" ? "LOWER IS BETTER" : "HIGHER IS BETTER"}
              </span>
              <h3>{metric.name}</h3>
              <dl>
                <div>
                  <dt>Baseline</dt>
                  <dd>
                    {metric.a.toLocaleString("en-US")} {metric.unit}
                  </dd>
                </div>
                <div>
                  <dt>AI candidate</dt>
                  <dd>
                    {metric.b.toLocaleString("en-US")} {metric.unit}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <p>
          Investigation budget: {baseline.request.artifact.constraints.investigationBudgetCredits} →{" "}
          {candidate.request.artifact.constraints.investigationBudgetCredits} Rescue Credits. Patch
          verification remained required. Both passed the correctness gate.
        </p>
        <div className={styles.badges}>
          <span>Observed result: {bazantic.comparison.relation}</span>
          <span>3 successful MCP tool calls</span>
          <span>SDK integrity + local replay matched</span>
        </div>
        <p>
          The candidate did not improve the outcome on this episode. We keep the tie visible. These
          are three independent outcomes—not a combined score and not evidence of general AI
          superiority.
        </p>
        <details>
          <summary>Inspect the AI calls and submitted strategy</summary>
          <ul>
            {bazantic.events.map((event, i) => (
              <li key={`${event.tool}-${i}`}>
                <span>
                  {i + 1}. {event.tool}
                </span>
                <span>HTTP {event.status}</span>
              </li>
            ))}
          </ul>
          <p>
            Candidate Doctrine (the actual submitted parameters, not the model&apos;s narrative)
          </p>
          <code>{JSON.stringify(candidate.request.artifact, null, 2)}</code>
          <p>Baseline result hash</p>
          <code>{baseline.run.resultHash}</code>
          <p>Candidate result hash</p>
          <code>{candidate.run.resultHash}</code>
        </details>
        <p className={styles.note}>
          Recorded check: {bazantic.checkedAt}. OpenAI inference used Bazantic MCP; the
          Bazantic-hosted Recipe was not executed. Gateway calls were free. Rescue Credits are
          simulated game balances, not tokens. This is one public practice episode, not a multi-seed
          A/B benchmark.
        </p>
        <div className={styles.links}>
          <a href="/sponsors/demo/evidence/bazantic" download>
            Download AI execution evidence
          </a>
          <Link href="/rescue-room/submission">Separate AI service payment demo</Link>
        </div>
      </section>
    </main>
  );
}
