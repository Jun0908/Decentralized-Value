import { arena, shortHash } from "@/lib/data";

const integrations = [
  {
    name: "ENSv2",
    ready: Boolean(process.env.SEPOLIA_RPC_URL && process.env.ENS_PARENT_NAME),
    detail: process.env.ENS_PARENT_NAME ?? "Parent name not configured",
  },
  {
    name: "Bazantic",
    ready: Boolean(process.env.BAZANTIC_GATEWAY_URL),
    detail: process.env.BAZANTIC_GATEWAY_URL
      ? "Gateway configured"
      : "Gateway and Recipe ID unavailable",
  },
  {
    name: "Ledger",
    ready: process.env.LEDGER_SIGNING_MODE === "dmk",
    detail: process.env.LEDGER_SIGNING_MODE ?? "Signing mode not configured",
  },
  {
    name: "Privy",
    ready: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID),
    detail: process.env.NEXT_PUBLIC_PRIVY_APP_ID ? "App ID configured" : "App ID not configured",
  },
] as const;

export default function SponsorDebugPage() {
  return (
    <main className="page-shell detail-page">
      <header className="page-heading">
        <p className="eyebrow">Integration evidence</p>
        <h1>Sponsor debug</h1>
        <p>
          Configuration is reported without exposing credentials. Unavailable external evidence
          stays explicitly unavailable.
        </p>
      </header>
      <section className="integration-grid">
        {integrations.map((item) => (
          <article key={item.name}>
            <div>
              <span className={item.ready ? "signal live" : "signal"} />
              <strong>{item.name}</strong>
            </div>
            <p>{item.detail}</p>
            <span className={item.ready ? "status-good" : "status-warn"}>
              {item.ready ? "configured" : "blocked externally"}
            </span>
          </article>
        ))}
      </section>
      <section className="evidence-grid">
        <div>
          <p className="eyebrow">Latest reproducible result</p>
          <dl>
            <div>
              <dt>Context</dt>
              <dd>{shortHash(arena.contextHash)}</dd>
            </div>
            <div>
              <dt>Benchmark</dt>
              <dd>
                {arena.artifacts.length} artifacts · {arena.repetitions} repetitions
              </dd>
            </div>
            <div>
              <dt>Frontier members</dt>
              <dd>{arena.artifacts.filter((item) => item.frontier).length}</dd>
            </div>
          </dl>
        </div>
        <div>
          <p className="eyebrow">Live settlement</p>
          <dl>
            <div>
              <dt>Result hash</dt>
              <dd>Not attested</dd>
            </div>
            <div>
              <dt>Signature</dt>
              <dd>Not available</dd>
            </div>
            <div>
              <dt>Transaction</dt>
              <dd>Not available</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
