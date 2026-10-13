import { readFileSync } from "node:fs";
import path from "node:path";
import { parseInline } from "./markdown";
import type { NdaTemplate } from "./types";

/** The repository-level templates directory (the frontend lives in `<repo>/frontend`). */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

const COVER_PAGE_FILE = "Mutual-NDA-coverpage.md";
const STANDARD_TERMS_FILE = "Mutual-NDA.md";

function lines(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(`Mutual NDA template is missing its ${description}`);
  }
  return value;
}

/** Extracts the reusable text from the Common Paper Mutual NDA markdown files. */
export function parseNdaTemplate(coverPage: string, standardTerms: string): NdaTemplate {
  const coverLines = lines(coverPage);
  const usingHeading = coverLines.findIndex((line) => /^##\s+USING THIS/i.test(line));
  const coverIntro = required(
    usingHeading === -1 ? undefined : coverLines[usingHeading + 1],
    "cover page introduction",
  );
  const coverAttribution = required(
    coverLines.findLast((line) => line.startsWith("Common Paper")),
    "cover page attribution",
  );

  const termsLines = lines(standardTerms);
  const title = required(
    termsLines.find((line) => line.startsWith("# ")),
    "Standard Terms title",
  ).replace(/^#\s+/, "");
  const clauses = termsLines
    .filter((line) => /^\d+\.\s/.test(line))
    .map((line) => parseInline(line.replace(/^\d+\.\s+/, "")));
  if (clauses.length === 0) {
    throw new Error("Mutual NDA template is missing its Standard Terms clauses");
  }
  const termsAttribution = required(
    termsLines.findLast((line) => line.startsWith("Common Paper")),
    "Standard Terms attribution",
  );

  return {
    coverIntro: parseInline(coverIntro),
    coverAttribution: parseInline(coverAttribution),
    standardTermsTitle: title,
    clauses,
    standardTermsAttribution: parseInline(termsAttribution),
  };
}

/** Reads and parses the Mutual NDA templates. Server-only (uses the filesystem). */
export function loadNdaTemplate(): NdaTemplate {
  const read = (file: string) => readFileSync(path.join(TEMPLATES_DIR, file), "utf8");
  return parseNdaTemplate(read(COVER_PAGE_FILE), read(STANDARD_TERMS_FILE));
}
