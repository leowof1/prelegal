import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { GREETING } from "../src/components/document/DocumentChat";
import type { WireValues } from "../src/lib/document/chat";
import { extractPdfPages } from "../src/test/pdf-text";
import { failOnPageErrors, scanA11y } from "./helpers";

const preview = (page: Page) => page.getByRole("region", { name: "Agreement preview" });
const conversation = (page: Page) => page.getByRole("log", { name: "Conversation" });

failOnPageErrors();

const AGREEMENT: WireValues = {
  purpose: "Evaluating a joint product launch.",
  effectiveDate: "2027-01-15",
  mndaTerm: { kind: "expires", years: 2 },
  confidentialityTerm: { kind: "perpetual", years: null },
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 9 applies to both parties.",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
  ],
};

/** Stubs the AI: every message is answered with `reply` and the sent values updated by `update`. */
async function stubChat(page: Page, reply: string, update: (values: WireValues) => WireValues) {
  const requests: { messages: unknown[]; values: WireValues }[] = [];
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({ json: { reply, values: update(body.values) } });
  });
  return requests;
}

async function say(page: Page, text: string, expectedReply: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(conversation(page).getByText(expectedReply)).toBeVisible();
}

async function fillAgreement(page: Page) {
  await stubChat(page, "Your NDA is ready to download.", () => AGREEMENT);
  await say(page, "Acme and Globex, launching a product together.", "Your NDA is ready to download.");
}

async function downloadPdf(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const pages = await extractPdfPages(new Uint8Array(await readFile(await download.path())));
  return { filename: download.suggestedFilename(), pages };
}

test("loads the creator with the template defaults and a greeting", async ({ page }) => {
  let chatCalls = 0;
  await page.route("**/api/chat", (route) => (chatCalls++, route.abort()));
  await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
  await page.goto("/nda/");

  await expect(page).toHaveTitle("Mutual NDA Creator | Prelegal");
  await expect(page.getByRole("heading", { level: 1, name: "Mutual NDA Creator" })).toBeVisible();
  await expect(conversation(page).getByText(GREETING)).toBeVisible();
  await expect(preview(page).getByText("October 4, 2026")).toBeVisible();
  await expect(preview(page).getByText("Expires 1 year from Effective Date.")).toBeVisible();
  await expect(preview(page).getByText("[State]")).toBeVisible();
  await expect(preview(page).getByText("11. General.", { exact: false })).toBeAttached();
  expect(chatCalls).toBe(0);
});

test("sends the conversation and today's values to the AI", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
  const requests = await stubChat(page, "Which state's law applies?", (v) => ({ ...v, governingLaw: "Delaware" }));
  await page.goto("/nda/");

  await say(page, "Delaware law please", "Which state's law applies?");

  await expect(preview(page).getByText("Delaware", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].messages).toEqual([
    { role: "assistant", content: GREETING },
    { role: "user", content: "Delaware law please" },
  ]);
  expect(requests[0].values.effectiveDate).toBe("2026-10-04");
});

test("fills the agreement from the chat and downloads a matching PDF", async ({ page }) => {
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

test("shows an open-ended MNDA term from the chat", async ({ page }) => {
  await stubChat(page, "Noted.", (v) => ({ ...v, mndaTerm: { kind: "untilTerminated", years: null } }));
  await page.goto("/nda/");

  await say(page, "No end date", "Noted.");

  await expect(preview(page).getByText("Continues until terminated in accordance with the terms of the MNDA.")).toBeVisible();
});

test("handles long and non-Latin input without breaking the layout", async ({ page }) => {
  await stubChat(page, "Noted.", (v) => ({
    ...v,
    parties: [{ ...v.parties[0], company: "Łódź Sp. z o.o.", noticeAddress: `${"a".repeat(80)}@example.com` }, v.parties[1]],
  }));
  await page.goto("/nda/");
  await say(page, "We are Łódź Sp. z o.o.", "Noted.");

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
  await stubChat(page, "Noted.", (v) => ({ ...v, governingLaw: "Delaware" }));
  await page.goto("/nda/");

  // After the header's last control, Tab reaches the conversation and then the message box.
  // (The header link is not asserted: WebKit, like Safari, skips links when tabbing.)
  await page.getByRole("link", { name: "Sign in" }).focus();
  await page.keyboard.press("Tab");
  await expect(conversation(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeFocused();

  // Enter sends the message.
  await page.keyboard.type("Delaware law");
  await page.keyboard.press("Enter");
  await expect(conversation(page).getByText("Noted.")).toBeVisible();
  await expect(preview(page).getByText("Delaware", { exact: true })).toBeVisible();

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

  test("has no WCAG A/AA violations after a conversation fills the agreement", async ({ page }) => {
    await page.goto("/nda/");
    await fillAgreement(page);
    expect((await scanA11y(page)).violations).toEqual([]);
  });
});

test("fits the viewport without horizontal scrolling", async ({ page }) => {
  await page.goto("/nda/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // The chat comes before the preview in reading order at every width.
  const chatBox = await conversation(page).boundingBox();
  const previewBox = await preview(page).boundingBox();
  expect(chatBox && previewBox).toBeTruthy();
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    expect(previewBox!.y).toBeGreaterThan(chatBox!.y);
  } else {
    expect(previewBox!.x).toBeGreaterThan(chatBox!.x);
  }
});
