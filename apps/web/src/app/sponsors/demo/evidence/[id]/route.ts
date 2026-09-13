import ens from "../../../../../../../../Docs/evidence/deployments/ensv2-rescue-demo.json";
import cre from "../../../../../../../../Docs/evidence/deployments/chainlink-cre-private-pack.json";
import bazantic from "../../../../../../../../Docs/evidence/deployments/bazantic-rescue-agent-demo.json";

const evidence = { ens, cre, bazantic };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (id !== "ens" && id !== "cre" && id !== "bazantic") {
    return Response.json({ error: "EVIDENCE_NOT_FOUND" }, { status: 404 });
  }
  return new Response(JSON.stringify(evidence[id], null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sponsor-${id}-evidence.json"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
