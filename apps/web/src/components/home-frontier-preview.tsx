import type { SupplyEvaluation, SupplyPoint } from "@frontier/emergency-supply";

function percent(ppm: number) {
  return `${(ppm / 10_000).toFixed(2)}%`;
}

export function HomeFrontierPreview({
  baselines,
  evaluation,
}: {
  baselines: readonly SupplyPoint[];
  evaluation: SupplyEvaluation;
}) {
  const points = [
    ...baselines,
    {
      id: "candidate",
      name: "Your solution",
      totalProcurementCost: evaluation.totalProcurementCost,
      worstCaseDeliveredKits: evaluation.worstCaseDeliveredKits,
    },
  ];
  const x = (cost: number) => 54 + ((cost - 35_000) / 45_000) * 336;
  const y = (delivery: number) => 202 - (delivery / 850) * 160;

  return (
    <figure className="hero-frontier-preview">
      <div className="preview-heading">
        <div>
          <span>Live evaluator fixture</span>
          <strong>Emergency Supply</strong>
        </div>
        <span className="preview-evidence">Deterministic · Evidence L0</span>
      </div>
      <svg aria-labelledby="hero-preview-title" role="img" viewBox="0 0 430 245">
        <title id="hero-preview-title">
          Emergency Supply procurement cost and worst-case delivery frontier
        </title>
        <path className="axis" d="M54 30V202H404" />
        <text className="axis-label" x="226" y="235">
          Procurement cost · lower is better
        </text>
        <text className="axis-label" transform="rotate(-90 14 125)" x="14" y="125">
          Worst-case delivery · higher is better
        </text>
        {points.map((point, index) => {
          const candidate = point.id === "candidate";
          return (
            <g
              key={point.id}
              transform={`translate(${x(point.totalProcurementCost)} ${y(point.worstCaseDeliveredKits)})`}
            >
              <circle
                className={candidate ? "supply-candidate" : "frontier"}
                r={candidate ? 8 : 6}
              />
              <text className="point-label" textAnchor="middle" y={candidate ? -13 : -11}>
                {candidate ? "Your solution" : `Baseline ${String.fromCharCode(65 + index)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <dl className="preview-contribution">
        <div>
          <dt>Before</dt>
          <dd>{percent(evaluation.contribution.hypervolumeBeforePpm)}</dd>
        </div>
        <div>
          <dt>After</dt>
          <dd>{percent(evaluation.contribution.hypervolumeAfterPpm)}</dd>
        </div>
        <div className="preview-expansion">
          <dt>New possibility area</dt>
          <dd>+{percent(evaluation.contribution.frontierExpansionPpm)}</dd>
        </div>
      </dl>
    </figure>
  );
}
