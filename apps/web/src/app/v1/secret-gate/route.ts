import { publicSecretGateScenario } from "@frontier/secret-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(publicSecretGateScenario(), {
    headers: { "cache-control": "no-store" },
  });
}
