"use client";

import { CheckIcon, ClipboardDocumentIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import reference from "@/content/cli/command-reference.json";
import sdkExample from "@/content/cli/sdk-practice.json";
import styles from "./cli-guide.module.css";

const cli = "pnpm exec frontier --base-url http://localhost:3000";
const sections = [
  ["arenas", "Supported arenas"],
  ["install", "Install locally"],
  ["practice", "First Practice"],
  ["compare", "Compare results"],
  ["submit", "Sign in & submit"],
  ["sdk", "TypeScript SDK"],
  ["agents", "AI agents"],
  ["reference", "Command reference"],
  ["evidence", "Evidence & conditions"],
  ["troubleshooting", "Troubleshooting"],
] as const;

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span>{label}</span>
        <span className={styles.copyStatus} role="status">
          {status === "copied"
            ? "Copied"
            : status === "failed"
              ? "Copy failed. Select the code to copy."
              : ""}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          title={`Copy ${label}`}
          aria-label={`Copy ${label}`}
        >
          {status === "copied" ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <ClipboardDocumentIcon aria-hidden="true" />
          )}
        </button>
      </div>
      <pre tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Contents() {
  return (
    <nav className={styles.contentsLinks} aria-label="Guide sections">
      {sections.map(([id, title]) => (
        <a href={`#${id}`} key={id}>
          {title}
        </a>
      ))}
    </nav>
  );
}

