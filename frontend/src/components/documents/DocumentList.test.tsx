/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "./DocumentList";

function stubList(response: () => Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response()));
}

describe("DocumentList", () => {
  it("lists the user's documents with their parties and last update, linking to each", async () => {
    stubList(() =>
      Response.json([
        { id: 2, documentId: "pilot-agreement", name: "Pilot Agreement", companies: ["Acme Inc", "Globex LLC"], updatedAt: "2026-10-13T15:04:05.000Z" },
        { id: 1, documentId: "mutual-nda", name: "Mutual Non-Disclosure Agreement", companies: [], updatedAt: "2026-10-12T09:00:00.000Z" },
      ]),
    );
    render(<DocumentList />);

    const items = within(await screen.findByRole("list", { name: "Your documents" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const first = within(items[0]).getByRole("link");
    expect(first).toHaveAttribute("href", expect.stringMatching(/^\/create\/?\?doc=2$/));
    expect(first).toHaveTextContent("Pilot Agreement");
    expect(first).toHaveTextContent("Acme Inc and Globex LLC");
    expect(first).toHaveTextContent(/Updated Oct 13, 2026/);
    expect(items[1]).toHaveTextContent("Parties not named yet");
  });

  it("invites a new user to start a document", async () => {
    stubList(() => Response.json([]));
    render(<DocumentList />);

    expect(await screen.findByRole("heading", { name: "No documents yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a document" })).toHaveAttribute("href", expect.stringMatching(/^\/create\/?$/));
  });

  it("shows a loading state, then an error if the list cannot be loaded", async () => {
    stubList(() => new Response(null, { status: 500 }));
    render(<DocumentList />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your documents…");
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  });
});
