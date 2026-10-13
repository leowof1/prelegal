import { describe, expect, it } from "vitest";
import { parseInline } from "./markdown";

describe("parseInline", () => {
  it("returns plain text as a single run", () => {
    expect(parseInline("Hello world")).toEqual([{ text: "Hello world" }]);
  });

  it("parses bold, links and cover page references", () => {
    expect(
      parseInline(
        'A (“**MNDA**”) for the <span class="coverpage_link">Purpose</span> under [CC BY 4.0](https://example.com).',
      ),
    ).toEqual([
      { text: "A (“" },
      { text: "MNDA", bold: true },
      { text: "”) for the " },
      { text: "Purpose", bold: true },
      { text: " under " },
      { text: "CC BY 4.0", href: "https://example.com" },
      { text: "." },
    ]);
  });

  it("bolds every kind of defined-term reference and clause heading", () => {
    const kinds = ["keyterms_link", "orderform_link", "sow_link", "businessterms_link", "header_2", "header_3"];
    for (const kind of kinds) {
      expect(parseInline(`<span class="${kind}" id="1.1">Term</span> applies`)).toEqual([
        { text: "Term", bold: true },
        { text: " applies" },
      ]);
    }
  });

  it("drops anchor spans but keeps their content", () => {
    expect(parseInline('<span id="4.1"></span>**"AI"** means <span id="4.2">**"Input"**</span>')).toEqual([
      { text: '"AI"', bold: true },
      { text: " means " },
      { text: '"Input"', bold: true },
    ]);
  });

  it("parses autolinks", () => {
    expect(parseInline("posted at <https://commonpaper.com/x>.")).toEqual([
      { text: "posted at " },
      { text: "https://commonpaper.com/x", href: "https://commonpaper.com/x" },
      { text: "." },
    ]);
  });

  it("returns no runs for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });

  it("parses adjacent constructs without empty runs between them", () => {
    expect(parseInline("[a](https://a.test)**b**")).toEqual([
      { text: "a", href: "https://a.test" },
      { text: "b", bold: true },
    ]);
  });

  it("leaves an unterminated bold marker as literal text", () => {
    expect(parseInline("a **b")).toEqual([{ text: "a **b" }]);
  });
});
