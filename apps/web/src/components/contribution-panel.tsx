type ContributionEvidence = {
  hypervolumeBeforePpm: number;
  hypervolumeAfterPpm: number;
  frontierExpansionPpm: number;
  exclusiveContributionPpm: number;
  contributionSharePpm: number;
};

const PRACTICE_POOL = 10_000;

function percent(ppm: number) {
  return `${(ppm / 10_000).toFixed(2)}%`;
}

export function ContributionPanel({ contribution }: { contribution: ContributionEvidence }) {
  const preview = Math.floor((PRACTICE_POOL * contribution.contributionSharePpm) / 1_000_000);
  const beforeWidth = Math.max(0, Math.min(100, contribution.hypervolumeBeforePpm / 10_000));
  const afterWidth = Math.max(0, Math.min(100, contribution.hypervolumeAfterPpm / 10_000));

  return (
    <section className="contribution-panel" aria-labelledby="contribution-heading">
      <div className="contribution-copy">
        <p className="eyebrow">Frontier contribution</p>
        <h3 id="contribution-heading">
          {contribution.frontierExpansionPpm > 0
            ? `You expanded the possible area by ${percent(contribution.frontierExpansionPpm)}.`
            : "This result does not expand the current possible area."}
        </h3>
        <p>
          Hypervolume measures the useful area covered by all non-dominated results against bounds
          fixed before evaluation. It is not a hidden weighted score.
        </p>
      </div>
      <div className="contribution-visual" aria-label="Hypervolume before and after evaluation">
        <div>
          <span>Before</span>
          <div className="contribution-track">
            <i style={{ width: `${beforeWidth}%` }} />
          </div>
          <strong>{percent(contribution.hypervolumeBeforePpm)}</strong>
        </div>
        <div>
          <span>After</span>
          <div className="contribution-track after">
            <i style={{ width: `${beforeWidth}%` }} />
            <b
              aria-label={`${percent(contribution.frontierExpansionPpm)} newly expanded area`}
              style={{
                left: `${beforeWidth}%`,
                width: `${Math.max(0, afterWidth - beforeWidth)}%`,
              }}
            />
          </div>
          <strong>{percent(contribution.hypervolumeAfterPpm)}</strong>
        </div>
      </div>
      <dl className="contribution-stats">
        <div>
          <dt>Exclusive contribution</dt>
          <dd>{percent(contribution.exclusiveContributionPpm)}</dd>
        </div>
        <div>
          <dt>Share of measured area</dt>
          <dd>{percent(contribution.contributionSharePpm)}</dd>
        </div>
        <div>
          <dt>Practice reward preview</dt>
          <dd>{preview.toLocaleString()} credits</dd>
        </div>
      </dl>
      <p className="contribution-disclaimer">
        Preview only: no reward token, funded pool, signature, or payout transaction is claimed.
      </p>
    </section>
  );
}
