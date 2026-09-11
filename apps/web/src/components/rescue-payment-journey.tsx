import type { RescueRunPaymentEvidence, ServiceDefinition } from "@frontier/rescue-room";

function shortHash(value: string | null): string {
  if (!value) return "awaiting delivery";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

const stateCopy = {
  reserved: {
    label: "Reserved",
    detail: "The Game Ledger is holding this budget while the Service Agent works.",
  },
  released: {
    label: "Released",
    detail: "A valid Service Receipt arrived, so the simulated credits were released.",
  },
  refunded: {
    label: "Refunded",
    detail: "No deliverable arrived by the game deadline, so the budget returned.",
  },
} as const;

export function RescuePaymentJourney({
  evidence,
  services,
}: {
  evidence: RescueRunPaymentEvidence | null;
  services: readonly ServiceDefinition[];
}) {
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));
  const ledger = evidence?.gameLedger;

  return (
    <section className="rescue-payment-journey" aria-labelledby="rescue-payment-title">
      <div className="builder-heading">
        <div>
          <p className="eyebrow">Agent-to-Agent Payments</p>
          <h2 id="rescue-payment-title">One decision, two ledgers, no hidden money claim.</h2>
        </div>
        <span className="rescue-payment-state" data-state="simulated">
          SIMULATED
        </span>
      </div>

      <div className="rescue-payment-layers" aria-label="Payment layers">
        <article>
          <span>01 · Game budget</span>
          <strong>{ledger ? `${ledger.availableBalance} RC available` : "100 RC ready"}</strong>
          <small>
            Strategy resource used by the deterministic evaluator. Rescue Credits are not tokens.
          </small>
        </article>
        <article>
          <span>02 · Service escrow</span>
          <strong>
            {ledger
              ? `${ledger.reservedBalance} reserved · ${ledger.spentBalance} spent`
              : "No order yet"}
          </strong>
          <small>Budget moves only after the Commander chooses a curated Service Agent.</small>
        </article>
        <article>
          <span>03 · Sepolia mirror</span>
          <strong>{evidence ? "Not requested" : "Waiting for a run"}</strong>
          <small>rUSD-DEMO · six decimals · Sepolia demo token · no monetary value.</small>
        </article>
      </div>

      {evidence?.orders.length ? (
        <div className="rescue-payment-orders">
          {evidence.orders.map((order, index) => {
            const copy = stateCopy[order.gamePaymentState];
            return (
              <article key={order.orderId} data-state={order.gamePaymentState}>
                <div className="rescue-payment-order-head">
                  <div>
                    <span>Order {String(index + 1).padStart(2, "0")}</span>
                    <strong>{serviceNames.get(order.serviceId) ?? order.serviceId}</strong>
                  </div>
                  <span>{copy.label}</span>
                </div>
                <div className="rescue-payment-route" aria-label="Payment route">
                  <span>Commander AI</span>
                  <i aria-hidden="true">→</i>
                  <span>{order.amountCredits} RC escrow</span>
                  <i aria-hidden="true">→</i>
                  <span>Service Agent</span>
                </div>
                <p>{copy.detail}</p>
                <dl>
                  <div>
                    <dt>Order</dt>
                    <dd title={order.orderId}>{shortHash(order.orderId)}</dd>
                  </div>
                  <div>
                    <dt>Commander Action</dt>
                    <dd title={order.commanderActionHash}>
                      {shortHash(order.commanderActionHash)}
                    </dd>
                  </div>
                  <div>
                    <dt>Service Manifest</dt>
                    <dd title={order.serviceManifestHash}>
                      {shortHash(order.serviceManifestHash)}
                    </dd>
                  </div>
                  <div>
                    <dt>Deliverable</dt>
                    <dd title={order.deliverableHash ?? undefined}>
                      {shortHash(order.deliverableHash)}
                    </dd>
                  </div>
                  <div>
                    <dt>Acceptance</dt>
                    <dd title={order.acceptanceHash ?? undefined}>
                      {shortHash(order.acceptanceHash)}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rescue-payment-empty">
          <strong>No Service Agent has been hired in this run.</strong>
          <p>
            Run a strategy that buys evidence to see its Order, escrow state, deliverable hash, and
            refund or release path here.
          </p>
        </div>
      )}

      <footer>
        <div>
          <span>Current evidence</span>
          <strong>Game Ledger only · simulated</strong>
        </div>
        <div>
          <span>Sepolia contract</span>
          <strong>Not deployed / not connected</strong>
        </div>
        <p>
          “AI hired another AI and paid it” will appear only after a confirmed Escrow release event
          and an independently checked Service Agent balance increase.
        </p>
      </footer>
    </section>
  );
}
