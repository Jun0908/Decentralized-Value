import type { Metadata } from "next";
import Link from "next/link";
import evidence from "../../../../../../../Docs/deployments/rescue-submission-demo.json";
import replayFixture from "../../../../../../../Docs/deployments/rescue-submission-replay.json";
import styles from "../submission.module.css";

export const metadata: Metadata = {
  title: "Who decides what better means? | Rescue Room",
  description:
    "An AI hires an AI. Shared evidence, independent values. A recorded Sepolia payment and replayable incident-response demo.",
};
const names: Record<string, string> = {
  "always-pause": "Pause everything",
  "never-pause": "Do nothing",
  "paid-analysis-commander": "Commander + paid analysis",
};
const actions: Record<string, string> = {
  WAIT: "Keep watching",
  PAUSE_MODULE: "Pause one module",
  PAUSE_PROTOCOL: "Pause the protocol",
  RESUME_MODULE: "Resume one module",
  RESUME_PROTOCOL: "Resume the protocol",
  CLOSE_INCIDENT: "End the response",
};
const poolLabels: Record<string, string> = {
  loss: "Protect user assets",
  availability: "Keep services available",
  spend: "Preserve the treasury",
};

export default function RescueSubmissionEnglishPage() {
  return (
    <main className={styles.demo} lang="en">
      <header className={styles.hero} id="intro">
        <p className={styles.eyebrow}>VALUE DECENTRALIZATION / RESCUE ROOM</p>
        <h1>
          Who gets to decide
          <br />
          what “better” means?
        </h1>
        <p className={styles.lead}>
          An AI hires a specialist AI to investigate a fictional protocol incident. We measure the
          outcome once. Independent Value Pools decide what to support.
        </p>
        <div className={styles.badges}>
          <span>Recorded real AI calls</span>
          <span>Sepolia payment verified</span>
          <span>Protocol actions: simulation</span>
        </div>
        <p>Recorded-run demo. Viewing this page triggers no inference or payment.</p>
        <nav className={styles.links} aria-label="Demo chapters">
          <a href="#purchase">1. Hire</a>
          <a href="#response">2. Decide</a>
          <a href="#outcomes">3. Compare</a>
          <a href="#pools">4. Allocate</a>
          <a href="#replay">5. Verify</a>
        </nav>
      </header>

      <section id="purchase" aria-labelledby="purchase-title">
        <p className={styles.eyebrow}>01 / INFORMATION HAS A COST</p>
        <h2 id="purchase-title">Uncertainty creates a choice.</h2>
        <div className={styles.flow}>
          <article>
            <span>Commander AI</span>
            <h3>Withdrawals are rising.</h3>
            <p>
              New addresses appear. The cause and true severity are hidden. The Commander hires
              Pulse Monitor.
            </p>
          </article>
          <article>
            <span>Sepolia Escrow</span>
            <h3>5 rUSD-DEMO paid.</h3>
            <p>
              A real test-token transfer to the provider after delivery. These tokens have no
              claimed monetary value.
            </p>
            <a
              href={`https://sepolia.etherscan.io/tx/${evidence.releaseTx}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View payment transaction ↗
            </a>
          </article>
          <article>
            <span>Specialist AI</span>
            <h3>“No exploit confirmed.”</h3>
            <p>
              The specialist suggests more monitoring. A delivered analysis is not proof of a
              correct diagnosis.
            </p>
            <details>
              <summary>Read the delivered analysis</summary>
              <p>{evidence.specialistSummary}</p>
            </details>
          </article>
        </div>
      </section>

      <section id="response" aria-labelledby="response-title">
        <p className={styles.eyebrow}>02 / EVIDENCE RETURNS TO THE COMMANDER</p>
        <h2 id="response-title">One purchase. Three follow-up decisions.</h2>
        <p>
          The paid analysis and current public observations enter each real AI call. Intermediate
          simulated reports are separate, uncertain information.
        </p>
        <ol className={styles.flow}>
          {evidence.turns.map((turn) => (
            <li key={turn.turn}>
              <span>
                Decision {turn.turn} · Game T+{turn.gameMinute}
              </span>
              <h3>{actions[turn.action.type] ?? turn.action.type}</h3>
              <p>
                {"minutes" in turn.action
                  ? `Wait ${turn.action.minutes} game minute and observe.`
                  : "module" in turn.action
                    ? `Target: ${turn.action.module}. Leave the other modules running.`
                    : "An action within the allowed response policy."}
              </p>
              <details>
                <summary>Inspect decision evidence</summary>
                <p>{turn.reasonCode}</p>
                <code>{turn.inputHash}</code>
              </details>
            </li>
          ))}
        </ol>
        <p className={styles.note}>
          This continuation stops after three decisions; the simulator then advances to T+60. It
          does not demonstrate additional hiring, patching, resuming, or a complete autonomous
          recovery.
        </p>
      </section>

      <section id="outcomes" aria-labelledby="outcomes-title">
        <p className={styles.eyebrow}>03 / MEASURE ONCE. PRESERVE THE TRADEOFFS.</p>
        <h2 id="outcomes-title">Paying an AI does not guarantee a better result.</h2>
        <p>
          Same public episode, permissions and simulator. In this recorded case, doing nothing
          dominates both alternatives. We do not replace an unfavorable result.
        </p>
        <div className={styles.flow}>
          {evidence.comparison.points.map((point) => (
            <article key={point.id}>
              <span>
                {evidence.comparison.frontier.includes(point.id) ? "PARETO FRONTIER" : "COMPARISON"}
              </span>
              <h3>{names[point.id] ?? point.id}</h3>
              <dl>
                <div>
                  <dt>User loss ↓</dt>
                  <dd>{point.values.loss.toLocaleString("en-US")} USD</dd>
                </div>
                <div>
                  <dt>Protocol demand served ↑</dt>
                  <dd>{(point.values.availability / 10000).toFixed(2)}%</dd>
                </div>
                <div>
                  <dt>Response spend ↓</dt>
                  <dd>{point.values.spend} Credits</dd>
                </div>
              </dl>
              <p>Action validity: {point.correctness ? "PASS" : "FAIL"}</p>
            </article>
          ))}
        </div>
        <p className={styles.note}>
          USD losses and Credits are simulated—not tokens, API charges or gas. PASS means valid
          actions, not a correct diagnosis. One public episode is not a hidden Final or proof of AI
          performance.
        </p>
      </section>

      <section id="pools" aria-labelledby="pools-title">
        <p className={styles.eyebrow}>04 / LET VALUES DIVERGE</p>
        <h2 id="pools-title">One shared result. Independent decisions.</h2>
        <p>
          Each pool supports the best valid result on its own axis. Equal values share 100 Preview
          Credits, with remainder units assigned by ID. No weighted score. No combined ranking.
        </p>
        <div className={styles.flow}>
          {evidence.comparison.pools.map((pool) => (
            <article key={pool.key}>
              <span>{pool.name}</span>
              <h3>{poolLabels[pool.key]}</h3>
              <p>Independent budget: 100 Preview Credits</p>
              <ul>
                {pool.allocations.map((allocation) => (
                  <li key={allocation.id}>
                    {names[allocation.id] ?? allocation.id}
                    <strong>{allocation.credits}</strong>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className={styles.note}>
          These are allocation previews, not committed or paid rewards. This simple pool version can
          support tied values even outside the Pareto frontier. It is separate from tournament pool
          rules.
        </p>
      </section>

      <section id="replay" aria-labelledby="replay-title">
        <p className={styles.eyebrow}>05 / VERIFY THE RECORDED ACTIONS</p>
        <h2 id="replay-title">Replay the outcome. Choose your values.</h2>
        <p>
          Public inputs reproduce the simulator outcome and pool allocations without API keys,
          private jobs or new payments.
        </p>
        <code>pnpm verify:rescue:submission-replay</code>
        <div className={styles.links}>
          <a
            download="rescue-submission-replay.json"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(replayFixture, null, 2))}`}
          >
            Download replay inputs
          </a>
          <a
            download="rescue-submission-demo.json"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(evidence, null, 2))}`}
          >
            Download public evidence
          </a>
        </div>
        <details>
          <summary>Inspect hashes and scope</summary>
          <p>Recorded: {evidence.recordedAt} · Replay matched</p>
          <p>
            Model: gpt-5.6-luna · Follow-up calls: {evidence.usage.requests} · Additional
            transactions: 0
          </p>
          <p>Context Hash</p>
          <code>{evidence.contextHash}</code>
          <p>Outcome Hash</p>
          <code>{evidence.outcome.resultHash}</code>
          <p>Evidence Hash</p>
          <code>{evidence.evidenceHash}</code>
          <p>
            Public replay does not prove model provenance, payment receipts or the full private
            runtime evidence.
          </p>
        </details>
        <p className={styles.note}>
          Operator-managed agents and wallets. An open third-party market, hidden Final tournament,
          Rescue rewards and live ENS / Bazantic / CRE integrations remain unfinished.
        </p>
        <div className={styles.links}>
          <Link href="/arenas/rescue-room">Edit a strategy in Practice →</Link>
          <Link href="/rescue-room/operations">Payment and refund evidence (Japanese) →</Link>
          <Link href="/docs/cli">API / SDK / CLI guide →</Link>
          <Link href="/rescue-room/submission" lang="ja">
            日本語版 →
          </Link>
        </div>
      </section>
    </main>
  );
}
