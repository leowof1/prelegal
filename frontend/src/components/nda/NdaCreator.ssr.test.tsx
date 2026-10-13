import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadNdaTemplate } from "@/lib/nda/template";
import { NdaCreator } from "./NdaCreator";

// Runs in Node, like Next.js prerendering at build time.
describe("NdaCreator server rendering", () => {
  const html = renderToString(<NdaCreator template={loadNdaTemplate()} />);

  it("does not bake the build date into the static HTML", () => {
    // The client fills in "today" after hydration; the server must render the placeholder.
    expect(html).toContain("[Effective Date]");
    expect(html).not.toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/);
  });

  it("prerenders the chat, the preview and the full Standard Terms", () => {
    expect(html).toContain("I&#x27;ll help you draft a Mutual Non-Disclosure Agreement");
    expect(html).toContain("Download PDF");
    expect(html).toContain("Agreement preview");
    expect(html).toContain("Equitable Relief");
    expect(html).toContain("which together form the same agreement.");
  });
});
