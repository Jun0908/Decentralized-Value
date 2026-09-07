import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-shell detail-page">
      <section className="empty-state">
        <div>
          <p className="eyebrow">404 / no arena here</p>
          <h1>This frontier does not exist.</h1>
          <p>Choose one of the available arenas and start from its shared rules.</p>
          <Link className="primary-action" href="/arenas">
            Explore arenas
          </Link>
        </div>
      </section>
    </main>
  );
}
