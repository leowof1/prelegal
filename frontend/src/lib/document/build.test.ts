import { describe, expect, it } from "vitest";
import { buildDocument, defaultDocumentValues, formatDate, pdfFilename, todayIso } from "./build";
import type { Block, DocumentType, DocumentValues } from "./types";

const pilot: DocumentType = {
  spec: {
    id: "pilot-agreement",
    name: "Pilot Agreement",
    description: "A pilot.",
    file: "Pilot-Agreement.md",
    roles: ["Provider", "Customer"],
    terms: [
      { key: "pilotPeriod", label: "Pilot Period", hint: "e.g. 90 days" },
      { key: "governingLaw", label: "Governing Law", hint: "A US state" },
    ],
  },
  template: {
    title: "Pilot Agreement",
    clauses: [
      { level: 0, label: "1.", content: [{ text: "Pilot", bold: true }] },
      { level: 1, label: "1.1", content: [{ text: "First" }] },
    ],
  },
};

const filled = (): DocumentValues => ({
  ...defaultDocumentValues("2026-10-04"),
  documentId: "pilot-agreement",
  terms: { pilotPeriod: "90 days", governingLaw: "Delaware" },
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme, Inc.", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
  ],
});

const field = (blocks: Block[], heading: string) => {
  const block = blocks.find((b) => b.type === "field" && b.heading === heading);
  if (block?.type !== "field") throw new Error(`No field ${heading}`);
  return block;
};

describe("formatDate", () => {
  it("formats ISO dates without time zone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("2026-10-04")).toBe("October 4, 2026");
  });

  it("rejects empty and impossible dates", () => {
    for (const iso of ["", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2025-02-29", "26-01-01"]) {
      expect(formatDate(iso), iso).toBeUndefined();
    }
  });

  it("accepts leap days", () => {
    expect(formatDate("2024-02-29")).toBe("February 29, 2024");
  });

  it("rejects partially typed years instead of mapping them to the 1900s", () => {
    // Date inputs emit values like "0027-01-15" while the user is typing a year.
    expect(formatDate("0027-01-15")).toBeUndefined();
    expect(formatDate("0000-01-01")).toBeUndefined();
    expect(formatDate("0999-12-31")).toBeUndefined();
    expect(formatDate("1000-01-01")).toBe("January 1, 1000");
  });
});

