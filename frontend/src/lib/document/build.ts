import type { Block, DocumentSpec, DocumentType, DocumentValues, FieldLine, Inline, PartyDetails } from "./types";

const emptyParty = (): PartyDetails => ({ name: "", title: "", company: "", noticeAddress: "" });

export function defaultDocumentValues(effectiveDate = ""): DocumentValues {
  return { documentId: null, effectiveDate, terms: {}, parties: [emptyParty(), emptyParty()] };
}

/** Today's date in the user's local time zone as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Formats YYYY-MM-DD as e.g. "October 4, 2026"; returns undefined for invalid input.
 * Years before 1000 are rejected: date inputs emit them while a year is being typed
 * (e.g. "0027"), and Date.UTC would silently map 0–99 to 1900–1999.
 */
export function formatDate(iso: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const [, year, month, day] = match.map(Number);
  if (year < 1000) return undefined;
  // Build in UTC and format in UTC so the calendar date never shifts by time zone.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return undefined;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function line(value: string | undefined, placeholder: string): FieldLine {
  const trimmed = value?.trim();
  return trimmed ? { value: trimmed, placeholder: false } : { value: `[${placeholder}]`, placeholder: true };
}

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

function attribution(spec: DocumentSpec): Inline[] {
  return [
    { text: `Based on the Common Paper ${spec.name} standard terms, free to use under ` },
    { text: "CC BY 4.0", href: LICENSE_URL },
    { text: "." },
  ];
}

/** Combines a document's standard terms with the user's values: a generated cover page, then the terms. */
export function buildDocument({ spec, template }: DocumentType, values: DocumentValues): Block[] {
  const [party1, party2] = values.parties;
  const partyRow = (label: string, key: keyof PartyDetails) => ({
    label,
    values: [party1[key].trim(), party2[key].trim()] as [string, string],
  });

  return [
    { type: "title", text: spec.name },
    { type: "heading", text: "Cover Page" },
    {
      type: "paragraph",
      content: [
        {
          text: `This Cover Page and the ${spec.name} Standard Terms that follow form the agreement. Terms in bold in the Standard Terms have the meanings given on this Cover Page.`,
        },
      ],
    },
    {
      type: "field",
      heading: "Effective Date",
      lines: [line(formatDate(values.effectiveDate), "Effective Date")],
    },
    ...spec.terms.map((term): Block => ({
      type: "field",
      heading: term.label,
      hint: term.hint,
      lines: [line(values.terms[term.key], term.label)],
    })),
    {
      type: "signatures",
      intro: `By signing this Cover Page, each party agrees to enter into this ${spec.name} as of the Effective Date.`,
      headers: spec.roles,
      rows: [
        { label: "Signature", values: ["", ""] },
        partyRow("Print Name", "name"),
        partyRow("Title", "title"),
        partyRow("Company", "company"),
        partyRow("Notice Address", "noticeAddress"),
        { label: "Date", values: ["", ""] },
      ],
    },
    { type: "attribution", content: attribution(spec) },
    { type: "pageBreak" },
    { type: "title", text: template.title },
    ...template.clauses.map((clause): Block => ({ type: "clause", ...clause })),
    { type: "attribution", content: attribution(spec) },
  ];
}

const MAX_SLUG_LENGTH = 40;

/** A filesystem-safe ASCII PDF filename based on the document name and party companies. */
export function pdfFilename(spec: DocumentSpec, values: DocumentValues): string {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents: "Müller" -> "Muller"
      .replace(/[^a-z0-9]+/gi, "-")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/^-+|-+$/g, "");
  const companies = values.parties.map((p) => slug(p.company)).filter(Boolean);
  return [slug(spec.name), ...companies].join("-") + ".pdf";
}
