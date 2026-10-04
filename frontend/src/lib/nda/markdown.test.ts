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
