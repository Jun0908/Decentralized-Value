import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("v1 route handler", () => {
  it("forwards the PUT method used to select a Final Entry", async () => {
    const routeSource = await readFile(new URL("./[...path]/route.ts", import.meta.url), "utf8");

    expect(routeSource).toMatch(/handle as PUT/);
  });
});
