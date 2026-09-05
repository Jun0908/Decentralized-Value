import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-shell detail-page">
      <section className="empty-state">
        <div>
          <p className="eyebrow">404 / outside the set</p>
          <h1>Artifact not found.</h1>
          <p>No measured artifact or arena matches this identifier.</p>
          <Link className="primary-action" href="/arena">
            Return to the frontier
          </Link>
        </div>
      </section>
    </main>
  );
}