describe("todayIso", () => {
  it("uses the local calendar date", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("defaultDocumentValues", () => {
  it("starts with no document chosen", () => {
    expect(defaultDocumentValues("2026-10-04")).toMatchObject({
      documentId: null,
      effectiveDate: "2026-10-04",
      terms: {},
    });
  });
});

describe("buildDocument", () => {
  it("generates a cover page titled after the document", () => {
    const blocks = buildDocument(pilot, filled());
    expect(blocks.slice(0, 2)).toEqual([
      { type: "title", text: "Pilot Agreement" },
      { type: "heading", text: "Cover Page" },
    ]);
  });

  it("fills a field for the effective date and each term, with the term's hint", () => {
    const blocks = buildDocument(pilot, filled());

    expect(field(blocks, "Effective Date").lines).toEqual([{ value: "October 4, 2026", placeholder: false }]);
    expect(field(blocks, "Pilot Period")).toMatchObject({
      hint: "e.g. 90 days",
      lines: [{ value: "90 days", placeholder: false }],
    });
    expect(field(blocks, "Governing Law").lines[0].value).toBe("Delaware");
  });

  it("marks missing and blank values as placeholders", () => {
    const blocks = buildDocument(pilot, { ...defaultDocumentValues(), terms: { governingLaw: "  \n " } });

    expect(field(blocks, "Effective Date").lines[0]).toMatchObject({ placeholder: true });
    expect(field(blocks, "Pilot Period").lines[0]).toEqual({ value: "[Pilot Period]", placeholder: true });
    expect(field(blocks, "Governing Law").lines[0]).toEqual({ value: "[Governing Law]", placeholder: true });
  });

  it("ignores terms the document does not have", () => {
    const blocks = buildDocument(pilot, { ...filled(), terms: { ...filled().terms, purpose: "Other" } });
    expect(blocks.some((b) => b.type === "field" && b.heading === "Purpose")).toBe(false);
  });

  it("keeps user-entered markup as literal text", () => {
    const markup = '**bold** <span class="coverpage_link">Purpose</span> [x](https://evil.test) <script>';
    const blocks = buildDocument(pilot, {
      ...filled(),
      terms: { pilotPeriod: markup },
      parties: [{ ...filled().parties[0], company: markup }, filled().parties[1]],
    });

    expect(field(blocks, "Pilot Period").lines[0].value).toBe(markup);
    const signatures = blocks.find((b) => b.type === "signatures");
    expect(signatures?.type === "signatures" && signatures.rows[3].values[0]).toBe(markup);
  });

  it("fills the signature table under the document's party roles", () => {
    const signatures = buildDocument(pilot, filled()).find((b) => b.type === "signatures");

    expect(signatures).toMatchObject({
      intro:
        "By signing this Cover Page, each party agrees to enter into this Pilot Agreement as of the Effective Date.",
      headers: ["Provider", "Customer"],
      rows: [
        { label: "Signature", values: ["", ""] },
        { label: "Print Name", values: ["Ada Lovelace", "Alan Turing"] },
        { label: "Title", values: ["CEO", "CTO"] },
        { label: "Company", values: ["Acme, Inc.", "Globex LLC"] },
        { label: "Notice Address", values: ["ada@acme.test", "alan@globex.test"] },
        { label: "Date", values: ["", ""] },
      ],
    });
  });

  it("appends the nested standard terms and a CC BY attribution after a page break", () => {
    const blocks = buildDocument(pilot, filled());
    const breakIndex = blocks.findIndex((b) => b.type === "pageBreak");
    const [title, clause1, clause2, attribution] = blocks.slice(breakIndex + 1);

    expect([title, clause1, clause2]).toEqual([
      { type: "title", text: "Pilot Agreement" },
      { type: "clause", level: 0, label: "1.", content: [{ text: "Pilot", bold: true }] },
      { type: "clause", level: 1, label: "1.1", content: [{ text: "First" }] },
    ]);
    expect(attribution).toMatchObject({ type: "attribution" });
    expect(attribution.type === "attribution" && attribution.content).toContainEqual({
      text: "CC BY 4.0",
      href: "https://creativecommons.org/licenses/by/4.0/",
    });
  });
});

describe("pdfFilename", () => {
  const withCompanies = (company1: string, company2 = "") => {
    const values = defaultDocumentValues();
    values.parties[0].company = company1;
    values.parties[1].company = company2;
    return values;
  };

  it("includes the document name and slugified company names", () => {
    expect(pdfFilename(pilot.spec, filled())).toBe("Pilot-Agreement-Acme-Inc-Globex-LLC.pdf");
  });

  it("falls back to the document name", () => {
    expect(pdfFilename(pilot.spec, defaultDocumentValues())).toBe("Pilot-Agreement.pdf");
  });

  it("transliterates accented names", () => {
    expect(pdfFilename(pilot.spec, withCompanies("Müller GmbH", "Société Générale"))).toBe(
      "Pilot-Agreement-Muller-GmbH-Societe-Generale.pdf",
    );
  });

  it("drops names with no ASCII equivalent", () => {
    expect(pdfFilename(pilot.spec, withCompanies("株式会社", "Globex"))).toBe("Pilot-Agreement-Globex.pdf");
  });

  it("truncates very long names without trailing dashes", () => {
    const filename = pdfFilename(pilot.spec, withCompanies("Acme ".repeat(30)));
    expect(filename).toMatch(/^Pilot-Agreement-(Acme-)*Acme\.pdf$/);
    expect(filename.length).toBeLessThanOrEqual("Pilot-Agreement-".length + 40 + ".pdf".length);
  });
});
