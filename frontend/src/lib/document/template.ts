import { readFileSync } from "node:fs";
import path from "node:path";
import { parseInline } from "./markdown";
import type { Clause, DocumentSpec, DocumentType, ParsedTemplate } from "./types";

/** The repository root (the frontend lives in `<repo>/frontend`). */
const REPO_ROOT = path.join(process.cwd(), "..");

const INDENT = 4;
// Invisible left-to-right marks, which the PDF's built-in fonts cannot draw.
const LTR_MARK = /\u200e/g;
const LIST_ITEM = /^( *)(\d+|[a-z]+)\.\s+(.*)$/;

/**
 * Labels a clause from its list marker: "4." at the top level, "4.2" below it,
 * then "(a)" and "(i)" for deeper levels.
 */
function clauseLabel(level: number, marker: string, section: string): string {
  if (level === 0) return `${marker}.`;
  if (level === 1) return `${section}.${marker}`;
  return `(${marker})`;
}

/**
 * Parses Common Paper standard terms: a `# Title` followed by nested numbered
 * lists. Common Paper attribution lines are skipped (the document adds its own);
 * any other line means the template changed shape, so parsing fails loudly.
 */
export function parseTemplate(markdown: string): ParsedTemplate {
  let title: string | undefined;
  let section = "";
  const clauses: Clause[] = [];

  for (const line of markdown.replace(LTR_MARK, "").split("\n")) {
    if (!line.trim() || line.startsWith("Common Paper")) continue;
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    const match = LIST_ITEM.exec(line);
    if (!match) throw new Error(`Unexpected template line: ${line.slice(0, 60)}`);
    const [, indent, marker, text] = match;
    const level = indent.length / INDENT;
    if (level === 0) section = marker;
    clauses.push({ level, label: clauseLabel(level, marker, section), content: parseInline(text) });
  }

  if (!title) throw new Error("Template is missing its # title");
  if (clauses.length === 0) throw new Error("Template has no clauses");
  return { title, clauses };
}

/** Reads documents.json and parses each document's template. Server-only (uses the filesystem). */
export function loadDocumentTypes(): DocumentType[] {
  const read = (file: string) => readFileSync(path.join(REPO_ROOT, file), "utf8");
  const specs: DocumentSpec[] = JSON.parse(read("documents.json"));
  return specs.map((spec) => ({ spec, template: parseTemplate(read(path.join("templates", spec.file))) }));
}
