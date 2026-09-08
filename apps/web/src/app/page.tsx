import Link from "next/link";
import { ArenaCard } from "@/components/arena-card";
import { HomeProtocolHero } from "@/components/home-protocol-hero";
import { SettlementEvidence } from "@/components/settlement-evidence";
import { arenaRegistry } from "@/lib/arenas";

const github = "https://github.com/Jun0908/Decentralized-Value";

export default function HomePage() {
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  const commit = deploymentCommit?.slice(0, 7) ?? "local build";
  const commitHref = deploymentCommit
    ? `${github}/commit/${deploymentCommit}`
    : `${github}/commits/main`;

  return (
    <main className="page-shell platform-home">
      <section className="finalist-hero" id="evm-demo">
        <HomeProtocolHero />
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

      <section className="home-arenas" id="arenas" aria-labelledby="home-arenas-heading">
        <header className="section-heading-row">
          <div>
            <p className="eyebrow">03 arenas</p>
            <h2 id="home-arenas-heading">Choose the value you want to improve.</h2>
          </div>
        </header>
        <div className="arena-catalog compact">
          {arenaRegistry.map((arena, index) => (
            <ArenaCard arena={arena} index={index} key={arena.slug} />
          ))}
        </div>
      </section>

      <SettlementEvidence />

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
            <strong>71 TypeScript tests · CI commit {commit} →</strong>
          </a>
        </div>
      </section>

      <section className="platform-status">
        <div>
          <p className="eyebrow">Honest product status</p>
          <h2>Emergency Supply now has a complete demo-competition flow.</h2>
        </div>
        <p>
          Three evaluators and reward contracts exist today. Plan 5 adds authenticated revisions, a
          frontier leaderboard, and Final Entry selection. Durable competition storage and the
          participant-addressed Sepolia demo pool are active; this remains a demo round, not a
          monetary-value tournament.
        </p>
        <Link className="primary-action" href="/architecture">
          Inspect boundaries
        </Link>
      </section>
    </main>
  );
}
