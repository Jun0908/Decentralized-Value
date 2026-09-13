import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn<(path: string) => never>(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import RescueRoomPage from "./page";

describe("Rescue Room parent route", () => {
  it("redirects to the playable Arena, not an operator execution route", () => {
    expect(() => RescueRoomPage()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/arenas/rescue-room");
  });
});
