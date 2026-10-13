import { describe, expect, it } from "vitest";
import { loadNdaTemplate, parseNdaTemplate } from "./template";

describe("loadNdaTemplate", () => {
  it("parses the Common Paper Mutual NDA templates in the repo", () => {
    const template = loadNdaTemplate();

    expect(template.standardTermsTitle).toBe("Standard Terms");
    expect(template.clauses).toHaveLength(11);
    expect(template.clauses[0][0]).toEqual({ text: "Introduction", bold: true });
    expect(template.coverIntro.map((run) => run.text).join("")).toContain(
      "This Mutual Non-Disclosure Agreement",
    );
    expect(template.coverAttribution.some((run) => run.href?.includes("creativecommons"))).toBe(true);
    expect(template.standardTermsAttribution.some((run) => run.href?.includes("creativecommons"))).toBe(true);
  });

  it("keeps every clause complete, including the final sentence of the last one", () => {
    const { clauses } = loadNdaTemplate();
    const text = clauses.map((runs) => runs.map((run) => run.text).join(""));

    // Each clause is a single markdown line ending in a full stop; a reflowed
    // template would leave clauses truncated here.
    for (const clause of text) expect(clause).toMatch(/\.$/);
    expect(text[10]).toMatch(/which together form the same agreement\.$/);
  });
});

describe("parseNdaTemplate", () => {
  it("throws when the templates no longer have the expected structure", () => {
    expect(() => parseNdaTemplate("# Cover", "# Standard Terms\n\n1. **Intro**. Text")).toThrow(
      /cover page introduction/,
    );
    expect(() =>
      parseNdaTemplate(
        "## USING THIS MNDA\nIntro\nCommon Paper attribution",
        "# Standard Terms\nCommon Paper attribution",
      ),
    ).toThrow(/clauses/);
  });

  it.each([
    ["cover page attribution", "## USING THIS MNDA\nIntro", "# Standard Terms\n1. **A**. B\nCommon Paper x"],
    ["Standard Terms title", "## USING THIS MNDA\nIntro\nCommon Paper x", "1. **A**. B\nCommon Paper x"],
    ["Standard Terms attribution", "## USING THIS MNDA\nIntro\nCommon Paper x", "# Standard Terms\n1. **A**. B"],
  ])("throws when the %s is missing", (description, cover, terms) => {
    expect(() => parseNdaTemplate(cover, terms)).toThrow(description);
  });
});
