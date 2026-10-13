import { describe, expect, it } from "vitest";
import { defaultDocumentValues } from "./build";
import { unsupportedPdfCharacters } from "./pdf-charset";
import { loadDocumentTypes, parseTemplate } from "./template";

const text = (runs: { text: string }[]) => runs.map((run) => run.text).join("");

describe("loadDocumentTypes", () => {
  const types = loadDocumentTypes();

  it("loads every supported document", () => {
    expect(types).toHaveLength(11);
    expect(types.map((t) => t.spec.id)).toContain("cloud-service-agreement");
  });

  it.each(types.map((t) => [t.spec.id, t] as const))("parses the %s template cleanly", (_, { template }) => {
    expect(template.clauses.length).toBeGreaterThan(5);
    expect(template.clauses[0].level).toBe(0);
    for (const clause of template.clauses) {
      expect(clause.level).toBeLessThanOrEqual(3);
      // Every span and bold marker is turned into runs; none is left as text.
      expect(text(clause.content)).not.toMatch(/<span|<\/span>|\*\*/);
    }
    const allText = template.clauses.map((clause) => text(clause.content)).join("");
    expect(unsupportedPdfCharacters({ ...defaultDocumentValues(), terms: { allText } })).toEqual([]);
  });

  it("numbers nested clauses like the Common Paper documents", () => {
    const { template } = types.find((t) => t.spec.id === "cloud-service-agreement")!;
    expect(template.title).toBe("Cloud Service Agreement");
    expect(template.clauses.slice(0, 2)).toEqual([
      { level: 0, label: "1.", content: [{ text: "Service", bold: true }] },
      expect.objectContaining({ level: 1, label: "1.1" }),
    ]);
    expect(template.clauses.map((c) => c.label)).toEqual(expect.arrayContaining(["4.2", "(a)"]));
  });

  it("keeps the Mutual NDA clauses complete", () => {
    const { template } = types.find((t) => t.spec.id === "mutual-nda")!;
    expect(template.title).toBe("Standard Terms");
    expect(template.clauses).toHaveLength(11);
    expect(template.clauses[0].content[0]).toEqual({ text: "Introduction", bold: true });
    expect(text(template.clauses[10].content)).toMatch(/which together form the same agreement\.$/);
  });
});

describe("parseTemplate", () => {
  it("parses nested lists and skips attribution lines", () => {
    const markdown = "# Terms\n\n1. **A**\n    1. B\n        1. C\n            1. D\n2. E\nCommon Paper attribution";
    expect(parseTemplate(markdown).clauses.map((c) => [c.level, c.label])).toEqual([
      [0, "1."],
      [1, "1.1"],
      [2, "(1)"],
      [3, "(1)"],
      [0, "2."],
    ]);
  });

  it("throws when the template has an unexpected shape", () => {
    expect(() => parseTemplate("1. A")).toThrow(/title/);
    expect(() => parseTemplate("# Terms")).toThrow(/no clauses/);
    expect(() => parseTemplate("# Terms\n1. A\n| table |")).toThrow(/Unexpected template line/);
  });
});
