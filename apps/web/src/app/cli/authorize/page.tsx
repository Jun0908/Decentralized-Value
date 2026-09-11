import type { Metadata } from "next";
import { CliAuthorization } from "@/components/cli-authorization";

export const metadata: Metadata = {
  title: "Authorize CLI | Frontier Protocol",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CliAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const code =
    typeof query.user_code === "string" && /^[A-Z2-9-]{12,14}$/i.test(query.user_code)
      ? query.user_code.toUpperCase()
      : "";
  return <CliAuthorization initialCode={code} />;
}
