import { describe, expect, it, vi } from "vitest";
import { filledValues } from "@/test/fixtures";
import { fromWire, sendChat } from "./chat";

describe("fromWire", () => {
  it("keeps the previous years when the reply has null years", () => {
    const previous = { ...filledValues(), confidentialityTerm: { kind: "years" as const, years: 3 } };
    const wire = { ...previous, confidentialityTerm: { kind: "perpetual" as const, years: null } };
    expect(fromWire(wire, previous).confidentialityTerm).toEqual({ kind: "perpetual", years: 3 });
  });

  it("returns filled values unchanged", () => {
    const values = filledValues();
    expect(fromWire(values, values)).toEqual(values);
  });
});

describe("sendChat", () => {
  it("posts the conversation and values and returns the updated values", async () => {
    const values = filledValues();
    const fetchMock = vi.fn(async () => Response.json({ reply: "Done.", values: { ...values, governingLaw: "New York" } }));
    vi.stubGlobal("fetch", fetchMock);
    const messages = [{ role: "user" as const, content: "Use New York law." }];

    const result = await sendChat(messages, values);

    expect(result).toEqual({ reply: "Done.", values: { ...values, governingLaw: "New York" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ messages, values });
  });

  it("sends an empty years field as null", async () => {
    const fetchMock = vi.fn(async () => Response.json({ reply: "Done.", values: filledValues() }));
    vi.stubGlobal("fetch", fetchMock);

    await sendChat([], { ...filledValues(), mndaTerm: { kind: "expires", years: NaN } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).values.mndaTerm).toEqual({ kind: "expires", years: null });
  });

  it("throws when the server responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(sendChat([], filledValues())).rejects.toThrow("Chat request failed: 500");
  });
});
