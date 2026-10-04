/** Values the user enters in the form. */
export interface PartyDetails {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export interface NdaValues {
  purpose: string;
  /** ISO date (YYYY-MM-DD), as produced by `<input type="date">`. */
  effectiveDate: string;
  /**
   * `years` is kept while the open-ended option is selected so switching back
   * restores it. NaN means the years field is empty.
   */
  mndaTerm: { kind: "expires" | "untilTerminated"; years: number };
  confidentialityTerm: { kind: "years" | "perpetual"; years: number };
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [PartyDetails, PartyDetails];
}

/** A run of text with optional emphasis, parsed from the template markdown. */
export interface Inline {
  text: string;
  bold?: boolean;
  href?: string;
}

/** Template text extracted from the Common Paper markdown files. */
export interface NdaTemplate {
  coverIntro: Inline[];
  coverAttribution: Inline[];
  standardTermsTitle: string;
  clauses: Inline[][];
  standardTermsAttribution: Inline[];
}

export interface FieldLine {
  label?: string;
  value: string;
  /** True when the user has not supplied this value and `value` is a placeholder. */
  placeholder: boolean;
}

/**
 * Renderer-agnostic document model. The HTML preview and the PDF are both
 * rendered from this, so they cannot drift apart.
 */
export type Block =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; content: Inline[] }
  | { type: "field"; heading: string; hint?: string; lines: FieldLine[] }
  | {
      type: "signatures";
      /** The sentence above the table; renderers keep it together with the table. */
      intro: string;
      headers: [string, string];
      rows: { label: string; values: [string, string] }[];
    }
  | { type: "clause"; number: number; content: Inline[] }
  | { type: "attribution"; content: Inline[] }
  | { type: "pageBreak" };
