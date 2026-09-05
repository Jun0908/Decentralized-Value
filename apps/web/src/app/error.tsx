"use client";
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="page-shell detail-page">
      <section className="empty-state">
        <div>
          <p className="eyebrow">Dependency failure</p>
          <h1>The evidence path is unavailable.</h1>
          <p>The application did not replace missing data with placeholders.</p>
          <button onClick={retry}>Try again</button>
        </div>
      </section>
    </main>
  );
}
