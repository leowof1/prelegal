/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadNdaTemplate } from "@/lib/nda/template";
import type { Block } from "@/lib/nda/types";
import { NdaCreator } from "./NdaCreator";

const renderNdaPdf = vi.fn<(blocks: Block[]) => Promise<Blob>>();
vi.mock("./nda-pdf", () => ({ renderNdaPdf: (blocks: Block[]) => renderNdaPdf(blocks) }));

const template = loadNdaTemplate();

function setup() {
  const user = userEvent.setup();
  render(<NdaCreator template={template} />);
  const preview = within(screen.getByRole("region", { name: "Agreement preview" }));
  const group = (name: string) => within(screen.getByRole("group", { name }));
  return { user, preview, group };
}

beforeEach(() => {
  // Freeze only Date so "today" is deterministic without stalling user-event timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 4, 12));
});

afterEach(() => {
  vi.useRealTimers();
  renderNdaPdf.mockReset();
});

describe("NdaCreator defaults", () => {
  it("prefills the template defaults and today's date", () => {
    const { preview } = setup();

    expect(screen.getByLabelText("Effective Date")).toHaveValue("2026-10-04");
    expect(screen.getByLabelText("Purpose")).toHaveValue(
      "Evaluating whether to enter into a business relationship with the other party.",
    );
    expect(preview.getByText("October 4, 2026")).toBeInTheDocument();
    expect(preview.getByText("Expires 1 year from Effective Date.")).toBeInTheDocument();
    expect(preview.getByText(/^1 year from Effective Date, but in the case of trade secrets/)).toBeInTheDocument();
    expect(preview.getByText("None.")).toBeInTheDocument();
  });

  it("renders the full Standard Terms and attribution from the templates", () => {
    const { preview } = setup();

    expect(preview.getByRole("heading", { name: "Standard Terms" })).toBeInTheDocument();
    expect(preview.getByText("Equitable Relief")).toBeInTheDocument();
    expect(preview.getAllByRole("link", { name: "CC BY 4.0" })).toHaveLength(2);
  });
});

describe("NdaCreator live preview", () => {
  it("fills the signature table as party details are typed", async () => {
    const { user, preview, group } = setup();

    await user.type(group("Party 1").getByLabelText("Company"), "Acme Inc");
    await user.type(group("Party 1").getByLabelText("Signer name"), "Ada Lovelace");
    await user.type(group("Party 2").getByLabelText("Company"), "Globex LLC");
    await user.type(group("Party 2").getByLabelText("Notice address"), "alan@globex.test");

    const companyRow = preview.getByRole("rowheader", { name: "Company" }).closest("tr")!;
    expect(within(companyRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Acme Inc",
      "Globex LLC",
    ]);
    expect(preview.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(preview.getByText("alan@globex.test")).toBeInTheDocument();
  });

  it("highlights missing values and clears the highlight once filled", async () => {
    const { user, preview } = setup();

    const placeholder = preview.getByText("[State]");
    expect(placeholder).toHaveClass("bg-amber-100");

    await user.type(screen.getByLabelText("Governing Law"), "Delaware");

    expect(preview.queryByText("[State]")).not.toBeInTheDocument();
    expect(preview.getByText("Delaware")).not.toHaveClass("bg-amber-100");
  });

  it("formats a changed effective date and flags a cleared one", async () => {
    const { user, preview } = setup();
    const input = screen.getByLabelText("Effective Date");

    await user.clear(input);
    expect(preview.getByText("[Effective Date]")).toBeInTheDocument();

    await user.type(input, "2027-01-15");
    expect(preview.getByText("January 15, 2027")).toBeInTheDocument();
  });

  it("switches the MNDA term between a fixed number of years and until terminated", async () => {
    const { user, preview, group } = setup();
    const term = group("MNDA Term");
    const years = term.getByLabelText("MNDA Term in years");

    await user.click(term.getByLabelText("Continues until terminated"));
    expect(preview.getByText("Continues until terminated in accordance with the terms of the MNDA.")).toBeInTheDocument();
    expect(years).toBeDisabled();

    await user.click(term.getByRole("radio", { name: "A fixed number of years" }));
    expect(years).toBeEnabled();
    expect(preview.getByText("Expires 1 year from Effective Date.")).toBeInTheDocument();
  });

  it("updates the number of years and flags an empty value", async () => {
    const { user, preview } = setup();
    const years = screen.getByLabelText("MNDA Term in years");

    await user.clear(years);
    expect(preview.getByText("[Number of years]")).toBeInTheDocument();

    await user.type(years, "3");
    expect(preview.getByText("Expires 3 years from Effective Date.")).toBeInTheDocument();
  });

  it.each([
    ["MNDA Term", "Continues until terminated", "Expires 3 years from Effective Date."],
    ["Term of Confidentiality", "In perpetuity", /^3 years from Effective Date, but/],
  ])("remembers the %s years when switching to the alternative and back", async (legend, alternative, expected) => {
    const { user, preview, group } = setup();
    const term = group(legend);
    const years = term.getByLabelText(`${legend} in years`);

    await user.clear(years);
    await user.type(years, "3");
    await user.click(term.getByLabelText(alternative));
    expect(years).toBeDisabled();
    expect(years).toHaveValue(3);

    await user.click(term.getByRole("radio", { name: "A fixed number of years" }));
    expect(years).toBeEnabled();
    expect(years).toHaveValue(3);
    expect(preview.getByText(expected)).toBeInTheDocument();
  });

  it("keeps the two term choices independent", async () => {
    const { user, preview, group } = setup();

    await user.click(group("MNDA Term").getByLabelText("Continues until terminated"));

    expect(group("Term of Confidentiality").getByRole("radio", { name: "A fixed number of years" })).toBeChecked();
    expect(preview.getByText(/^1 year from Effective Date, but/)).toBeInTheDocument();
  });

  it.each(["0", "-1", "2.5", "101"])("flags %s years as invalid in the form and the document", async (input) => {
    const { user, preview } = setup();
    const years = screen.getByLabelText("MNDA Term in years");

    await user.clear(years);
    await user.type(years, input);

    expect(years).toHaveValue(Number(input));
    expect(years).toHaveAttribute("aria-invalid", "true");
    expect(years).toHaveAccessibleDescription("Enter a whole number of years from 1 to 100.");
    expect(preview.getByText("[Number of years]")).toBeInTheDocument();
  });

  it("does not flag an empty years field while its alternative is selected", async () => {
    const { user, group } = setup();
    const term = group("MNDA Term");
    const years = term.getByLabelText("MNDA Term in years");

    await user.clear(years);
    await user.click(term.getByLabelText("Continues until terminated"));

    expect(years).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(/Enter a whole number of years/)).not.toBeInTheDocument();
  });

  it("supports a perpetual term of confidentiality", async () => {
    const { user, preview, group } = setup();

    await user.click(group("Term of Confidentiality").getByLabelText("In perpetuity"));

    expect(preview.getByText("In perpetuity.")).toBeInTheDocument();
    expect(screen.getByLabelText("Term of Confidentiality in years")).toBeDisabled();
  });

  it("preserves line breaks in modifications", async () => {
    const { user, preview } = setup();

    await user.type(screen.getByLabelText("MNDA Modifications"), "First change.{Enter}Second change.");

    const value = preview.getByText(/First change\./);
    expect(value.textContent).toBe("First change.\nSecond change.");
    expect(value).toHaveClass("whitespace-pre-line");
  });
});

