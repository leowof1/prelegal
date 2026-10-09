import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { extractPdfPages } from "../src/test/pdf-text";
import { failOnPageErrors, scanA11y } from "./helpers";

const preview = (page: Page) => page.getByRole("region", { name: "Agreement preview" });
const group = (page: Page, name: string) => page.getByRole("group", { name });

failOnPageErrors();

async function fillAgreement(page: Page) {
  await page.getByLabel("Purpose").fill("Evaluating a joint product launch.");
  await page.getByLabel("Effective Date").fill("2027-01-15");
  await page.getByLabel("MNDA Term in years").fill("2");
  await group(page, "Term of Confidentiality").getByLabel("In perpetuity").check();
  await page.getByLabel("Governing Law").fill("Delaware");
  await page.getByLabel("Jurisdiction").fill("courts located in New Castle, DE");
  await page.getByLabel("MNDA Modifications").fill("Section 9 applies to both parties.");
  const parties = [
    { Company: "Acme Inc", "Signer name": "Ada Lovelace", Title: "CEO", "Notice address": "ada@acme.test" },
    { Company: "Globex LLC", "Signer name": "Alan Turing", Title: "CTO", "Notice address": "alan@globex.test" },
  ];
  for (const [index, fields] of parties.entries()) {
    for (const [label, value] of Object.entries(fields)) {
      await group(page, `Party ${index + 1}`).getByLabel(label).fill(value);
    }
  }
}

async function downloadPdf(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const pages = await extractPdfPages(new Uint8Array(await readFile(await download.path())));
  return { filename: download.suggestedFilename(), pages };
}

test("loads the creator with the template defaults", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
  await page.goto("/nda/");

  await expect(page).toHaveTitle("Mutual NDA Creator | Prelegal");
  await expect(page.getByRole("heading", { level: 1, name: "Mutual NDA Creator" })).toBeVisible();
  await expect(page.getByLabel("Effective Date")).toHaveValue("2026-10-04");
  await expect(preview(page).getByText("October 4, 2026")).toBeVisible();
  await expect(preview(page).getByText("Expires 1 year from Effective Date.")).toBeVisible();
  await expect(preview(page).getByText("[State]")).toBeVisible();
  await expect(preview(page).getByText("11. General.", { exact: false })).toBeAttached();
});

test("fills the agreement, previews it live and downloads a matching PDF", async ({ page }) => {
  await page.goto("/nda/");
  await fillAgreement(page);

  const doc = preview(page);
  await expect(doc.getByText("January 15, 2027")).toBeVisible();
  await expect(doc.getByText("Expires 2 years from Effective Date.")).toBeVisible();
  await expect(doc.getByText("In perpetuity.")).toBeVisible();
  await expect(doc.getByText("Section 9 applies to both parties.")).toBeVisible();
  await expect(doc.getByRole("row", { name: /Company/ })).toContainText("Acme Inc");
  await expect(doc.getByRole("row", { name: /Company/ })).toContainText("Globex LLC");
  await expect(doc.locator(".bg-amber-100")).toHaveCount(0);

  const { filename, pages } = await downloadPdf(page);

  expect(filename).toBe("Mutual-NDA-Acme-Inc-Globex-LLC.pdf");
  expect(pages).toHaveLength(3);
  for (const text of [
    "Evaluating a joint product launch.",
    "January 15, 2027",
    "Expires 2 years from Effective Date.",
    "In perpetuity.",
    "Governing Law: Delaware",
    "Jurisdiction: courts located in New Castle, DE",
    "Ada Lovelace",
    "Alan Turing",
    "Globex LLC",
    "alan@globex.test",
  ]) {
    expect(pages[0]).toContain(text);
  }
  expect(pages[1]).toMatch(/^Standard Terms 1\. Introduction\./);
  for (const pageText of pages) expect(pageText).toContain("free to use under CC BY 4.0.");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
});

test("downloads a PDF with placeholders when nothing is filled in", async ({ page }) => {
  await page.goto("/nda/");
  const { filename, pages } = await downloadPdf(page);

  expect(filename).toBe("Mutual-NDA.pdf");
  expect(pages[0]).toContain("Governing Law: [State]");
});

