"use client";

import { CheckIcon, ShieldCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFrontierAccount } from "@/components/wallet-panel";
import styles from "./cli-authorization.module.css";

const scopeLabels: Record<string, string> = {
  "disaster:read": "Read your submission history",
  "disaster:join": "Join Disaster Response",
  "disaster:submit": "Submit your strategies",
  "disaster:entry": "Select your Final Entry",
};
type Review = { origin: string; scopes: string[]; expiresAt: string; session_expires_in: number };

export function CliAuthorization({ initialCode = "" }: { initialCode?: string }) {
  const account = useFrontierAccount();
  const [code, setCode] = useState(initialCode);
  const [review, setReview] = useState<Review | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"approved" | "denied" | null>(null);
  const [expired, setExpired] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    if (!review) return;
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(review.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [review]);

  async function send(action: "inspect" | "approve", decision?: "approve" | "deny") {
    if (pending.current || !account.ready || !account.authenticated || result) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const headers = await account.authHeaders();
      const response = await fetch(`/v1/cli/auth/${action}`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { ...headers, "content-type": "application/json", "x-frontier-cli-csrf": "1" },
        body: JSON.stringify({ user_code: code, ...(decision ? { decision } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.error?.code === "expired_token" || data?.error?.code === "invalid_grant")
          setExpired(true);
        throw new Error(
          typeof data?.error?.message === "string"
            ? data.error.message
            : "Authorization is unavailable. Try again.",
        );
      }
      if (action === "inspect") {
        if (
          data.origin !== window.location.origin ||
          !Array.isArray(data.scopes) ||
          !data.scopes.length ||
          data.scopes.some(
            (scope: unknown) => typeof scope !== "string" || !Object.hasOwn(scopeLabels, scope),
          ) ||
          typeof data.expiresAt !== "string" ||
          !Number.isFinite(Date.parse(data.expiresAt)) ||
          data.session_expires_in !== 28_800
        )
          throw new Error("The authorization request could not be verified.");
        setReview(data);
        setExpired(Date.parse(data.expiresAt) <= Date.now());
        setConfirmed(false);
      } else {
        if (data.status !== (decision === "approve" ? "approved" : "denied"))
          throw new Error("The authorization result could not be verified.");
        setResult(data.status);
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Authorization is unavailable. Try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send("inspect");
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <ShieldCheckIcon aria-hidden="true" />
        <div>
          <p>Frontier Protocol</p>
          <h1>Authorize CLI</h1>
        </div>
      </header>
      {result ? (
        <section className={styles.result} role="status">
          {result === "approved" ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <XMarkIcon aria-hidden="true" />
          )}
          <h2>{result === "approved" ? "CLI access approved" : "CLI access denied"}</h2>
          <p>
            {result === "approved"
              ? "Return to your terminal to finish signing in."
              : "No access was granted to this CLI request."}
          </p>
          <Link href="/arenas/emergency-supply">Back to Disaster Response</Link>
        </section>
      ) : (
        <>
          <p className={styles.intro}>Only approve a request you started on a device you trust.</p>
          {!account.configured && (
            <p className={styles.notice} role="status">
              Sign-in is unavailable on this instance. CLI authorization cannot continue.
            </p>
          )}
          {account.configured && !account.ready && <p role="status">Restoring your account...</p>}
          {account.configured && account.ready && !account.authenticated && (
            <button type="button" onClick={account.login}>
              Sign in
            </button>
          )}
          {account.authenticated && (
            <div className={styles.account}>
              <span>{account.label}</span>
              <span>{account.wallet ?? "Loading wallet..."}</span>
            </div>
          )}
          <form onSubmit={inspect} className={styles.form}>
            <label htmlFor="cli-user-code">Device confirmation code</label>
            <div className={styles.codeRow}>
              <input
                id="cli-user-code"
                value={code}
                maxLength={14}
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="ABCD-EFGH-JKLM"
                disabled={busy || !!review}
                pattern="[A-Za-z2-9]{4}-?[A-Za-z2-9]{4}-?[A-Za-z2-9]{4}"
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  setError(null);
                  setExpired(false);
                }}
              />
              {!review && (
                <button type="submit" disabled={busy || !account.ready || !account.authenticated}>
                  {busy ? "Checking..." : "Review request"}
                </button>
              )}
            </div>
          </form>
          {review && (
            <section className={styles.review} aria-label="Requested CLI access">
              <h2>Disaster Response access</h2>
              <dl>
                <div>
                  <dt>Connection</dt>
                  <dd>{review.origin}</dd>
                </div>
                <div>
                  <dt>Session duration</dt>
                  <dd>8 hours</dd>
                </div>
                <div>
                  <dt>Approval deadline</dt>
                  <dd>
                    <time dateTime={review.expiresAt}>
                      {new Date(review.expiresAt).toLocaleString()}
                    </time>
                  </dd>
                </div>
              </dl>
              <ul>
                {review.scopes.map((scope) => (
                  <li key={scope}>
                    <CheckIcon aria-hidden="true" />
                    {scopeLabels[scope]}
                  </li>
                ))}
              </ul>
              <p className={styles.muted}>
                This access cannot move funds, manage Value Pools, or authorize wallet transactions.
              </p>
              <label className={styles.confirm}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy || expired}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>I started this request and the code matches my terminal.</span>
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={
                    !confirmed || busy || expired || !account.ready || !account.authenticated
                  }
                  onClick={() => void send("approve", "approve")}
                >
                  <CheckIcon aria-hidden="true" />
                  Approve access
                </button>
                <button
                  type="button"
                  className={styles.deny}
                  disabled={busy || expired || !account.ready || !account.authenticated}
                  onClick={() => void send("approve", "deny")}
                >
                  <XMarkIcon aria-hidden="true" />
                  Deny
                </button>
              </div>
            </section>
          )}
          {busy && review && <p role="status">Saving your decision...</p>}
          {expired && (
            <p className={styles.notice} role="status">
              This request is no longer available. Start a new sign-in from your CLI.
            </p>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {review && !busy && (
            <button
              type="button"
              className={styles.change}
              onClick={() => {
                setReview(null);
                setConfirmed(false);
                setExpired(false);
                setError(null);
              }}
            >
              Use another code
            </button>
          )}
        </>
      )}
    </main>
  );
}
