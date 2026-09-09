import { ArenaCard } from "@/components/arena-card";
import { HomeProtocolHero } from "@/components/home-protocol-hero";
import { arenaRegistry } from "@/lib/arenas";

export default function HomePage() {
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
    </main>
  );
}
