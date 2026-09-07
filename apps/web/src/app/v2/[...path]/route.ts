import { frontierDemoApi } from "@/lib/frontier-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return frontierDemoApi.fetch(request);
}

export async function POST(request: Request) {
  return frontierDemoApi.fetch(request);
}

export async function PUT(request: Request) {
  return frontierDemoApi.fetch(request);
}