export function CliGuide() {
  const [arena, setArena] = useState<"disaster-response" | "rescue-room">("disaster-response");
  const isDisaster = arena === "disaster-response";
  const artifact = isDisaster ? "strategy.json" : "doctrine.json";
  const directory = isDisaster ? "disaster-strategy" : "rescue-doctrine";
  const project = `--project ${directory}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/arenas">Arenas</Link>
        <p className={styles.eyebrow}>
          <CommandLineIcon aria-hidden="true" /> Developer guide / local preview
        </p>
        <h1>SDK & CLI</h1>
        <p>
          Validate a strategy, run public Practice, and save a revision in a supported arena. Every
          result keeps its own metrics and evaluation conditions.
        </p>
        <p className={styles.notice}>
          The CLI is not published on npm. It is included in this repository for local use with a
          local Frontier server. Local fullstack checks use a fixture API and synthetic identities.
          Live Privy authorization and remote deployment have not been verified.
        </p>
      </header>
      <div className={styles.layout}>
        <aside className={styles.desktopContents}>
          <strong>On this page</strong>
          <Contents />
        </aside>
        <article className={styles.article}>
          <details className={styles.mobileContents}>
            <summary>On this page</summary>
            <Contents />
          </details>
          <section id="arenas">
            <h2>Supported arenas</h2>
            <p>
              Run <code>arenas inspect</code> before starting. The local server reports whether each
              operation is available and which services are missing.
            </p>
            <div className={styles.tableWrap} tabIndex={0} aria-label="Arena support">
              <table>
                <thead>
                  <tr>
                    <th>Arena</th>
                    <th>Local scope</th>
                    <th>Boundary</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>
                      <Link href="/arenas/emergency-supply">72-Hour Disaster Response</Link>
                    </th>
                    <td>
                      Practice, comparison, authenticated revisions, history, download, Final Entry
                    </td>
                    <td>
                      Strategy v2; submission requires configured account and storage services.
                    </td>
                  </tr>
                  <tr>
                    <th>
                      <Link href="/arenas/rescue-room">Rescue Room</Link>
                    </th>
                    <td>Deterministic Doctrine Practice and same-Episode comparison</td>
                    <td>
                      Practice only. No saved submissions, Final Entry, or paid AI Playbook
                      inference through this CLI.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <figure className={styles.figure}>
              <Image
                src="/images/disaster-response-network.png"
                alt="Disaster Response network connecting supplier routes and relief regions"
                width={1536}
                height={1024}
                sizes="(max-width: 760px) 100vw, 740px"
              />
              <figcaption>
                The Disaster Response network used by the arena replay. This is an arena
                illustration, not a measured CLI result.
              </figcaption>
            </figure>
          </section>
          <section id="install">
            <h2>Install locally</h2>
            <p>
              Use Node.js 22 or newer. The selected CLI and SDK version is <code>0.3.0</code>, with
              shared definitions at <code>0.2.0</code>. Run these commands from the Frontier
              repository root. The workspace packages remain private and are not installed globally.
            </p>
            <CodeBlock
              label="Install and build the local workspace packages"
              code={`pnpm install\npnpm build:tooling\npnpm exec frontier --version\npnpm exec frontier --help`}
            />
            <p>
              Start the local web server at <code>http://localhost:3000</code> before continuing.
              Each example pins this origin explicitly. Use the same origin for authorization,
              Practice, and submission.
            </p>
          </section>
          <section id="practice">
            <h2>First Practice</h2>
            <div className={styles.segmented} role="group" aria-label="Practice arena">
              <button
                type="button"
                aria-pressed={isDisaster}
                onClick={() => setArena("disaster-response")}
              >
                Disaster Response
              </button>
              <button
                type="button"
                aria-pressed={!isDisaster}
                onClick={() => setArena("rescue-room")}
              >
                Rescue Room
              </button>
            </div>
            <p>
              {isDisaster
                ? "Strategy v2: public Practice and authenticated submission."
                : "Doctrine: public Practice only, with simulated game credits and no reward eligibility."}
            </p>
            <CodeBlock
              key={`${arena}-init`}
              label="Create a Starter Project"
              code={`${cli} arenas list\n${cli} arenas inspect ${arena}\n${cli} init ${arena} --dir ${directory}`}
            />
            <dl className={styles.files}>
              <div>
                <dt>
                  <code>{artifact}</code>
                </dt>
                <dd>Your editable {isDisaster ? "Strategy" : "Doctrine"}.</dd>
              </div>
              <div>
                <dt>
                  <code>{isDisaster ? "strategy" : "doctrine"}.schema.json</code>
                </dt>
                <dd>The published input format.</dd>
              </div>
              <div>
                <dt>
                  <code>frontier.json</code>
                </dt>
                <dd>Arena, origin, artifact path, and provenance.</dd>
              </div>
              <div>
                <dt>
                  <code>frontier.lock.json</code>
                </dt>
                <dd>Pinned context, evaluator, schema, and manifest conditions.</dd>
              </div>
            </dl>
            <p>
              Edit <code>{artifact}</code>, then validate and evaluate it. Initialization requires a
              new or empty directory.
            </p>
            <CodeBlock
              label="Validate and run Practice"
              code={`${cli} check ${project}\n${cli} practice ${project} --wait\n${cli} runs list ${project}`}
            />
            <p>
              <code>check</code> verifies local input rules; the evaluator decides correctness.
              Practice is synchronous, so <code>--wait</code> makes waiting explicit and does not
              create a background job. Run IDs refer to local records in{" "}
              <code>.frontier/runs/</code>.
            </p>
            {!isDisaster ? (
              <p>
                The default public Episode is pinned during initialization. Read its ID in the lock
                and arena inspection output. To run another listed public Episode, use{" "}
                <code>practice --project rescue-doctrine --episode &lt;episode-id&gt; --wait</code>;
                compare only Doctrine Runs for the same Episode.
              </p>
            ) : null}
          </section>
          <section id="compare">
            <h2>Compare results</h2>
            <p>
              After changing the artifact and running Practice again, use the two IDs from{" "}
              <code>runs list</code>. Replace all angle-bracket placeholders below with actual IDs.
            </p>
            <CodeBlock
              label="Inspect and compare local Runs"
              code={`${cli} runs inspect <run-id> ${project}\n${cli} compare <run-a> <run-b> ${project}`}
            />
            <p>
              Comparison keeps each metric&apos;s value, direction, unit, and difference separate.
              Outcomes can be A dominates, B dominates, trade-off, or equal. There is no weighted
              total or implied full-field ranking.
            </p>
            <p>
              Arena, evaluator, dataset, constraints, metrics, context, and evidence class must
              match. Rescue Room also requires matching Doctrine runtime context and Episode. Failed
              or missing correctness evidence excludes a result from eligible Pareto comparison.
            </p>
          </section>
          <section id="submit">
            <h2>Sign in & submit</h2>
            <p>
              Disaster Response only. Run these commands inside your Disaster Response project.
              Browser authorization uses the account you want to own the saved revision.
            </p>
            <CodeBlock
              label="Authorize and save a revision"
              code={`${cli} auth login\n${cli} auth status\n${cli} submit --project disaster-strategy\n${cli} submissions list --project disaster-strategy`}
            />
            <p>
              Review the confirmation before submitting. The command may register the account if
              needed and saves one revision. Submission does not select the Final Entry. Keep{" "}
              <code>--yes</code> for explicitly approved automation; <code>--json</code> never
              counts as consent.
            </p>
            <CodeBlock
              label="Read, download, and select a saved revision"
              code={`${cli} submissions inspect <submission-id> --project disaster-strategy\n${cli} submissions download <submission-id> --project disaster-strategy --output submitted-strategy.json\n${cli} entry select <submission-id> --project disaster-strategy\n${cli} open <submission-id> --project disaster-strategy`}
            />
            <p>
              <code>entry select</code> confirms the revision to use and follows the server&apos;s
              current selection rules. Viewing a saved result never selects it. A selected entry is
              not proof of a deadline lock, commitment, or payment.
            </p>
            <p>
              <code>open</code> uses <code>/submissions/&lt;id&gt;?arena=disaster-response</code>.
              Sign in to the same account in the browser. Local Practice Runs stay in{" "}
              <code>runs inspect</code> and have no saved-result URL.
            </p>
          </section>
          <section id="sdk">
            <h2>TypeScript SDK</h2>
            <p>
              This example follows the local SDK 0.3.0 API. The SDK and shared definitions are
              workspace packages in this repository.
            </p>
            <p>
              Put the example in <code>practice.ts</code> inside the <code>disaster-strategy</code>
              project created earlier. It reads the existing Strategy and pinned context, then calls
              public Practice without authentication. The SDK returns a result to your script;
              unlike the CLI it does not write a local Run.
            </p>
            <CodeBlock label="Build the workspace SDK" code={"pnpm build:tooling"} />
            <CodeBlock label="practice.ts" code={sdkExample.source} />
            <CodeBlock
              label="Run the SDK example from the repository root"
              code={"pnpm exec tsx disaster-strategy/practice.ts"}
            />
          </section>
          <section id="agents">
            <h2>AI agents</h2>
            <CodeBlock
              label="Machine-readable Practice"
              code={`${cli} arenas inspect disaster-response --json\n${cli} practice ${project} --wait --json\n${cli} compare <run-a> <run-b> ${project} --json`}
            />
            <blockquote>
              Read the public arena conditions. Evaluate up to three candidate strategies within the
              current limits, explain each metric&apos;s trade-offs, and propose a revision for
              review.
            </blockquote>
            <p>
              Preserve Agent provenance in the project configuration, including name, version, and
              objective. Provenance does not add reward points. Submission and Final Entry changes
              require explicit authorization; a reusable Agent Skill and Bazantic Recipe are outside
              this local preview.
            </p>
          </section>
          <section id="reference">
            <h2>Command reference</h2>
            <p>
              Generated from the local CLI {reference.version} command definitions used by
              <code> --help</code>. Check your installed bundle with <code>--version</code>. Prefix
              each command below with <code>{cli}</code>.
            </p>
            <div className={styles.tableWrap} tabIndex={0} aria-label="CLI command reference">
              <table>
                <thead>
                  <tr>
                    <th>Command</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {reference.commands.map((command) => (
                    <tr key={command.name}>
                      <th>
                        <code>
                          {command.name}
                          {command.args.map((arg) => ` <${arg}>`).join("")}
                        </code>
                      </th>
                      <td>
                        {command.summary}
                        {Object.entries(command.options).map(([name, option]) => (
                          <div key={name}>
                            <code>
                              --{name}
                              {option.type === "string" ? " <value>" : ""}
                            </code>
                            : {option.description}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <code>--project &lt;directory&gt;</code> targets a project from another working
              directory.
              <code> --timeout-ms &lt;milliseconds&gt;</code> sets the request timeout.
              <code> auth login --no-browser</code> supports a terminal without automatic browser
              launch. <code>open --print-url</code> prints the saved-result link. Neither link
              contains credentials or the Strategy body.
            </p>
          </section>
          <section id="evidence">
            <h2>Evidence & conditions</h2>
            <dl className={styles.states}>
              <div>
                <dt>Validated</dt>
                <dd>Local input checks passed. Runtime correctness may still fail.</dd>
              </div>
              <div>
                <dt>Measured</dt>
                <dd>
                  A deterministic evaluator produced results. Disaster Response measures the public
                  model, not real disaster operations.
                </dd>
              </div>
              <div>
                <dt>Simulated</dt>
                <dd>
                  Rescue Room Doctrine outcomes and game-credit payments remain simulated. Practice
                  credits are not tokens.
                </dd>
              </div>
              <div>
                <dt>Saved / selected</dt>
                <dd>
                  A server revision exists / the server currently identifies it as the Final Entry.
                  These are distinct actions.
                </dd>
              </div>
              <div>
                <dt>Committed</dt>
                <dd>
                  Corresponding onchain commitment evidence exists. A context hash or selected entry
                  alone does not prove this.
                </dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>
                  Transfer, event, and recipient evidence exist. A reward preview is not a payment.
                </dd>
              </div>
            </dl>
            <p>
              Preserve official context, manifest, input, and result hashes. A local file checksum
              is only file-integrity evidence. Public Practice does not establish a production
              tournament, hidden-final evaluation, or automatic reward payment.
            </p>
          </section>
          <section id="troubleshooting">
            <h2>Troubleshooting</h2>
            <dl className={styles.states}>
              <div>
                <dt>Invalid input</dt>
                <dd>
                  Fix the reported field and run <code>check</code> again. Do not treat unevaluated
                  constraints as passed.
                </dd>
              </div>
              <div>
                <dt>Expired authorization</dt>
                <dd>
                  Run <code>auth status</code>, then <code>auth login</code> for the same origin and
                  owning account.
                </dd>
              </div>
              <div>
                <dt>Context mismatch</dt>
                <dd>
                  Inspect <code>context inspect</code>. Review and explicitly confirm{" "}
                  <code>context update</code> before making new Runs; old Runs keep their original
                  conditions.
                </dd>
              </div>
              <div>
                <dt>Practice limit reached</dt>
                <dd>
                  Respect the server&apos;s retry delay. Repeating Practice may consume another
                  attempt.
                </dd>
              </div>
              <div>
                <dt>Submission response lost</dt>
                <dd>
                  Inspect your saved submissions, then use{" "}
                  <code>submit --resume &lt;operation-id&gt;</code> with the recorded operation. Do
                  not start a fresh submission to guess whether the first saved.
                </dd>
              </div>
              <div>
                <dt>Practice timeout</dt>
                <dd>
                  The server may still have evaluated the request. There is no remote Run-status
                  endpoint; do not infer cancellation or blindly retry.
                </dd>
              </div>
              <div>
                <dt>Saved result missing</dt>
                <dd>
                  Check <code>submissions list</code> and the browser account. Unknown IDs and
                  revisions belonging to another account are unavailable in your list. A local Run
                  ID cannot open a saved page.
                </dd>
              </div>
              <div>
                <dt>Service unavailable</dt>
                <dd>
                  Read <code>arenas inspect</code> for missing services. Rescue Room submission is
                  unsupported; Practice does not save a server revision.
                </dd>
              </div>
            </dl>
            <Link href="/arenas/emergency-supply">Return to Disaster Response</Link>
          </section>
        </article>
      </div>
    </main>
  );
}
