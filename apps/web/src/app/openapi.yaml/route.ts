import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dynamic = "force-static";
export const runtime = "nodejs";

export async function GET() {
  const specification = await readFile(
    resolve(process.cwd(), "../../openapi/frontier-v1.yaml"),
    "utf8",
  );

  return new Response(specification, {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=86400",
      "content-type": "application/yaml; charset=utf-8",
    },
  });
}
