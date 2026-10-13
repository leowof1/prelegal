import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";
import { markSignedOut } from "./session/user";

vi.mock("./session/user", () => ({ markSignedOut: vi.fn() }));

describe("apiFetch", () => {
  it("sends JSON and parses the JSON reply", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 7 }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await apiFetch("/api/documents", "POST", { a: 1 })).toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledWith("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
  });

  it("returns nothing for 204 No Content", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    expect(await apiFetch("/api/documents/1", "PUT", {})).toBeUndefined();
  });

  it("throws on errors and signs the user out on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await expect(apiFetch("/api/documents/9")).rejects.toThrow("GET /api/documents/9 failed: 404");
    expect(markSignedOut).not.toHaveBeenCalled();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(apiFetch("/api/documents")).rejects.toThrow("401");
    expect(markSignedOut).toHaveBeenCalled();
  });
});
