import { describe, expect, it } from "vitest";
import {
  buildNdaDocument,
  defaultNdaValues,
  formatDate,
  formatYears,
  pdfFilename,
  todayIso,
} from "./build";
import type { Block, NdaTemplate, NdaValues } from "./types";

const template: NdaTemplate = {
  coverIntro: [{ text: "Intro" }],
  coverAttribution: [{ text: "Cover attribution" }],
  standardTermsTitle: "Standard Terms",
  clauses: [[{ text: "First" }], [{ text: "Second" }]],
  standardTermsAttribution: [{ text: "Terms attribution" }],
};

const filled = (): NdaValues => ({
  ...defaultNdaValues("2026-10-04"),
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
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

describe("formatYears", () => {
  it("pluralises", () => {
    expect(formatYears(1)).toBe("1 year");
    expect(formatYears(3)).toBe("3 years");
  });

  it("rejects empty, non-positive, fractional and absurdly large values", () => {
    for (const years of [NaN, 0, -1, 1.5, 101, 1e21, Infinity]) {
      expect(formatYears(years), String(years)).toBeUndefined();
    }
    expect(formatYears(100)).toBe("100 years");
  });
});

describe("todayIso", () => {
  it("uses the local calendar date", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("buildNdaDocument", () => {
  it("fills cover page fields from the values", () => {
    const blocks = buildNdaDocument(template, filled());

    expect(field(blocks, "Effective Date").lines).toEqual([
      { value: "October 4, 2026", placeholder: false, label: undefined },
    ]);
    expect(field(blocks, "MNDA Term").lines[0].value).toBe("Expires 1 year from Effective Date.");
    expect(field(blocks, "Term of Confidentiality").lines[0].value).toMatch(/^1 year from Effective Date, but/);
    expect(field(blocks, "Governing Law & Jurisdiction").lines).toEqual([
      { label: "Governing Law", value: "Delaware", placeholder: false },
      { label: "Jurisdiction", value: "courts located in New Castle, DE", placeholder: false },
    ]);
    expect(field(blocks, "MNDA Modifications").lines[0].value).toBe("None.");
  });

  it("renders the alternative term options", () => {
    const blocks = buildNdaDocument(template, {
      ...filled(),
      mndaTerm: { kind: "untilTerminated", years: 3 },
      confidentialityTerm: { kind: "perpetual", years: 3 },
    });

    expect(field(blocks, "MNDA Term").lines[0].value).toBe(
      "Continues until terminated in accordance with the terms of the MNDA.",
    );
    expect(field(blocks, "Term of Confidentiality").lines[0].value).toBe("In perpetuity.");
  });

  it("marks missing values as placeholders", () => {
    const blocks = buildNdaDocument(template, {
      ...defaultNdaValues(),
      purpose: "  ",
      mndaTerm: { kind: "expires", years: 0 },
      confidentialityTerm: { kind: "years", years: NaN },
      governingLaw: " ",
      modifications: "  \n ",
    });

    expect(field(blocks, "Purpose").lines[0]).toMatchObject({ value: "[Purpose]", placeholder: true });
    expect(field(blocks, "Effective Date").lines[0]).toMatchObject({ placeholder: true });
    expect(field(blocks, "MNDA Term").lines[0]).toMatchObject({ value: "[Number of years]", placeholder: true });
    expect(field(blocks, "Term of Confidentiality").lines[0]).toMatchObject({
      value: "[Number of years]",
      placeholder: true,
    });
    expect(field(blocks, "Governing Law & Jurisdiction").lines.every((l) => l.placeholder)).toBe(true);
    expect(field(blocks, "MNDA Modifications").lines[0].value).toBe("None.");
  });

  it("ignores the stored years while an open-ended term is selected", () => {
    const blocks = buildNdaDocument(template, {
      ...filled(),
      mndaTerm: { kind: "untilTerminated", years: NaN },
      confidentialityTerm: { kind: "perpetual", years: 0 },
    });

    expect(field(blocks, "MNDA Term").lines[0].placeholder).toBe(false);
    expect(field(blocks, "Term of Confidentiality").lines[0].placeholder).toBe(false);
  });

  it("keeps user-entered markup as literal text", () => {
    const markup = '**bold** <span class="coverpage_link">Purpose</span> [x](https://evil.test) <script>';
    const blocks = buildNdaDocument(template, {
      ...filled(),
      purpose: markup,
      parties: [{ ...filled().parties[0], company: markup }, filled().parties[1]],
    });

    expect(field(blocks, "Purpose").lines[0].value).toBe(markup);
    const signatures = blocks.find((b) => b.type === "signatures");
    expect(signatures?.type === "signatures" && signatures.rows[3].values[0]).toBe(markup);
  });

  it("fills the signature table and leaves signature and date blank", () => {
    const signatures = buildNdaDocument(template, filled()).find((b) => b.type === "signatures");

    expect(signatures).toMatchObject({
      intro: "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
      headers: ["Party 1", "Party 2"],
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

  it("appends the numbered standard terms after a page break", () => {
    const blocks = buildNdaDocument(template, filled());
    const breakIndex = blocks.findIndex((b) => b.type === "pageBreak");

    expect(blocks.slice(breakIndex + 1)).toEqual([
      { type: "title", text: "Standard Terms" },
      { type: "clause", number: 1, content: [{ text: "First" }] },
      { type: "clause", number: 2, content: [{ text: "Second" }] },
      { type: "attribution", content: [{ text: "Terms attribution" }] },
    ]);
  });
});

describe("pdfFilename", () => {
  it("includes slugified company names", () => {
    expect(pdfFilename(filled())).toBe("Mutual-NDA-Acme-Inc-Globex-LLC.pdf");
  });

  it("falls back to a generic name", () => {
    expect(pdfFilename(defaultNdaValues())).toBe("Mutual-NDA.pdf");
  });

  const withCompanies = (company1: string, company2 = "") => {
    const values = defaultNdaValues();
    values.parties[0].company = company1;
    values.parties[1].company = company2;
    return values;
  };

  it("transliterates accented names", () => {
    expect(pdfFilename(withCompanies("Müller GmbH", "Société Générale"))).toBe(
      "Mutual-NDA-Muller-GmbH-Societe-Generale.pdf",
    );
  });

  it("drops names with no ASCII equivalent", () => {
    expect(pdfFilename(withCompanies("株式会社", "Globex"))).toBe("Mutual-NDA-Globex.pdf");
  });

  it("truncates very long names without trailing dashes", () => {
    const filename = pdfFilename(withCompanies("Acme ".repeat(30)));
    expect(filename).toMatch(/^Mutual-NDA-(Acme-)*Acme\.pdf$/);
    expect(filename.length).toBeLessThanOrEqual("Mutual-NDA-".length + 40 + ".pdf".length);
  });
});
