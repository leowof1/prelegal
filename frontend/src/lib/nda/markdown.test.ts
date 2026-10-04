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
});
