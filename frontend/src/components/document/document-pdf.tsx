import { Document, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { Block, Inline } from "@/lib/document/types";

// Built-in PDF fonts, so no font files need to be fetched.
const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 56, fontFamily: "Times-Roman", fontSize: 11, lineHeight: 1.4 },
  bold: { fontFamily: "Times-Bold" },
  title: { fontFamily: "Times-Bold", fontSize: 18, textAlign: "center", marginBottom: 10 },
  heading: { fontFamily: "Times-Bold", fontSize: 11, textTransform: "uppercase", marginBottom: 6 },
  paragraph: { marginBottom: 10, textAlign: "justify" },
  field: { marginBottom: 8 },
  fieldHeading: { fontFamily: "Times-Bold", fontSize: 12 },
  hint: { fontFamily: "Times-Italic", fontSize: 9, color: "#666" },
  table: { borderTop: "1pt solid #999", borderLeft: "1pt solid #999", marginVertical: 10 },
  row: { flexDirection: "row" },
  cell: { flex: 3, minHeight: 20, padding: 4, borderRight: "1pt solid #999", borderBottom: "1pt solid #999" },
  labelCell: { flex: 2, fontFamily: "Times-Bold" },
  // Repeated at the bottom of every page of its section, inside the page's bottom padding.
  attribution: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: "#666" },
  link: { color: "#1d4ed8" },
});

const FIELD_HEADING_MIN_PRESENCE = 30;

/**
 * Longest run of characters a table cell renders unbroken. Narrow enough that
 * even wide glyphs (16 × "W" at 11pt) fit a party column, so values like
 * "aaaa…@example.com" wrap instead of spilling into the next column.
 */
const MAX_UNBROKEN_CHARS = 16;
const LONG_RUN = new RegExp(`.{1,${MAX_UNBROKEN_CHARS}}`, "gu");

function breakLongWords(word: string, hyphenate?: (word: string) => string[]): string[] {
  const syllables = hyphenate ? hyphenate(word) : [word];
  return syllables.flatMap((part) => part.match(LONG_RUN) ?? [part]);
}

function InlineText({ content }: { content: Inline[] }) {
  return content.map((run, i) => {
    if (run.href) {
      return (
        <Link key={i} src={run.href} style={styles.link}>
          {run.text}
        </Link>
      );
    }
    return (
      <Text key={i} style={run.bold ? styles.bold : undefined}>
        {run.text}
      </Text>
    );
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "title":
      return <Text style={styles.title}>{block.text}</Text>;
    case "heading":
      return <Text style={styles.heading}>{block.text}</Text>;
    case "paragraph":
      return (
        <Text style={styles.paragraph}>
          <InlineText content={block.content} />
        </Text>
      );
    case "field":
      // Long values may continue on the next page, but a heading is never left
      // stranded at the bottom of a page without at least a line of its value.
      return (
        <View style={styles.field}>
          <View minPresenceAhead={FIELD_HEADING_MIN_PRESENCE}>
            <Text style={styles.fieldHeading}>{block.heading}</Text>
            {block.hint && <Text style={styles.hint}>{block.hint}</Text>}
          </View>
          {block.lines.map((line, i) => (
            <Text key={i}>
              {line.label && <Text style={styles.bold}>{line.label}: </Text>}
              {line.value}
            </Text>
          ))}
        </View>
      );
    case "signatures":
      return (
        // The intro sentence and the table move to a new page together, never split.
        <View wrap={false}>
          <Text style={styles.paragraph}>{block.intro}</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.labelCell]} />
              {block.headers.map((header) => (
                <Text key={header} style={[styles.cell, styles.bold]}>
                  {header}
                </Text>
              ))}
            </View>
            {block.rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={[styles.cell, styles.labelCell]}>{row.label}</Text>
                {row.values.map((value, i) => (
                  <Text key={i} style={styles.cell} hyphenationCallback={breakLongWords}>
                    {value}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    case "clause":
      return (
        <Text style={styles.paragraph}>
          {block.number}. <InlineText content={block.content} />
        </Text>
      );
    case "attribution":
      return (
        <Text style={styles.attribution} fixed>
          <InlineText content={block.content} />
        </Text>
      );
    case "pageBreak":
      // Handled by splitting the document into separate <Page>s.
      return null;
  }
}

/** Splits the document at page breaks so each section gets its own page footer. */
function splitPages(blocks: Block[]): Block[][] {
  const pages: Block[][] = [[]];
  for (const block of blocks) {
    if (block.type === "pageBreak") pages.push([]);
    else pages[pages.length - 1].push(block);
  }
  return pages;
}

/** Renders the document model to a PDF file. Client-side; import lazily. */
export function renderDocumentPdf(blocks: Block[]): Promise<Blob> {
  return pdf(
    <Document title="Mutual Non-Disclosure Agreement" creator="Prelegal">
      {splitPages(blocks).map((pageBlocks, pageIndex) => (
        <Page key={pageIndex} size="LETTER" style={styles.page}>
          {pageBlocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </Page>
      ))}
    </Document>,
  ).toBlob();
}
