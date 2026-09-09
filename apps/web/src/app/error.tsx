"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-shell detail-page">
      <section className="empty-state">
        <div>
          <p className="eyebrow">Interactive view stopped</p>
          <h1>The simulation needs to restart.</h1>
          <p>Your strategy is safe. Reload the page, then run the simulation again.</p>
          <button onClick={() => window.location.reload()}>Reload simulation</button>
        </div>
      </section>
    </main>
  );
}