test("switches term options and flags invalid years", async ({ page }) => {
  await page.goto("/nda/");
  const mndaTerm = group(page, "MNDA Term");
  const years = page.getByLabel("MNDA Term in years");

  // The years box stays compact so its label fits beside it.
  expect((await years.boundingBox())!.width).toBeLessThan(120);

  await mndaTerm.getByLabel("Continues until terminated").check();
  await expect(preview(page).getByText("Continues until terminated in accordance with the terms of the MNDA.")).toBeVisible();
  await expect(years).toBeDisabled();

  await mndaTerm.getByRole("radio", { name: "A fixed number of years" }).check();
  await expect(years).toBeEnabled();
  await years.fill("");
  await expect(preview(page).getByText("[Number of years]")).toBeVisible();
  await years.fill("5");
  await expect(preview(page).getByText("Expires 5 years from Effective Date.")).toBeVisible();
});

test("remembers years across term switches and explains invalid values", async ({ page }) => {
  await page.goto("/nda/");
  const term = group(page, "MNDA Term");
  const years = page.getByLabel("MNDA Term in years");

  await years.fill("4");
  await term.getByLabel("Continues until terminated").check();
  await term.getByRole("radio", { name: "A fixed number of years" }).check();
  await expect(years).toHaveValue("4");
  await expect(preview(page).getByText("Expires 4 years from Effective Date.")).toBeVisible();

  await years.fill("0");
  await expect(years).toHaveValue("0");
  await expect(page.getByText("Enter a whole number of years from 1 to 100.")).toBeVisible();
  await expect(preview(page).getByText("[Number of years]")).toBeVisible();
});

test("handles long and non-Latin input without breaking the layout", async ({ page }) => {
  await page.goto("/nda/");
  const party1 = group(page, "Party 1");
  await party1.getByLabel("Notice address").fill(`${"a".repeat(80)}@example.com`);
  await party1.getByLabel("Company").fill("Łódź Sp. z o.o.");

  // The preview's table cell wraps the long address instead of widening the document.
  const region = preview(page);
  const overflow = await region.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // The user is warned before downloading a PDF that would garble the name.
  await expect(page.getByRole("status")).toContainText("Ł");
  const { pages } = await downloadPdf(page);
  expect(pages).toHaveLength(3);
});

test("is operable with the keyboard alone", async ({ page }) => {
  await page.goto("/nda/");

  // After the header's last control, Tab lands on the first form field.
  // (The header link is not asserted: WebKit, like Safari, skips links when tabbing.)
  await page.getByRole("link", { name: "Sign in" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Purpose")).toBeFocused();

  // The scrollable preview can be focused and scrolled with the keyboard.
  const region = preview(page);
  await region.focus();
  await expect(region).toBeFocused();
  await page.keyboard.press("End");
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  // The download button works from the keyboard.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).focus();
  await page.keyboard.press("Enter");
  expect((await downloadPromise).suggestedFilename()).toBe("Mutual-NDA.pdf");
});

test.describe("accessibility", () => {
  test("has no WCAG A/AA violations in the default state", async ({ page }) => {
    await page.goto("/nda/");
    expect((await scanA11y(page)).violations).toEqual([]);
  });

  test("has no WCAG A/AA violations with alternative options selected and values filled", async ({ page }) => {
    await page.goto("/nda/");
    await fillAgreement(page);
    await group(page, "MNDA Term").getByLabel("Continues until terminated").check();
    expect((await scanA11y(page)).violations).toEqual([]);
  });
});

test("fits the viewport without horizontal scrolling", async ({ page }) => {
  await page.goto("/nda/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // The form comes before the preview in reading order at every width.
  const formBox = await page.getByRole("group", { name: "Agreement" }).boundingBox();
  const previewBox = await preview(page).boundingBox();
  expect(formBox && previewBox).toBeTruthy();
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    expect(previewBox!.y).toBeGreaterThan(formBox!.y);
  } else {
    expect(previewBox!.x).toBeGreaterThan(formBox!.x);
  }
});
