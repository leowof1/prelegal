import { describe, expect, it, vi } from "vitest";
import { filledValues } from "@/test/fixtures";
import { fromWire, sendChat, toWire } from "./chat";

describe("toWire and fromWire", () => {
  it("round-trips filled values", () => {
    const values = filledValues();
    expect(toWire(values).terms).toContainEqual({ key: "governingLaw", value: "Delaware" });
    expect(fromWire(toWire(values), values)).toEqual(values);
  });

  it("keeps terms the reply leaves out, so shared terms carry over to a new document", () => {
    const previous = filledValues();
    const wire = {
      ...toWire(previous),
      documentId: "pilot-agreement",
      terms: [{ key: "pilotPeriod", value: "90 days" }],
    };
    const values = fromWire(wire, previous);
    expect(values.documentId).toBe("pilot-agreement");
    expect(values.terms).toMatchObject({ pilotPeriod: "90 days", governingLaw: "Delaware" });
  });
});

describe("sendChat", () => {
  it("posts the conversation and values and returns the updated values", async () => {
    const values = filledValues();
    const reply = { ...toWire(values), terms: [{ key: "governingLaw", value: "New York" }] };
    const fetchMock = vi.fn(async () => Response.json({ reply: "Done.", values: reply }));
    vi.stubGlobal("fetch", fetchMock);
    const messages = [{ role: "user" as const, content: "Use New York law." }];

    const result = await sendChat(messages, values);

    expect(result).toEqual({
      reply: "Done.",
      values: { ...values, terms: { ...values.terms, governingLaw: "New York" } },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ messages, values: toWire(values) });
  });

  it("throws when the server responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    await expect(sendChat([], filledValues())).rejects.toThrow("POST /api/chat failed: 500");
  });
});
