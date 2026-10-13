import type { Inline } from "./types";

// Defined-term references (<span class="keyterms_link">Provider</span> etc.) and
// clause headings (<span class="header_3">) are shown in bold.
const BOLD_SPAN = /<span class="(?:[a-z]+_link|header_\d)"[^>]*>(.+?)<\/span>/g;
// Anchor spans (<span id="4.1"></span>) only carry ids; their content is kept.
const ANCHOR_TAG = /<span id="[^"]*">|<\/span>/g;

// The inline constructs left once spans are normalized: **bold**, [text](url) and <url>.
const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<(https?:\/\/[^>]+)>/g;

/** Parses a single line of template markdown into inline runs. */
export function parseInline(markdown: string): Inline[] {
  const text = markdown.replace(BOLD_SPAN, "**$1**").replace(ANCHOR_TAG, "");
  const result: Inline[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > lastIndex) {
      result.push({ text: text.slice(lastIndex, match.index) });
    }
    const [, bold, linkText, href, autolink] = match;
    if (bold !== undefined) result.push({ text: bold, bold: true });
    else if (linkText !== undefined) result.push({ text: linkText, href });
    else result.push({ text: autolink, href: autolink });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex) });
  }
  return result;
}
