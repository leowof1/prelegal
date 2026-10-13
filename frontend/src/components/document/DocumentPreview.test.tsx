/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNdaDocument, defaultNdaValues } from "@/lib/document/build";
import { loadNdaTemplate } from "@/lib/document/template";
import { filledValues } from "@/test/fixtures";
import { DocumentPreview } from "./DocumentPreview";

const template = loadNdaTemplate();

const renderPreview = (values = filledValues()) =>
  render(<DocumentPreview blocks={buildNdaDocument(template, values)} />);

describe("DocumentPreview", () => {
  it("renders the cover page fields with their hints", () => {
    renderPreview();

    expect(screen.getByRole("heading", { name: "Purpose" })).toBeInTheDocument();
    expect(screen.getByText("How Confidential Information may be used")).toBeInTheDocument();
    expect(screen.getByText("Evaluating a joint product launch.")).toBeInTheDocument();
    expect(screen.getByText("Expires 2 years from Effective Date.")).toBeInTheDocument();
  });

  it("numbers the Standard Terms clauses in order with bold headings", () => {
    const { container } = renderPreview();

    const clauses = [...container.querySelectorAll("p")]
      .map((p) => p.textContent ?? "")
      .filter((text) => /^\d+\. /.test(text));
    expect(clauses).toHaveLength(11);
    expect(clauses.map((text) => Number(text.split(".")[0]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(screen.getByText("Introduction").tagName).toBe("STRONG");
  });

  it("renders cover page references in the terms as bold defined terms", () => {
    renderPreview();
    expect(screen.getAllByText("Governing Law", { selector: "strong" }).length).toBeGreaterThanOrEqual(2);
  });

  it("opens attribution links safely in a new tab", () => {
    renderPreview();

    for (const link of screen.getAllByRole("link", { name: "CC BY 4.0" })) {
      expect(link).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("renders an accessible signature table with blank signature and date rows", () => {
    renderPreview();
    const table = screen.getByRole("table");

    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Field",
      "Party 1",
      "Party 2",
    ]);
    for (const label of ["Signature", "Date"]) {
      const row = within(table).getByRole("rowheader", { name: label }).closest("tr")!;
      expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["", ""]);
    }
  });

  it("highlights every placeholder in an empty document", () => {
    renderPreview(defaultNdaValues());

    for (const text of ["[Effective Date]", "[State]", "[City or county and state]"]) {
      expect(screen.getByText(text)).toHaveClass("bg-amber-100");
    }
  });
});
