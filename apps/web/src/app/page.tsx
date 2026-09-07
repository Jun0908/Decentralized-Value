import {
  emergencySupplyBaselinePoints,
  emergencySupplyDemoAllocation,
  evaluateSupplyAllocation,
  publicEmergencySupplyScenario,
} from "@frontier/emergency-supply";
import Link from "next/link";
import { ArenaCard } from "@/components/arena-card";
import { HomeFrontierPreview } from "@/components/home-frontier-preview";
import { SettlementEvidence } from "@/components/settlement-evidence";
import { SupplyAllocationDemo } from "@/components/supply-allocation-demo";
import { arenaRegistry } from "@/lib/arenas";

const github = "https://github.com/Jun0908/Decentralized-Value";

export default function HomePage() {
  const previewEvaluation = evaluateSupplyAllocation(emergencySupplyDemoAllocation);
  const scenario = publicEmergencySupplyScenario();
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  const commit = deploymentCommit?.slice(0, 7) ?? "local build";
  const commitHref = deploymentCommit
    ? `${github}/commit/${deploymentCommit}`
    : `${github}/commits/main`;

  return (
    <main className="page-shell platform-home">
      <section className="finalist-hero">
        <div className="finalist-hero-copy">
          <p className="eyebrow">Open competition protocol for multi-objective problems</p>
          <h1>Build cheaper and more resilient systems—without hiding tradeoffs in one score.</h1>
          <p className="lede">
            Sponsors publish problems with multiple goals. Builders and AI agents submit solutions.
            Frontier rewards every valid solution that expands what is possible.
          </p>
          <div className="actions">
            <Link className="primary-action" href="/#live-demo">
              Run the 60-second live demo
            </Link>
            <Link className="secondary-action" href="/#reward-evidence">
              See how rewards are calculated
            </Link>
          </div>
        </div>
        <HomeFrontierPreview
          baselines={emergencySupplyBaselinePoints}
          evaluation={previewEvaluation}
        />
        <dl className="finalist-proof-strip">
          <div>
            <dt>Failure tests</dt>
            <dd>9 exhaustive cases</dd>
          </div>
          <div>
            <dt>Reproducibility</dt>
            <dd>Deterministic result hash</dd>
          </div>
          <div>
            <dt>Rules</dt>
            <dd>Public evaluation context</dd>
          </div>
          <div>
            <dt>Extensibility</dt>
            <dd>3 independent arenas</dd>
          </div>
        </dl>
      </section>

      <section className="role-flow" id="how-it-works" aria-labelledby="role-flow-heading">
        <div>
          <p className="eyebrow">One open loop</p>
          <h2 id="role-flow-heading">From public problem to verifiable reward.</h2>
        </div>
        <ol>
          <li>
            <span>01 · Sponsor</span>
            <strong>Publish the problem</strong>
            <p>Commit constraints, independent axes, public context, and a reward pool.</p>
          </li>
          <li>
            <span>02 · Builder / Agent</span>
            <strong>Submit a solution</strong>
            <p>Humans and AI agents can iterate under the same visible rules.</p>
          </li>
          <li>
            <span>03 · Evaluator</span>
            <strong>Measure every axis</strong>
            <p>Correctness is checked first. Cost and resilience stay separate.</p>
          </li>
          <li>
            <span>04 · Ethereum</span>
            <strong>Reward contribution</strong>
            <p>Frontier expansion determines allocation; settlement makes it verifiable.</p>
          </li>
        </ol>
      </section>

      <section className="home-live-demo" id="live-demo" aria-labelledby="live-demo-heading">
        <header className="home-live-heading">
          <div>
            <p className="eyebrow">60-second live demo · Emergency Supply</p>
            <h2 id="live-demo-heading">Can you lower cost without making aid fragile?</h2>
          </div>
          <p>
            Change five supplier allocations. The API recalculates all nine single-failure cases,
            the Pareto result, contribution, and result hash from your input.
          </p>
        </header>
        <SupplyAllocationDemo scenario={scenario} />
      </section>

      <SettlementEvidence />

      <section className="more-frontiers" aria-labelledby="more-frontiers-heading">
        <header className="section-heading-row">
          <div>
            <p className="eyebrow">More frontiers</p>
            <h2 id="more-frontiers-heading">The evaluator pattern expands beyond logistics.</h2>
          </div>
          <Link href="/arenas">View all arenas →</Link>
        </header>
        <div className="arena-catalog compact">
          {arenaRegistry.slice(1).map((arena, index) => (
            <ArenaCard arena={arena} index={index + 1} key={arena.slug} />
          ))}
        </div>
      </section>

      <section className="trust-evidence" id="about" aria-labelledby="trust-heading">
        <div>
          <p className="eyebrow">Inspect, reproduce, challenge</p>
          <h2 id="trust-heading">The proof is part of the product.</h2>
          <p>
            Dataset, constraints, metrics, result, and settlement are separate evidence layers. A
            missing external proof remains visibly missing—it is never replaced by demo data.
          </p>
        </div>
        <div className="trust-links">
          <Link href="/architecture">
            <span>Architecture</span>
            <strong>Follow every hash and trust boundary →</strong>
          </Link>
          <a href={`${github}/tree/main/packages/emergency-supply/src`}>
            <span>Evaluator source</span>
            <strong>Inspect the deterministic measurement →</strong>
          </a>
          <a href={`${github}/tree/main/packages/contracts/src`}>
            <span>Settlement source</span>
            <strong>Inspect commit, distribute, and claim →</strong>
          </a>
          <a href={`${github}/blob/main/Docs/deployments/sepolia-reward-demo.json`}>
            <span>Deployment evidence</span>
            <strong>Inspect Sepolia addresses and receipts →</strong>
          </a>
          <a href={commitHref}>
            <span>Build evidence</span>
            <strong>68 TypeScript tests · CI commit {commit} →</strong>
          </a>
        </div>
      </section>

      <section className="platform-status">
        <div>
          <p className="eyebrow">Honest product status</p>
          <h2>Practice measurement is live. Tournament settlement is not.</h2>
        </div>
        <p>
          Three working evaluators and reward contracts exist today. A funded Sepolia pool, durable
          participant storage, World ID uniqueness, and final-day workloads still require external
          activation.
        </p>
        <Link className="primary-action" href="/architecture">
          Inspect boundaries
        </Link>
      </section>
    </main>
  );
}
