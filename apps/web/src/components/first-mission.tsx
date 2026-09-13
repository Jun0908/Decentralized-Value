import type { ReactNode } from "react";
import styles from "./first-mission.module.css";

type MissionStep = {
  title: string;
  description: string;
  done: boolean;
  action: string;
  onAction?: () => void;
  href?: string;
  disabled?: boolean;
};

export function FirstMission({
  title,
  description,
  steps,
  result,
  error,
  busy,
}: {
  title: string;
  description: string;
  steps: readonly MissionStep[];
  result?: ReactNode;
  error?: string | null;
  busy?: string | null;
}) {
  const complete = steps.every((step) => step.done);
  const active = steps.findIndex((step) => !step.done);
  return (
    <section
      className={styles.mission}
      aria-label="Your first mission"
      data-testid="first-mission"
      data-complete={complete}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>START HERE · A SHORT GUIDED EXPERIMENT</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className={styles.status} role="status">
          {complete ? "Experiment complete" : `Step ${active + 1} of ${steps.length}`}
        </span>
      </div>
      {busy ? <p role="status">{busy}</p> : null}
      {error ? (
        <p role="alert">{error} This action did not complete. Review the settings and try again.</p>
      ) : null}
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li
            key={step.title}
            data-state={step.done ? "done" : index === active ? "current" : "next"}
          >
            <span className={styles.number}>{step.done ? "✓" : `0${index + 1}`}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            {step.href ? (
              <a className={styles.action} href={step.href}>
                {step.action} ↓
              </a>
            ) : (
              <button
                className={styles.action}
                type="button"
                disabled={step.disabled}
                onClick={step.onAction}
              >
                {step.action}
              </button>
            )}
          </li>
        ))}
      </ol>
      {result ? (
        <div className={styles.result} data-testid="first-mission-result" aria-live="polite">
          {result}
        </div>
      ) : null}
      <p className={styles.footnote}>
        Learning progress only. No score, reward, AI fee, or payment. A tie is a valid result.
      </p>
    </section>
  );
}
