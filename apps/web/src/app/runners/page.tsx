import { EnsRunnerDirectory, ViemEnsRecordReader, type ActiveRunner } from "@frontier/ens-adapter";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

export const dynamic = "force-dynamic";

async function discover(): Promise<{ runners: ActiveRunner[]; error: string | null }> {
  if (!process.env.SEPOLIA_RPC_URL || !process.env.ENS_PARENT_NAME) {
    return { runners: [], error: "Set SEPOLIA_RPC_URL and ENS_PARENT_NAME." };
  }
  try {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL, { timeout: 8_000 }),
    });
    const directory = new EnsRunnerDirectory(
      new ViemEnsRecordReader(client),
      `runners.${process.env.ENS_PARENT_NAME}`,
    );
    return { runners: await directory.discover("evm-orderbook-v1"), error: null };
  } catch (cause) {
    return { runners: [], error: cause instanceof Error ? cause.message : "ENS resolution failed" };
  }
}

export default async function RunnersPage() {
  const state = await discover();
  return (
    <main className="page-shell detail-page">
      <header className="page-heading">
        <p className="eyebrow">ENSv2 / identity plane</p>
        <h1>Runner directory</h1>
        <p>
          Eligibility is resolved from live Sepolia records on every render and dispatch. Stale
          local runner lists are not accepted.
        </p>
      </header>
      {state.runners.length ? (
        <section className="integration-grid">
          {state.runners.map((runner) => (
            <article key={runner.ensName}>
              <div>
                <span className="signal live" />
                <strong>{runner.ensName}</strong>
              </div>
              <p className="hash">
                {runner.signingAddress}
                <br />
                {runner.endpoint}
              </p>
              <span className="status-good">
                {runner.status} · {runner.version} · {runner.capabilities.join(", ")}
              </span>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <span className="signal" />
          <div>
            <h2>Live ENS discovery unavailable</h2>
            <p>
              {state.error} The application fails closed instead of presenting a fabricated runner.
            </p>
          </div>
        </section>
      )}
      <section className="record-grid">
        {[
          "EVM address",
          "frontier.role",
          "frontier.capabilities",
          "url",
          "frontier.version",
          "frontier.status",
        ].map((record) => (
          <article key={record}>
            <code>{record}</code>
            <span>required</span>
          </article>
        ))}
      </section>
    </main>
  );
}
