import { describe, expect, it, vi } from "vitest";
import { filledValues } from "@/test/fixtures";
import { toWire } from "./chat";
import { getDocument, saveDocument } from "./saved";

const MESSAGES = [{ role: "user" as const, content: "An NDA" }];

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("saved documents", () => {
  it("creates a new document and returns its id", async () => {
    const values = filledValues();
    const fetchMock = stubFetch(() => Response.json({ id: 3 }, { status: 201 }));

    expect(await saveDocument(null, { values, messages: MESSAGES })).toBe(3);
    const [url, init] = fetchMock.mock.calls[0];
    expect([url, init!.method]).toEqual(["/api/documents", "POST"]);
    expect(JSON.parse(init!.body as string)).toEqual({ values: toWire(values), messages: MESSAGES });
  });

  it("updates an existing document", async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    expect(await saveDocument(3, { values: filledValues(), messages: MESSAGES })).toBe(3);
    const [url, init] = fetchMock.mock.calls[0];
    expect([url, init!.method]).toEqual(["/api/documents/3", "PUT"]);
  });

  it("loads a document back into the frontend's shape", async () => {
    const values = filledValues();
    stubFetch(() => Response.json({ values: toWire(values), messages: MESSAGES }));
    expect(await getDocument(3)).toEqual({ values, messages: MESSAGES });
  });
});
