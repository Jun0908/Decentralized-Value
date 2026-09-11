"use client";

import Image from "next/image";
import Link from "next/link";
import { useFrontierAccount } from "@/components/wallet-panel";

export function HomeProtocolHero() {
  const account = useFrontierAccount();

  return (
    <div className="hero-intro-grid">
      <div className="finalist-hero-copy">
        <p className="eyebrow">Decentralized markets for plural values</p>
        <h1>Who gets to decide what “better” means?</h1>
        <p className="hero-value-statement">
          Most systems hide that decision inside a weighted score.
        </p>
        <p className="hero-value-statement">
          <strong>Value Decentralization makes it plural.</strong>
        </p>
        <p className="hero-value-statement">
          One shared evaluation can support many independent definitions of progress—without
          collapsing them into one winner.
        </p>
        <p className="hero-ethereum-line">
          <strong>Measure once. Preserve the tradeoffs. Let values diverge.</strong>
        </p>
        <div className="actions hero-actions">
          {account.authenticated ? (
            <Link className="primary-action" href="/arenas/emergency-supply">
              Enter live arena
            </Link>
          ) : (
            <button
              className="primary-action"
              disabled={!account.configured || !account.ready}
              onClick={account.login}
              type="button"
            >
              {!account.configured
                ? "Login unavailable"
                : account.ready
                  ? "Log in"
                  : "Checking login..."}
            </button>
          )}
        </div>
      </div>

      <figure className="hero-value-illustration">
        <Image
          alt="A hand-drawn comparison: one weighted score discards four of five ideas, while an open Pareto frontier funds the cleanest, cheapest, and most resilient solutions."
          height={1024}
          preload
          sizes="(max-width: 760px) calc(100vw - 2rem), (max-width: 1100px) 50vw, 620px"
          src="/images/weighted-score-vs-open-frontier.png"
          width={1536}
        />
      </figure>
    </div>
  );
}
