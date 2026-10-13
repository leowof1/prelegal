/** A party's signer and company, as gathered by the AI chat. */
export interface PartyDetails {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

/** A key term a document asks for, e.g. Governing Law. */
export interface TermSpec {
  key: string;
  label: string;
  hint: string;
}

/** A supported document, as described in the repository's documents.json. */
export interface DocumentSpec {
  id: string;
  name: string;
  description: string;
  /** Standard terms file in the repository's templates directory. */
  file: string;
  roles: [string, string];
  terms: TermSpec[];
}

export interface DocumentValues {
  /** The chosen document, or null until the AI has agreed one with the user. */
  documentId: string | null;
  /** ISO date (YYYY-MM-DD). */
  effectiveDate: string;
  /** Term values by term key. */
  terms: Record<string, string>;
  parties: [PartyDetails, PartyDetails];
}

/** A run of text with optional emphasis, parsed from the template markdown. */
export interface Inline {
  text: string;
  bold?: boolean;
  href?: string;
}

/** A numbered clause of the standard terms; `level` 0 is a top-level section. */
export interface Clause {
  level: number;
  /** The clause number as shown, e.g. "4.", "4.2" or "(a)". */
  label: string;
  content: Inline[];
}

/** The standard terms parsed from a Common Paper markdown file. */
export interface ParsedTemplate {
  title: string;
  clauses: Clause[];
}

/** A supported document together with its parsed standard terms. */
export interface DocumentType {
  spec: DocumentSpec;
  template: ParsedTemplate;
}

export interface FieldLine {
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
  | ({ type: "clause" } & Clause)
  | { type: "attribution"; content: Inline[] }
  | { type: "pageBreak" };
