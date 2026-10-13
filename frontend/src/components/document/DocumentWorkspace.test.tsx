/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toWire } from "@/lib/document/chat";
import { documentTypes, filledValues } from "@/test/fixtures";
import { GREETING } from "./DocumentChat";
import { DocumentWorkspace } from "./DocumentWorkspace";

let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

const MESSAGES = [
  { role: "assistant", content: GREETING },
  { role: "user", content: "An NDA" },
  { role: "assistant", content: "Here is your NDA." },
];

function stubApi(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (url: string) => routes[url]());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const renderWorkspace = () => render(<DocumentWorkspace documentTypes={documentTypes} />);

beforeEach(() => {
  search = "";
  vi.spyOn(window.history, "replaceState");
});

describe("DocumentWorkspace", () => {
  it("starts a new document without loading anything", () => {
    const fetchMock = stubApi({});
    renderWorkspace();
    expect(screen.getByRole("log", { name: "Conversation" })).toHaveTextContent(GREETING);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the saved document named by ?doc=", async () => {
    search = "doc=4";
    stubApi({ "/api/documents/4": () => Response.json({ values: toWire(filledValues()), messages: MESSAGES }) });
    renderWorkspace();

    expect(screen.getByRole("status")).toHaveTextContent("Opening your document…");
    const log = within(await screen.findByRole("log", { name: "Conversation" }));
    expect(log.getByText("Here is your NDA.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Agreement preview" })).toHaveTextContent("Acme Inc");
  });

  it("explains when a document cannot be opened", async () => {
    search = "doc=99";
    stubApi({ "/api/documents/99": () => new Response(null, { status: 404 }) });
    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "This document could not be opened" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to My documents" })).toHaveAttribute("href", expect.stringMatching(/^\/documents\/?$/));
  });

  it("explains, without calling the API, when ?doc= is not a document id", async () => {
    search = "doc=abc";
    const fetchMock = stubApi({});
    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "This document could not be opened" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves a new document to its own URL once it is saved", async () => {
    stubApi({
      "/api/chat": () => Response.json({ reply: "Let's draft an NDA.", values: toWire(filledValues()) }),
      "/api/documents": () => Response.json({ id: 5 }, { status: 201 }),
    });
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByRole("textbox", { name: "Message" }), "An NDA");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await vi.waitFor(() => expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "?doc=5"));
  });
});

describe("DocumentWorkspace after the user has left", () => {
  it("does not navigate back when a save finishes later", async () => {
    let finishSave!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/chat"
          ? Response.json({ reply: "Let's draft an NDA.", values: toWire(filledValues()) })
          : new Promise<Response>((resolve) => (finishSave = resolve)),
      ),
    );
    const user = userEvent.setup();
    const { unmount } = renderWorkspace();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "An NDA");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(finishSave).toBeDefined());

    unmount();
    finishSave(Response.json({ id: 5 }, { status: 201 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});

describe("DocumentWorkspace keeping the conversation in place", () => {
  function stubNewDocument() {
    stubApi({
      "/api/chat": () => Response.json({ reply: "Let's draft an NDA.", values: toWire(filledValues()) }),
      "/api/documents": () => Response.json({ id: 5 }, { status: 201 }),
    });
  }

  it("keeps the creator, and what the user is typing, when a new document moves to ?doc=ID", async () => {
    stubNewDocument();
    const user = userEvent.setup();
    const { rerender } = renderWorkspace();
    const box = screen.getByRole("textbox", { name: "Message" });
    await user.type(box, "An NDA");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(window.history.replaceState).toHaveBeenCalled());
    await user.type(box, "Acme and Globex");

    search = "doc=5";
    rerender(<DocumentWorkspace documentTypes={documentTypes} />);

    expect(screen.getByRole("textbox", { name: "Message" })).toBe(box);
    expect(box).toHaveValue("Acme and Globex");
  });

  it("starts a fresh document when the user then goes to /create/ again", async () => {
    stubNewDocument();
    const user = userEvent.setup();
    const { rerender } = renderWorkspace();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "An NDA");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(window.history.replaceState).toHaveBeenCalled());
    search = "doc=5";
    rerender(<DocumentWorkspace documentTypes={documentTypes} />);

    search = "";
    rerender(<DocumentWorkspace documentTypes={documentTypes} />);

    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log).toHaveTextContent(GREETING);
    expect(log).not.toHaveTextContent("Let's draft an NDA.");
  });
});
