import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { GREETING } from "../src/components/document/DocumentChat";
import type { WireValues } from "../src/lib/document/chat";
import { extractPdfPages } from "../src/test/pdf-text";
import { failOnPageErrors, scanA11y } from "./helpers";

const preview = (page: Page) => page.getByRole("region", { name: "Agreement preview" });
const documentList = (page: Page) => page.getByRole("region", { name: "Available documents" });
const conversation = (page: Page) => page.getByRole("log", { name: "Conversation" });

failOnPageErrors();

const PARTIES: WireValues["parties"] = [
  { name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.test" },
  { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
];

const AGREEMENT: WireValues = {
  documentId: "mutual-nda",
  effectiveDate: "2027-01-15",
  terms: [
    { key: "purpose", value: "Evaluating a joint product launch." },
    { key: "mndaTerm", value: "Expires 2 years from Effective Date." },
    { key: "confidentialityTerm", value: "In perpetuity." },
    { key: "governingLaw", value: "Delaware" },
    { key: "jurisdiction", value: "courts located in New Castle, DE" },
    { key: "modifications", value: "Section 9 applies to both parties." },
  ],
  parties: PARTIES,
};

/** A reply update that chooses the Mutual NDA and applies `terms`. */
const chooseNda =
  (terms: WireValues["terms"] = []) =>
  (v: WireValues): WireValues => ({ ...v, documentId: "mutual-nda", terms });

/** Stubs the AI: every message is answered with `reply` and the sent values updated by `update`. */
async function stubChat(page: Page, reply: string, update: (values: WireValues) => WireValues = (v) => v) {
  const requests: { messages: unknown[]; values: WireValues }[] = [];
  await page.unrouteAll();
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
  await say(page, "An NDA between Acme and Globex, launching a product together.", "Your NDA is ready to download.");
}

async function chooseEmptyNda(page: Page) {
  await stubChat(page, "Let's draft an NDA.", chooseNda());
  await say(page, "An NDA please", "Let's draft an NDA.");
}

async function downloadPdf(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const pages = await extractPdfPages(new Uint8Array(await readFile(await download.path())));
  return { filename: download.suggestedFilename(), pages };
}

test("loads the creator with a greeting and the documents it can draft", async ({ page }) => {
  let chatCalls = 0;
  await page.route("**/api/chat", (route) => (chatCalls++, route.abort()));
  await page.goto("/create/");

  await expect(page).toHaveTitle("Document Creator | Prelegal");
  await expect(page.getByRole("heading", { level: 1, name: "Document Creator" })).toBeVisible();
  await expect(conversation(page).getByText(GREETING)).toBeVisible();
  await expect(documentList(page).getByRole("listitem")).toHaveCount(11);
  await expect(documentList(page).getByText("Business Associate Agreement", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
  expect(chatCalls).toBe(0);
});

test("offers the closest document for an unsupported request", async ({ page }) => {
  const decline = "I can't draft an employment contract. The closest is a Professional Services Agreement.";
  await stubChat(page, decline);
  await page.goto("/create/");

  await say(page, "I need an employment contract", decline);

  await expect(documentList(page)).toBeVisible();
  await expect(preview(page)).toHaveCount(0);
});

test("sends the conversation and today's values to the AI", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
  const requests = await stubChat(page, "Which state's law applies?", chooseNda([{ key: "governingLaw", value: "Delaware" }]));
  await page.goto("/create/");

  await say(page, "An NDA under Delaware law", "Which state's law applies?");

  await expect(preview(page).getByText("October 4, 2026")).toBeVisible();
  await expect(preview(page).getByText("Delaware", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].messages).toEqual([
    { role: "assistant", content: GREETING },
    { role: "user", content: "An NDA under Delaware law" },
  ]);
  expect(requests[0].values).toMatchObject({ documentId: null, effectiveDate: "2026-10-04", terms: [] });
});

test("fills the agreement from the chat and downloads a matching PDF", async ({ page }) => {
  await page.goto("/create/");
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

  expect(filename).toBe("Mutual-Non-Disclosure-Agreement-Acme-Inc-Globex-LLC.pdf");
  expect(pages).toHaveLength(3);
  for (const text of [
    "Evaluating a joint product launch.",
    "January 15, 2027",
    "Expires 2 years from Effective Date.",
    "In perpetuity.",
    "Delaware",
    "courts located in New Castle, DE",
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

test("switches documents mid-conversation and downloads the new one with nested clauses", async ({ page }) => {
  await page.goto("/create/");
  await fillAgreement(page);

  await stubChat(page, "Switched to a Cloud Service Agreement.", (v) => ({
    ...v,
    documentId: "cloud-service-agreement",
    terms: [{ key: "subscriptionPeriod", value: "1 year from the Order Date" }],
  }));
  await say(page, "Actually, we are selling them our SaaS product", "Switched to a Cloud Service Agreement.");

  const doc = preview(page);
  await expect(doc.getByRole("heading", { name: "Cloud Service Agreement" }).first()).toBeVisible();
  await expect(doc.getByText("1 year from the Order Date", { exact: true })).toBeVisible();
  // Governing law carries over; the parties keep their details under the new roles.
  await expect(doc.getByText("Delaware", { exact: true })).toBeVisible();
  await expect(doc.getByRole("columnheader", { name: "Provider" })).toBeVisible();
  await expect(doc.getByRole("row", { name: /Company/ })).toContainText("Acme Inc");
  await expect(doc.getByText("[Chosen Courts]")).toBeVisible();

  const { filename, pages } = await downloadPdf(page);
  expect(filename).toBe("Cloud-Service-Agreement-Acme-Inc-Globex-LLC.pdf");
  const terms = pages.slice(1).join(" ");
  expect(terms).toMatch(/^Cloud Service Agreement 1\. Service 1\.1 Access and Use\./);
  expect(terms).toContain("(a)");
});

test("downloads a PDF with placeholders when nothing is filled in", async ({ page }) => {
  await page.goto("/create/");
  await chooseEmptyNda(page);
  const { filename, pages } = await downloadPdf(page);

  expect(filename).toBe("Mutual-Non-Disclosure-Agreement.pdf");
  expect(pages[0]).toContain("[Governing Law]");
});

test("handles long and non-Latin input without breaking the layout", async ({ page }) => {
  await stubChat(page, "Noted.", (v) => ({
    ...v,
    documentId: "mutual-nda",
    parties: [{ ...v.parties[0], company: "Łódź Sp. z o.o.", noticeAddress: `${"a".repeat(80)}@example.com` }, v.parties[1]],
  }));
  await page.goto("/create/");
  await say(page, "An NDA. We are Łódź Sp. z o.o.", "Noted.");

  // The preview's table cell wraps the long address instead of widening the document.
  const region = preview(page);
  const overflow = await region.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // The user is warned before downloading a PDF that would garble the name.
  await expect(page.getByRole("status")).toContainText("Ł");
  const { pages } = await downloadPdf(page);
  expect(pages.length).toBeGreaterThanOrEqual(3);
});

test("is operable with the keyboard alone", async ({ page }) => {
  await stubChat(page, "Noted.", chooseNda([{ key: "governingLaw", value: "Delaware" }]));
  await page.goto("/create/");

  // After the header's last control, Tab reaches the conversation and then the message box.
  // (The header link is not asserted: WebKit, like Safari, skips links when tabbing.)
  await page.getByRole("link", { name: "Sign in" }).focus();
  await page.keyboard.press("Tab");
  await expect(conversation(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeFocused();

  // Enter sends the message.
  await page.keyboard.type("An NDA under Delaware law");
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
  expect((await downloadPromise).suggestedFilename()).toBe("Mutual-Non-Disclosure-Agreement.pdf");
});

test.describe("accessibility", () => {
  test("has no WCAG A/AA violations before a document is chosen", async ({ page }) => {
    await page.goto("/create/");
    expect((await scanA11y(page)).violations).toEqual([]);
  });

  test("has no WCAG A/AA violations after a conversation fills the agreement", async ({ page }) => {
    await page.goto("/create/");
    await fillAgreement(page);
    expect((await scanA11y(page)).violations).toEqual([]);
  });
});

test("fits the viewport without horizontal scrolling", async ({ page }) => {
  await page.goto("/create/");
  await chooseEmptyNda(page);

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
