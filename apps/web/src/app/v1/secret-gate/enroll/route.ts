import { secretGateEnrollmentSchema } from "@frontier/secret-gate";
import { secretGateError, secretGateJson } from "@/lib/secret-gate-http";
import { requireDurableSecretGateStore } from "@/lib/secret-gate-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { commitment } = secretGateEnrollmentSchema.parse(await request.json());
    const store = requireDurableSecretGateStore();
    const snapshot = await store.createSnapshot(commitment);
    return secretGateJson({ storage: store.durability, snapshot }, 201);
  } catch (cause) {
    return secretGateError(cause);
  }
}
