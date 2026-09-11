import type { Metadata } from "next";
import { SubmissionResult } from "@/components/submission-result";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Submission | Frontier Protocol",
  description: "Sign in to inspect your saved Disaster Response strategy, evaluation, and replay.",
  robots: { index: false, follow: false },
};

export default async function SubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ arena?: string | string[] }>;
}) {
  const { id } = await params;
  const { arena } = await searchParams;
  return <SubmissionResult id={id} arena={arena ?? "disaster-response"} />;
}
