import { frontierDemoApi } from "@/lib/frontier-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request) {
  return frontierDemoApi.fetch(request);
}

export { handle as GET, handle as POST, handle as PUT };
