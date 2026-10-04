import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// The PDF uses the standard 14 fonts; pdfjs needs their metrics to extract text.
// Resolved from the working directory because this file is loaded both as ESM
// (Vitest) and CommonJS (Playwright); both run from the frontend directory.
const standardFontDataUrl = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");

/** A positioned run of text on a PDF page, in points from the left edge. */
export interface PdfTextItem {
  text: string;
  x: number;
  width: number;
}

/** Extracts the positioned text runs of each page of a PDF. */
export async function extractPdfItems(data: Uint8Array): Promise<PdfTextItem[][]> {
  // pdfjs transfers (detaches) the buffer it is given, so pass a copy.
  const task = getDocument({ data: data.slice(), standardFontDataUrl, disableFontFace: true });
  try {
    const doc = await task.promise;
    const pages: PdfTextItem[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const { items } = await (await doc.getPage(i)).getTextContent();
      pages.push(
        items.flatMap((item) =>
          "str" in item
            ? [{ text: item.str + (item.hasEOL ? " " : ""), x: item.transform[4], width: item.width }]
            : [],
        ),
      );
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/**
 * Extracts the text of each page of a PDF, with whitespace collapsed so that
 * assertions don't depend on where lines wrap. Shared by unit and e2e tests.
 */
export async function extractPdfPages(data: Uint8Array): Promise<string[]> {
  const pages = await extractPdfItems(data);
  return pages.map((items) => items.map((item) => item.text).join("").replace(/\s+/g, " ").trim());
}
