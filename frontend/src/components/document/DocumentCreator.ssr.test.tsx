import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { documentTypes } from "@/test/fixtures";
import { DocumentCreator } from "./DocumentCreator";

// Runs in Node, like Next.js prerendering at build time.
describe("DocumentCreator server rendering", () => {
  const html = renderToString(<DocumentCreator documentTypes={documentTypes} />);

  it("prerenders the chat and the list of documents the assistant can draft", () => {
    expect(html).toContain("I&#x27;ll help you draft a legal agreement");
    expect(html).toContain("Tell the assistant what you need");
    for (const { spec } of documentTypes) expect(html).toContain(spec.name);
  });

  it("shows no preview or download until a document is chosen", () => {
    expect(html).not.toContain("Agreement preview");
    expect(html).not.toContain("Download PDF");
  });
});
