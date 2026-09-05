import { arena } from "@/lib/data";

export function FrontierChart() {
  const points = arena.artifacts;
  const minGas = Math.min(...points.map((point) => Number(point.gasPerOrder)));
  const maxGas = Math.max(...points.map((point) => Number(point.gasPerOrder)));
  const maxThroughput = Math.max(...points.map((point) => Number(point.parallelThroughput)));
  const x = (gas: string) => 50 + ((Number(gas) - minGas) / (maxGas - minGas)) * 540;
  const y = (throughput: string) => 300 - (Number(throughput) / maxThroughput) * 240;

  return (
    <figure className="chart-card">
      <svg aria-labelledby="chart-title chart-desc" role="img" viewBox="0 0 640 350">
        <title id="chart-title">Gas per order versus parallel throughput</title>
        <desc id="chart-desc">
          Three correct artifacts form the Pareto frontier. BadBook is invalid.
        </desc>
        <path className="axis" d="M50 30V300H610" />
        <text className="axis-label" x="330" y="338">
          Gas per order →
        </text>
        <text className="axis-label" transform="rotate(-90 16 180)" x="16" y="180">
          Throughput →
        </text>
        {points.map((point) => (
          <g
            key={point.artifactHash}
            transform={`translate(${x(point.gasPerOrder)} ${y(point.parallelThroughput)})`}
          >
            <circle
              className={point.correctness ? "point frontier" : "point invalid"}
              r={point.frontier ? 9 : 7}
            />
            <text className="point-label" x="12" y="4">
              {point.name}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        Measured by Foundry, five repetitions. Lower gas and higher throughput are better.
      </figcaption>
    </figure>
  );
}
