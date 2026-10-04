import type { Block, FieldLine, NdaTemplate, NdaValues, PartyDetails } from "./types";

export const DEFAULT_PURPOSE =
  "Evaluating whether to enter into a business relationship with the other party.";

const emptyParty = (): PartyDetails => ({ name: "", title: "", company: "", noticeAddress: "" });

export function defaultNdaValues(effectiveDate = ""): NdaValues {
  return {
    purpose: DEFAULT_PURPOSE,
    effectiveDate,
    mndaTerm: { kind: "expires", years: 1 },
    confidentialityTerm: { kind: "years", years: 1 },
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    parties: [emptyParty(), emptyParty()],
  };
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

export const MAX_TERM_YEARS = 100;

/** "1 year" / "3 years"; undefined unless `years` is a whole number from 1 to MAX_TERM_YEARS. */
export function formatYears(years: number): string | undefined {
  if (!Number.isInteger(years) || years < 1 || years > MAX_TERM_YEARS) return undefined;
  return years === 1 ? "1 year" : `${years} years`;
}

function line(value: string | undefined, placeholder: string, label?: string): FieldLine {
  const trimmed = value?.trim();
  return trimmed
    ? { label, value: trimmed, placeholder: false }
    : { label, value: `[${placeholder}]`, placeholder: true };
}

const fixed = (value: string): FieldLine => ({ value, placeholder: false });

function mndaTermLine(term: NdaValues["mndaTerm"]): FieldLine {
  if (term.kind === "untilTerminated") {
    return fixed("Continues until terminated in accordance with the terms of the MNDA.");
  }
  const years = formatYears(term.years);
  return years
    ? fixed(`Expires ${years} from Effective Date.`)
    : line(undefined, "Number of years");
}

function confidentialityTermLine(term: NdaValues["confidentialityTerm"]): FieldLine {
  if (term.kind === "perpetual") return fixed("In perpetuity.");
  const years = formatYears(term.years);
  return years
    ? fixed(
        `${years} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`,
      )
    : line(undefined, "Number of years");
}

/** Combines the template text with the user's values into a renderable document. */
export function buildNdaDocument(template: NdaTemplate, values: NdaValues): Block[] {
  const [party1, party2] = values.parties;
  const partyRow = (label: string, key: keyof PartyDetails) => ({
    label,
    values: [party1[key].trim(), party2[key].trim()] as [string, string],
  });

  return [
    { type: "title", text: "Mutual Non-Disclosure Agreement" },
    { type: "heading", text: "Using this Mutual Non-Disclosure Agreement" },
    { type: "paragraph", content: template.coverIntro },
    {
      type: "field",
      heading: "Purpose",
      hint: "How Confidential Information may be used",
      lines: [line(values.purpose, "Purpose")],
    },
    {
      type: "field",
      heading: "Effective Date",
      lines: [line(formatDate(values.effectiveDate), "Effective Date")],
    },
    {
      type: "field",
      heading: "MNDA Term",
      hint: "The length of this MNDA",
      lines: [mndaTermLine(values.mndaTerm)],
    },
    {
      type: "field",
      heading: "Term of Confidentiality",
      hint: "How long Confidential Information is protected",
      lines: [confidentialityTermLine(values.confidentialityTerm)],
    },
    {
      type: "field",
      heading: "Governing Law & Jurisdiction",
      lines: [
        line(values.governingLaw, "State", "Governing Law"),
        line(values.jurisdiction, "City or county and state", "Jurisdiction"),
      ],
    },
    {
      type: "field",
      heading: "MNDA Modifications",
      lines: [fixed(values.modifications.trim() || "None.")],
    },
    {
      type: "signatures",
      intro: "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
      headers: ["Party 1", "Party 2"],
      rows: [
        { label: "Signature", values: ["", ""] },
        partyRow("Print Name", "name"),
        partyRow("Title", "title"),
        partyRow("Company", "company"),
        partyRow("Notice Address", "noticeAddress"),
        { label: "Date", values: ["", ""] },
      ],
    },
    { type: "attribution", content: template.coverAttribution },
    { type: "pageBreak" },
    { type: "title", text: template.standardTermsTitle },
    ...template.clauses.map(
      (content, index): Block => ({ type: "clause", number: index + 1, content }),
    ),
    { type: "attribution", content: template.standardTermsAttribution },
  ];
}

const MAX_SLUG_LENGTH = 40;

/** A filesystem-safe ASCII PDF filename based on the party companies. */
export function pdfFilename(values: NdaValues): string {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents: "Müller" -> "Muller"
      .replace(/[^a-z0-9]+/gi, "-")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/^-+|-+$/g, "");
  const companies = values.parties.map((p) => slug(p.company)).filter(Boolean);
  return ["Mutual-NDA", ...companies].join("-") + ".pdf";
}
