/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WireValues } from "@/lib/document/chat";
import { loadNdaTemplate } from "@/lib/document/template";
import type { Block } from "@/lib/document/types";
import { filledValues } from "@/test/fixtures";
import { GREETING } from "./DocumentChat";
import { DocumentCreator } from "./DocumentCreator";

const renderDocumentPdf = vi.fn<(blocks: Block[]) => Promise<Blob>>();
vi.mock("./document-pdf", () => ({ renderDocumentPdf: (blocks: Block[]) => renderDocumentPdf(blocks) }));

const template = loadNdaTemplate();

interface ChatBody {
  messages: { role: string; content: string }[];
  values: WireValues;
}

/** Stubs /api/chat: each call replies with `reply` and the sent values updated by `update`. */
function stubChat(reply: string, update: (values: WireValues) => WireValues = (v) => v) {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body: ChatBody = JSON.parse(init.body as string);
    return Response.json({ reply, values: update(body.values) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string) as ChatBody);
  return { fetchMock, bodies };
}

function setup() {
  const user = userEvent.setup();
  render(<DocumentCreator template={template} />);
  const preview = within(screen.getByRole("region", { name: "Agreement preview" }));
  const log = within(screen.getByRole("log", { name: "Conversation" }));
  async function say(text: string) {
    await user.type(screen.getByRole("textbox", { name: "Message" }), text);
    await user.click(screen.getByRole("button", { name: "Send" }));
  }
  return { user, preview, log, say };
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

describe("DocumentCreator defaults", () => {
  it("prefills the template defaults and today's date", () => {
    const { preview } = setup();

    expect(preview.getByText("Evaluating whether to enter into a business relationship with the other party.")).toBeInTheDocument();
    expect(preview.getByText("October 4, 2026")).toBeInTheDocument();
    expect(preview.getByText("Expires 1 year from Effective Date.")).toBeInTheDocument();
    expect(preview.getByText(/^1 year from Effective Date, but in the case of trade secrets/)).toBeInTheDocument();
    expect(preview.getByText("None.")).toBeInTheDocument();
    expect(preview.getByText("[State]")).toHaveClass("bg-amber-100");
  });

  it("renders the full Standard Terms and attribution from the templates", () => {
    const { preview } = setup();

    expect(preview.getByRole("heading", { name: "Standard Terms" })).toBeInTheDocument();
    expect(preview.getByText("Equitable Relief")).toBeInTheDocument();
    expect(preview.getAllByRole("link", { name: "CC BY 4.0" })).toHaveLength(2);
  });
});

describe("DocumentCreator chat", () => {
  it("greets the user without calling the AI", () => {
    const { fetchMock } = stubChat("unused");
    const { log } = setup();

    expect(log.getByText(GREETING)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the conversation with the current values and fills the preview from the reply", async () => {
    const { bodies } = stubChat("Which state's law should govern?", (v) => ({
      ...v,
      parties: [
        { ...v.parties[0], company: "Acme Inc" },
        { ...v.parties[1], company: "Globex LLC" },
      ],
    }));
    const { preview, log, say } = setup();

    await say("Acme Inc and Globex LLC");

    expect(await log.findByText("Which state's law should govern?")).toBeInTheDocument();
    expect(log.getByText("Acme Inc and Globex LLC")).toBeInTheDocument();
    const companyRow = preview.getByRole("rowheader", { name: "Company" }).closest("tr")!;
    expect(within(companyRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Acme Inc", "Globex LLC"]);

    const [body] = bodies();
    expect(body.messages).toEqual([
      { role: "assistant", content: GREETING },
      { role: "user", content: "Acme Inc and Globex LLC" },
    ]);
    expect(body.values.effectiveDate).toBe("2026-10-04");
  });

  it("sends the values updated by the previous reply on the next turn", async () => {
    const { bodies } = stubChat("Noted.", (v) => ({ ...v, governingLaw: "Delaware" }));
    const { log, say } = setup();

    await say("Delaware law");
    await log.findByText("Noted.");
    await say("Courts in Wilmington");
    await waitFor(() => expect(bodies()).toHaveLength(2));

    expect(bodies()[1].values.governingLaw).toBe("Delaware");
    expect(bodies()[1].messages.map((m) => m.content)).toEqual([GREETING, "Delaware law", "Noted.", "Courts in Wilmington"]);
  });

  it("shows open-ended terms from the reply", async () => {
    stubChat("Done.", (v) => ({
      ...v,
      mndaTerm: { kind: "untilTerminated", years: null },
      confidentialityTerm: { kind: "perpetual", years: null },
    }));
    const { preview, log, say } = setup();

    await say("No end date, and keep it confidential forever");
    await log.findByText("Done.");

    expect(preview.getByText("Continues until terminated in accordance with the terms of the MNDA.")).toBeInTheDocument();
    expect(preview.getByText("In perpetuity.")).toBeInTheDocument();
  });

  it("shows a thinking indicator and blocks sending while waiting", async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (respond = r))));
    const { user, log, say } = setup();

    await say("Hello");

    expect(log.getByText("Thinking…")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Again");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    respond(Response.json({ reply: "Hi there.", values: filledValues() }));
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
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const { user, preview, log, say } = setup();

    await say("Delaware law");

    expect(await screen.findByRole("alert")).toHaveTextContent("could not respond");
    expect(consoleError).toHaveBeenCalled();
    expect(log.queryByText("Delaware law")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Delaware law");
    expect(preview.getByText("[State]")).toBeInTheDocument();

    const { bodies } = stubChat("Noted.", (v) => ({ ...v, governingLaw: "Delaware" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await log.findByText("Noted.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(preview.getByText("Delaware")).toBeInTheDocument();
    expect(bodies()[0].messages.map((m) => m.content)).toEqual([GREETING, "Delaware law"]);
  });
});

describe("DocumentCreator AI output safety", () => {
  it("renders markup from the AI literally in the preview and the chat", async () => {
    const markup = "**bold** [x](https://evil.test) <b>tag</b>";
    stubChat(`<i>${markup}</i>`, (v) => ({ ...v, purpose: markup }));
    const { preview, log, say } = setup();

    await say("Hi");

    expect(await log.findByText(`<i>${markup}</i>`)).toBeInTheDocument();
    expect(preview.getByText(markup)).toBeInTheDocument();
    expect(preview.queryByRole("link", { name: "x" })).not.toBeInTheDocument();
    expect(preview.queryByText("bold", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("warns about characters the PDF cannot display", async () => {
    stubChat("Noted.", (v) => ({ ...v, parties: [v.parties[0], { ...v.parties[1], company: "Łódź Müller" }] }));
    const { log, say } = setup();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await say("The other party is Łódź Müller");
    await log.findByText("Noted.");

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
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:nda"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    click.mockRestore();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it("renders the chat-filled document and downloads it with a party-based filename", async () => {
    let resolve!: (blob: Blob) => void;
    renderDocumentPdf.mockReturnValue(new Promise((r) => (resolve = r)));
    stubChat("Noted.", (v) => ({ ...v, parties: [{ ...v.parties[0], company: "Acme Inc" }, v.parties[1]] }));
    const { user, log, say } = setup();
    await say("Acme Inc");
    await log.findByText("Noted.");

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    const busy = screen.getByRole("button", { name: "Preparing PDF…" });
    expect(busy).toBeDisabled();
    expect(JSON.stringify(renderDocumentPdf.mock.calls[0][0])).toContain("Acme Inc");

    resolve(new Blob(["%PDF-"], { type: "application/pdf" }));

    await waitFor(() => expect(downloads).toEqual([{ href: "blob:nda", download: "Mutual-NDA-Acme-Inc.pdf" }]));
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nda"));
  });

  it("shows an error and recovers when PDF generation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");
    renderDocumentPdf.mockRejectedValueOnce(failure);
    const { user } = setup();

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
    const { log, say } = setup();

    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    await say("Hello");
    await log.findByText("Noted.");

    expect(log.getAllByText("Assistant:")).toHaveLength(2);
    expect(log.getAllByText("You:")).toHaveLength(1);
  });

  it("makes the scrollable conversation and preview keyboard focusable", () => {
    setup();
    expect(screen.getByRole("log", { name: "Conversation" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("region", { name: "Agreement preview" })).toHaveAttribute("tabindex", "0");
  });
});
