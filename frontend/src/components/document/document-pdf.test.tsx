import { beforeAll, describe, expect, it } from "vitest";
import { buildDocument, defaultDocumentValues } from "@/lib/document/build";
import type { DocumentValues } from "@/lib/document/types";
import { documentType, filledValues } from "@/test/fixtures";
import { extractPdfItems, extractPdfPages } from "@/test/pdf-text";
import { renderDocumentPdf } from "./document-pdf";

const nda = documentType("mutual-nda");
const PDF_TIMEOUT = 30_000;

async function renderBytes(values: DocumentValues, type = nda) {
  const blob = await renderDocumentPdf(type.spec.name, buildDocument(type, values));
  return { blob, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

async function renderPages(values: DocumentValues = filledValues()) {
  return extractPdfPages((await renderBytes(values)).bytes);
}

const withParty1 = (patch: Partial<DocumentValues["parties"][0]>): DocumentValues => {
  const values = filledValues();
  values.parties[0] = { ...values.parties[0], ...patch };
  return values;
};

const SIGNATURE_ROWS = ["Signature", "Print Name", "Title", "Company", "Notice Address", "Date"];

describe("renderDocumentPdf", () => {
  let pages: string[];
  let blob: Blob;
  let bytes: Uint8Array;
  beforeAll(async () => {
    ({ blob, bytes } = await renderBytes(filledValues()));
    pages = await extractPdfPages(bytes);
  }, PDF_TIMEOUT);

  it("produces a valid PDF", () => {
    expect(blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("keeps the whole cover page, including the signing sentence and table, on page 1", () => {
    const [cover] = pages;
    for (const text of [
      "Mutual Non-Disclosure Agreement",
      "Evaluating a joint product launch.",
      "October 4, 2026",
      "Expires 2 years from Effective Date.",
      "In perpetuity.",
      "Governing Law A US state Delaware",
      "Jurisdiction City or county and state of the courts courts located in New Castle, DE",
      "Section 9 applies to both parties.",
      "By signing this Cover Page",
      ...SIGNATURE_ROWS,
      "Ada Lovelace",
      "Alan Turing",
      "Acme Inc",
      "Globex LLC",
      "ada@acme.test",
    ]) {
      expect(cover).toContain(text);
    }
    expect(cover).not.toContain("Standard Terms 1.");
    expect(pages).toHaveLength(3);
  });

  it("starts the Standard Terms on a new page with every clause, in order, under its own heading", () => {
    expect(pages[1]).toMatch(/^Standard Terms 1\. Introduction\./);
    const terms = pages.slice(1).join(" ");
    const headings = nda.template.clauses.map((clause) => clause.content[0].text);
    expect(headings).toHaveLength(11);

    let position = -1;
    headings.forEach((heading, index) => {
      const found = terms.indexOf(`${index + 1}. ${heading}.`, position + 1);
      expect(found, `clause ${index + 1} (${heading})`).toBeGreaterThan(position);
      position = found;
    });
    expect(terms).toContain("which together form the same agreement.");
  });

  it("repeats the CC BY 4.0 attribution on every page", () => {
    for (const page of pages) {
      expect(page).toContain(
        "Based on the Common Paper Mutual Non-Disclosure Agreement standard terms, free to use under CC BY 4.0.",
      );
    }
  });

  it("shows placeholders for missing values", async () => {
    const [cover] = await renderPages({ ...defaultDocumentValues(), documentId: "mutual-nda" });
    expect(cover).toContain("[Effective Date]");
    expect(cover).toContain("[Governing Law]");
    expect(cover).toContain("[Jurisdiction]");
  }, PDF_TIMEOUT);

  it("moves the signing sentence and table to the next page together, unsplit, when the cover overflows", async () => {
    const values = filledValues();
    values.terms.modifications = Array.from({ length: 40 }, (_, i) => `Modification ${i + 1}.`).join("\n");
    const result = await renderPages(values);

    expect(result[0]).not.toContain("Print Name");
    expect(result[0]).not.toContain("By signing");
    const signaturePage = result.find((page) => page.includes("Print Name"))!;
    expect(signaturePage).toContain("By signing this Cover Page");
    for (const row of SIGNATURE_ROWS) expect(signaturePage).toContain(row);
    for (const page of result) expect(page).toContain("CC BY 4.0");
  }, PDF_TIMEOUT);

  it("lets a very long field continue across pages instead of leaving page 1 empty", async () => {
    const purpose = "Lorem ipsum dolor sit amet. ".repeat(150).trim();
    const values = filledValues();
    values.terms.purpose = purpose;
    const result = await renderPages(values);

    expect(result[0]).toContain("Purpose How Confidential Information may be used Lorem ipsum");
    // The page footer sits between the two halves of the text; drop it before comparing.
    const withoutFooters = result
      .map((page) => page.replace(/ ?Based on the Common Paper [^.]*CC BY 4\.0\./g, ""))
      .join(" ");
    expect(withoutFooters).toContain(purpose);
  }, PDF_TIMEOUT);

  it("wraps long unbroken values inside their table cell", async () => {
    const address = `${"a".repeat(80)}@example.com`;
    const pages = await extractPdfItems((await renderBytes(withParty1({ noticeAddress: address }))).bytes);
    // The taller table may move to the next page as a whole; check the page it is on.
    const table = pages.find((page) => page.some((item) => item.text.includes("Print Name")))!;

    // LETTER is 612pt wide with 56pt margins; columns are flex 2:3:3.
    const party1ColumnEnd = 56 + (500 * 5) / 8;
    const party1Runs = table.filter((item) => /a{4,}|example/.test(item.text));
    expect(party1Runs.length).toBeGreaterThan(1);
    for (const run of party1Runs) expect(run.x + run.width).toBeLessThanOrEqual(party1ColumnEnd);
    // Party 2's address is still intact in its own column.
    expect(table.some((item) => item.text.includes("alan@globex.test") && item.x >= party1ColumnEnd)).toBe(true);
  }, PDF_TIMEOUT);

  it("renders accented Latin and Windows-1252 punctuation exactly", async () => {
    const text = "Müller GmbH – „Café“ naïve façade €100";
    const values = filledValues();
    values.terms.purpose = text;
    const [cover] = await renderPages(values);
    expect(cover).toContain(text);
  }, PDF_TIMEOUT);

  it("still produces a PDF when the input contains characters the font can't show", async () => {
    // These render garbled (the UI warns about them), but must not break generation.
    const result = await renderPages(withParty1({ company: "Łódź Привет 株式会社 😀" }));
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("Ada Lovelace");
  }, PDF_TIMEOUT);

  it("renders user-entered markup literally", async () => {
    const markup = "**bold** [x](https://evil.test) <b>tag</b>";
    const values = filledValues();
    values.terms.purpose = markup;
    const [cover] = await renderPages(values);
    expect(cover).toContain(markup);
  }, PDF_TIMEOUT);

  it("indents nested clauses of the other documents", async () => {
    const csa = documentType("cloud-service-agreement");
    const items = (await extractPdfItems((await renderBytes(filledValues(), csa)).bytes)).flat();
    const x = (label: string) => items.find((item) => item.text === label)!.x;

    expect(x("1.1")).toBeGreaterThan(x("1."));
    expect(x("(a)")).toBeGreaterThan(x("1.1"));
  }, PDF_TIMEOUT);
});