describe("NdaCreator user input safety", () => {
  it("renders typed markup literally in the preview", async () => {
    const { user, preview, group } = setup();
    const markup = "**bold** [x](https://evil.test) <b>tag</b>";

    await user.clear(screen.getByLabelText("Purpose"));
    // user-event treats "[" and "{" as key descriptors; doubling them types them literally.
    await user.type(screen.getByLabelText("Purpose"), markup.replace(/[[{]/g, "$&$&"));
    await user.type(group("Party 1").getByLabelText("Company"), "<i>Acme</i>");

    expect(preview.getByText(markup)).toBeInTheDocument();
    expect(preview.getByText("<i>Acme</i>")).toBeInTheDocument();
    expect(preview.queryByRole("link", { name: "x" })).not.toBeInTheDocument();
    expect(preview.queryByText("bold", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("warns about characters the PDF cannot display", async () => {
    const { user, group } = setup();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.type(group("Party 2").getByLabelText("Company"), "Łódź Müller");

    expect(screen.getByRole("status")).toHaveTextContent("can't display these characters");
    expect(screen.getByRole("status")).toHaveTextContent("Ł ź");
    expect(screen.getByRole("status")).not.toHaveTextContent("ü");

    await user.clear(group("Party 2").getByLabelText("Company"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("NdaCreator PDF download", () => {
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

  it("renders the current document and downloads it with a party-based filename", async () => {
    let resolve!: (blob: Blob) => void;
    renderNdaPdf.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, group } = setup();
    await user.type(group("Party 1").getByLabelText("Company"), "Acme Inc");

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    const busy = screen.getByRole("button", { name: "Preparing PDF…" });
    expect(busy).toBeDisabled();
    const blocks = renderNdaPdf.mock.calls[0][0];
    expect(JSON.stringify(blocks)).toContain("Acme Inc");

    resolve(new Blob(["%PDF-"], { type: "application/pdf" }));

    await waitFor(() => expect(downloads).toEqual([{ href: "blob:nda", download: "Mutual-NDA-Acme-Inc.pdf" }]));
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nda"));
  });

  it("shows an error and recovers when PDF generation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");
    renderNdaPdf.mockRejectedValueOnce(failure);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate the PDF");
    expect(downloads).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(failure);

    renderNdaPdf.mockResolvedValueOnce(new Blob(["%PDF-"]));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("NdaCreator accessibility semantics", () => {
  it("names every form control and links hints as descriptions", () => {
    setup();

    for (const input of [...screen.getAllByRole("textbox"), ...screen.getAllByRole("spinbutton")]) {
      expect(input).toHaveAccessibleName();
    }
    expect(screen.getByLabelText("Governing Law")).toHaveAccessibleDescription(
      "State whose laws govern the MNDA, e.g. Delaware",
    );
  });

  it("groups each term choice under its legend", () => {
    const { group } = setup();

    for (const name of ["MNDA Term", "Term of Confidentiality"]) {
      expect(group(name).getAllByRole("radio")).toHaveLength(2);
    }
  });

  it("makes the scrollable preview keyboard focusable", () => {
    setup();
    expect(screen.getByRole("region", { name: "Agreement preview" })).toHaveAttribute("tabindex", "0");
  });
});
