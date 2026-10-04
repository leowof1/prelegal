import type { Inline } from "./types";

// Matches the only inline constructs the Common Paper templates use:
// **bold**, [text](url) and <span class="coverpage_link">Term</span>.
const INLINE_PATTERN =
  /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<span class="coverpage_link">(.+?)<\/span>/g;

/**
 * Parses a single line of template markdown into inline runs.
 * Cover page references in the Standard Terms are rendered as bold defined terms.
 */
export function parseInline(markdown: string): Inline[] {
  const result: Inline[] = [];
  let lastIndex = 0;

  for (const match of markdown.matchAll(INLINE_PATTERN)) {
    if (match.index > lastIndex) {
      result.push({ text: markdown.slice(lastIndex, match.index) });
    }
    const [, bold, linkText, href, coverpageTerm] = match;
    if (bold !== undefined) result.push({ text: bold, bold: true });
    else if (linkText !== undefined) result.push({ text: linkText, href });
    else result.push({ text: coverpageTerm, bold: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    result.push({ text: markdown.slice(lastIndex) });
  }
  return result;
}
