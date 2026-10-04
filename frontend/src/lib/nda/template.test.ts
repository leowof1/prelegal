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
});
