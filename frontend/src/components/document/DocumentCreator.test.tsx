/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WireValues } from "@/lib/document/chat";
import type { Block } from "@/lib/document/types";
import { defaultDocumentValues } from "@/lib/document/build";
import { documentTypes } from "@/test/fixtures";
import { GREETING } from "./DocumentChat";
import { DocumentCreator } from "./DocumentCreator";

const renderDocumentPdf = vi.fn<(title: string, blocks: Block[]) => Promise<Blob>>();
vi.mock("./document-pdf", () => ({
  renderDocumentPdf: (title: string, blocks: Block[]) => renderDocumentPdf(title, blocks),
}));

interface ChatBody {
  messages: { role: string; content: string }[];
  values: WireValues;
}

/**
 * Stubs the API: each /api/chat call replies with `reply` and the sent values updated by `update`;
 * saving a new document returns id 1.
 */
function stubChat(reply: string, update: (values: WireValues) => WireValues = (v) => v) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    if (url.startsWith("/api/documents")) {
      return init.method === "POST" ? Response.json({ id: 1 }, { status: 201 }) : new Response(null, { status: 204 });
    }
    const body: ChatBody = JSON.parse(init.body as string);
    return Response.json({ reply, values: update(body.values) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const calls = (prefix: string) => fetchMock.mock.calls.filter(([url]) => url.startsWith(prefix));
  const bodies = () => calls("/api/chat").map(([, init]) => JSON.parse(init.body as string) as ChatBody);
  const saves = () =>
    calls("/api/documents").map(([url, init]) => ({ url, method: init.method, body: JSON.parse(init.body as string) as ChatBody }));
  return { fetchMock, bodies, saves };
}

const EMPTY_PARTY = { name: "", title: "", company: "", noticeAddress: "" };

/** A reply update that chooses the Mutual NDA and applies `terms`. */
const nda =
  (terms: WireValues["terms"] = [], patch: Partial<WireValues> = {}) =>
  (v: WireValues): WireValues => ({ ...v, documentId: "mutual-nda", terms, ...patch });

function setup(props: Omit<ComponentProps<typeof DocumentCreator>, "documentTypes"> = {}) {
  const user = userEvent.setup();
  render(<DocumentCreator documentTypes={documentTypes} {...props} />);
  const preview = () => within(screen.getByRole("region", { name: "Agreement preview" }));
  const log = within(screen.getByRole("log", { name: "Conversation" }));
  async function say(text: string) {
    await user.type(screen.getByRole("textbox", { name: "Message" }), text);
    await user.click(screen.getByRole("button", { name: "Send" }));
  }
  /** Sends a message and waits for the assistant's reply. */
  async function exchange(text: string, reply: string) {
    await say(text);
    await log.findByText(reply);
  }
  return { user, preview, log, say, exchange };
}

beforeEach(() => {
  // Freeze only Date so "today" is deterministic without stalling user-event timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 4, 12));
});

afterEach(() => {
  vi.useRealTimers();
  renderDocumentPdf.mockReset();
});

describe("DocumentCreator before a document is chosen", () => {
  it("lists the documents the assistant can draft instead of a preview", () => {
    setup();
    const list = within(screen.getByRole("region", { name: "Available documents" }));

    expect(list.getAllByRole("listitem")).toHaveLength(11);
    expect(list.getByText("Cloud Service Agreement")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Agreement preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
  });

  it("keeps the list when the assistant declines an unsupported document", async () => {
    stubChat("I can't draft an employment contract. The closest is a Professional Services Agreement.");
    const { exchange } = setup();

    await exchange("I need an employment contract", "I can't draft an employment contract. The closest is a Professional Services Agreement.");

    expect(screen.getByRole("region", { name: "Available documents" })).toBeInTheDocument();
  });
});

describe("DocumentCreator preview", () => {
  it("shows the chosen document's cover page with today's date and the full Standard Terms", async () => {
    stubChat("Let's draft an NDA.", nda([{ key: "purpose", value: "Evaluating a merger." }]));
    const { preview, exchange } = setup();

    await exchange("An NDA please", "Let's draft an NDA.");

    expect(preview().getByRole("heading", { name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(preview().getByText("Evaluating a merger.")).toBeInTheDocument();
    expect(preview().getByText("October 4, 2026")).toBeInTheDocument();
    expect(preview().getByText("[Governing Law]")).toHaveClass("bg-amber-100");
    expect(preview().getByRole("heading", { name: "Standard Terms" })).toBeInTheDocument();
    expect(preview().getByText("Equitable Relief")).toBeInTheDocument();
    expect(preview().getAllByRole("link", { name: "CC BY 4.0" })).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Available documents" })).not.toBeInTheDocument();
  });

  it("switches to another document, keeping the parties and shared terms", async () => {
    stubChat("Let's draft an NDA.", nda([{ key: "governingLaw", value: "Delaware" }], {
      parties: [
        { name: "", title: "", company: "Acme Inc", noticeAddress: "" },
        { name: "", title: "", company: "Globex LLC", noticeAddress: "" },
      ],
    }));
    const { preview, exchange } = setup();
    await exchange("An NDA between Acme and Globex, Delaware law", "Let's draft an NDA.");

    stubChat("Switched to a Pilot Agreement.", (v) => ({
      ...v,
      documentId: "pilot-agreement",
      terms: [{ key: "pilotPeriod", value: "90 days" }],
    }));
    await exchange("Actually, a pilot for 90 days", "Switched to a Pilot Agreement.");

    expect(preview().getAllByRole("heading", { name: "Pilot Agreement" })).toHaveLength(2);
    expect(preview().getByText("90 days")).toBeInTheDocument();
    expect(preview().getByText("Delaware")).toBeInTheDocument();
    const headers = within(preview().getByRole("table")).getAllByRole("columnheader");
    expect(headers.map((th) => th.textContent)).toEqual(["Field", "Provider", "Customer"]);
    const companyRow = preview().getByRole("rowheader", { name: "Company" }).closest("tr")!;
    expect(within(companyRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Acme Inc", "Globex LLC"]);
  });
});

describe("DocumentCreator chat", () => {
  it("greets the user without calling the AI", () => {
    const { fetchMock } = stubChat("unused");
    const { log } = setup();

    expect(log.getByText(GREETING)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the conversation with the current values", async () => {
    const { bodies } = stubChat("Which document do you need?");
    const { log, exchange } = setup();

    await exchange("Acme Inc and Globex LLC", "Which document do you need?");

    expect(log.getByText("Acme Inc and Globex LLC")).toBeInTheDocument();
    const [body] = bodies();
    expect(body.messages).toEqual([
      { role: "assistant", content: GREETING },
      { role: "user", content: "Acme Inc and Globex LLC" },
    ]);
    expect(body.values).toMatchObject({ documentId: null, effectiveDate: "2026-10-04", terms: [] });
  });

  it("sends the values updated by the previous reply on the next turn", async () => {
    const { bodies } = stubChat("Noted.", nda([{ key: "governingLaw", value: "Delaware" }]));
    const { say, exchange } = setup();

    await exchange("An NDA under Delaware law", "Noted.");
    await say("Courts in Wilmington");
    await waitFor(() => expect(bodies()).toHaveLength(2));

    expect(bodies()[1].values.documentId).toBe("mutual-nda");
    expect(bodies()[1].values.terms).toEqual([{ key: "governingLaw", value: "Delaware" }]);
    expect(bodies()[1].messages.map((m) => m.content)).toEqual([
      GREETING,
      "An NDA under Delaware law",
      "Noted.",
      "Courts in Wilmington",
    ]);
  });

  it("shows a thinking indicator and blocks sending while waiting", async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (respond = r))));
    const { user, log, say } = setup();

    await say("Hello");

    expect(log.getByText("Thinking…")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Again");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    const { values } = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    respond(Response.json({ reply: "Hi there.", values }));
    expect(await log.findByText("Hi there.")).toBeInTheDocument();
    expect(log.queryByText("Thinking…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("disables Send for an empty message", async () => {
    const { user } = setup();
    const send = screen.getByRole("button", { name: "Send" });

    expect(send).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "   ");
    expect(send).toBeDisabled();
  });

  it("shows an error, keeps the values and restores the message when the AI fails, then recovers", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    stubChat("Let's draft an NDA.", nda());
    const { user, preview, log, say, exchange } = setup();
    await exchange("An NDA", "Let's draft an NDA.");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await say("Delaware law");

    expect(await screen.findByRole("alert")).toHaveTextContent("could not respond");
    expect(consoleError).toHaveBeenCalled();
    expect(log.queryByText("Delaware law")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Delaware law");
    expect(preview().getByText("[Governing Law]")).toBeInTheDocument();

    const { bodies } = stubChat("Noted.", nda([{ key: "governingLaw", value: "Delaware" }]));
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await log.findByText("Noted.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(preview().getByText("Delaware")).toBeInTheDocument();
    expect(bodies()[0].messages.map((m) => m.content)).toEqual([GREETING, "An NDA", "Let's draft an NDA.", "Delaware law"]);
  });
});

describe("DocumentCreator AI output safety", () => {
  it("renders markup from the AI literally in the preview and the chat", async () => {
    const markup = "**bold** [x](https://evil.test) <b>tag</b>";
    stubChat(`<i>${markup}</i>`, nda([{ key: "purpose", value: markup }]));
    const { preview, log, say } = setup();

    await say("Hi");

    expect(await log.findByText(`<i>${markup}</i>`)).toBeInTheDocument();
    expect(preview().getByText(markup)).toBeInTheDocument();
    expect(preview().queryByRole("link", { name: "x" })).not.toBeInTheDocument();
    expect(preview().queryByText("bold", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("warns about characters the PDF cannot display", async () => {
    stubChat("Noted.", nda([], { parties: [EMPTY_PARTY, { ...EMPTY_PARTY, company: "Łódź Müller" }] }));
    const { exchange } = setup();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await exchange("The other party is Łódź Müller", "Noted.");

    expect(screen.getByRole("status")).toHaveTextContent("can't display these characters");
    expect(screen.getByRole("status")).toHaveTextContent("Ł ź");
    expect(screen.getByRole("status")).not.toHaveTextContent("ü");
  });
});

describe("DocumentCreator PDF download", () => {
  let click: ReturnType<typeof vi.spyOn>;
  let downloads: { href: string; download: string }[];

  beforeEach(() => {
    downloads = [];
    click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, download: this.download });
    });
    // jsdom has no object URLs; install stubs and remove them again afterwards.
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:doc"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    click.mockRestore();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it("renders the chat-filled document and downloads it with a document and party-based filename", async () => {
    let resolve!: (blob: Blob) => void;
    renderDocumentPdf.mockReturnValue(new Promise((r) => (resolve = r)));
    stubChat("Noted.", nda([], { parties: [{ ...EMPTY_PARTY, company: "Acme Inc" }, EMPTY_PARTY] }));
    const { user, exchange } = setup();
    await exchange("An NDA for Acme Inc", "Noted.");

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    const busy = screen.getByRole("button", { name: "Preparing PDF…" });
    expect(busy).toBeDisabled();
    const [title, blocks] = renderDocumentPdf.mock.calls[0];
    expect(title).toBe("Mutual Non-Disclosure Agreement");
    expect(JSON.stringify(blocks)).toContain("Acme Inc");

    resolve(new Blob(["%PDF-"], { type: "application/pdf" }));

    await waitFor(() =>
      expect(downloads).toEqual([{ href: "blob:doc", download: "Mutual-Non-Disclosure-Agreement-Acme-Inc.pdf" }]),
    );
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:doc"));
  });

  it("shows an error and recovers when PDF generation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");
    renderDocumentPdf.mockRejectedValueOnce(failure);
    stubChat("Noted.", nda());
    const { user, exchange } = setup();
    await exchange("An NDA", "Noted.");

    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate the PDF");
    expect(downloads).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(failure);

    renderDocumentPdf.mockResolvedValueOnce(new Blob(["%PDF-"]));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("DocumentCreator accessibility semantics", () => {
  it("names the message box and labels who said what", async () => {
    stubChat("Noted.");
    const { log, exchange } = setup();

    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    await exchange("Hello", "Noted.");

    expect(log.getAllByText("Assistant:")).toHaveLength(2);
    expect(log.getAllByText("You:")).toHaveLength(1);
  });

  it("makes the scrollable conversation and preview keyboard focusable", async () => {
    stubChat("Noted.", nda());
    const { exchange } = setup();
    expect(screen.getByRole("log", { name: "Conversation" })).toHaveAttribute("tabindex", "0");

    await exchange("An NDA", "Noted.");
    expect(screen.getByRole("region", { name: "Agreement preview" })).toHaveAttribute("tabindex", "0");
  });
});

describe("DocumentCreator saving", () => {
  it("does not save until a document is chosen", async () => {
    const { saves } = stubChat("Which document do you need?");
    const { exchange } = setup();
    await exchange("Hello", "Which document do you need?");
    expect(saves()).toEqual([]);
  });

  it("saves a new document after the reply that chooses it, then updates it on later turns", async () => {
    const onSaved = vi.fn();
    const { saves } = stubChat("Let's draft an NDA.", nda([{ key: "governingLaw", value: "Delaware" }]));
    const { exchange } = setup({ onSaved });

    await exchange("An NDA under Delaware law", "Let's draft an NDA.");
    expect(await screen.findByText("Saved to My documents")).toBeInTheDocument();
    const [created] = saves();
    expect([created.url, created.method]).toEqual(["/api/documents", "POST"]);
    expect(created.body.values.documentId).toBe("mutual-nda");
    expect(created.body.messages.map((m) => m.content)).toEqual([GREETING, "An NDA under Delaware law", "Let's draft an NDA."]);
    expect(onSaved).toHaveBeenCalledWith(1, expect.objectContaining({ messages: created.body.messages }));

    const later = stubChat("Noted.");
    await exchange("Courts in Wilmington", "Noted.");
    await waitFor(() => expect(later.saves()).toHaveLength(1));
    expect([later.saves()[0].url, later.saves()[0].method]).toEqual(["/api/documents/1", "PUT"]);
    expect(later.saves()[0].body.messages).toHaveLength(5);
  });

  it("tells the user when saving fails and keeps the conversation going", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubChat("Let's draft an NDA.", nda());
    vi.mocked(fetch).mockImplementationOnce(async (url, init) => {
      const body: ChatBody = JSON.parse((init as RequestInit).body as string);
      return Response.json({ reply: "Let's draft an NDA.", values: nda()(body.values) });
    });
    vi.mocked(fetch).mockImplementationOnce(async () => new Response("", { status: 500 }));
    const { log, exchange } = setup();

    await exchange("An NDA", "Let's draft an NDA.");

    expect(await screen.findByText("Could not save your latest changes")).toBeInTheDocument();
    expect(log.getByText("An NDA")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reopens a saved document with its conversation and keeps saving to it", async () => {
    const values = { ...defaultDocumentValues("2026-10-01"), documentId: "mutual-nda", terms: { governingLaw: "Delaware" } };
    const messages = [
      { role: "assistant" as const, content: GREETING },
      { role: "user" as const, content: "An NDA under Delaware law" },
      { role: "assistant" as const, content: "Who are the parties?" },
    ];
    const { saves } = stubChat("Noted.");
    const { preview, log, exchange } = setup({ initialId: 7, initial: { values, messages } });

    expect(log.getByText("Who are the parties?")).toBeInTheDocument();
    expect(preview().getByText("Delaware")).toBeInTheDocument();
    expect(preview().getByText("October 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Saved to My documents")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();

    await exchange("Acme and Globex", "Noted.");
    await waitFor(() => expect(saves()).toHaveLength(1));
    expect([saves()[0].url, saves()[0].method]).toEqual(["/api/documents/7", "PUT"]);
    expect(saves()[0].body.messages).toHaveLength(5);
  });
});

describe("DocumentCreator disclaimer", () => {
  it("marks the previewed document as a draft subject to legal review", async () => {
    stubChat("Let's draft an NDA.", nda());
    const { exchange } = setup();
    expect(screen.queryByRole("note", { name: "Draft disclaimer" })).not.toBeInTheDocument();

    await exchange("An NDA", "Let's draft an NDA.");

    expect(screen.getByRole("note", { name: "Draft disclaimer" })).toHaveTextContent(
      "Draft only, subject to legal review.",
    );
  });
});
