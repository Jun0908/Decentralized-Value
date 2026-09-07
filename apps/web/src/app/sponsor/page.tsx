import type { Metadata } from "next";
import { SponsorDraftBuilder } from "@/components/sponsor-draft-builder";

export const metadata: Metadata = {
  title: "Sponsor draft | Value Decentralization",
  description: "Preview a Frontier Challenge manifest without claiming publication or funding.",
};

export default function SponsorPage() {
  return (
    <main className="page-shell sponsor-page">
      <header className="catalog-heading">
        <p className="eyebrow">Challenge sponsor console</p>
        <h1>Fund a wider possibility space.</h1>
        <p>
          Define the tension, correctness rules, and measurement bounds before builders submit. This
          local console creates a verifiable draft; it cannot publish or fund a market yet.
        </p>
      </header>
      <SponsorDraftBuilder />
    </main>
  );
}
