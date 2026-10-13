import { expect, test, type Page } from "@playwright/test";
import type { WireValues } from "../src/lib/document/chat";
import { allowConsoleError, failOnPageErrors, scanA11y, signUp } from "./helpers";

failOnPageErrors();

const conversation = (page: Page) => page.getByRole("log", { name: "Conversation" });
const documents = (page: Page) => page.getByRole("list", { name: "Your documents" });

const PARTY = { name: "", title: "", company: "", noticeAddress: "" };
const NDA: WireValues = {
  documentId: "mutual-nda",
  effectiveDate: "2027-01-15",
  terms: [{ key: "governingLaw", value: "Delaware" }],
  parties: [
    { ...PARTY, company: "Acme Inc" },
    { ...PARTY, company: "Globex LLC" },
  ],
};

/** Stubs only the AI; saving and loading documents go to the real backend. */
async function draftNda(page: Page) {
  await page.route("**/api/chat", (route) => route.fulfill({ json: { reply: "Your NDA is drafted.", values: NDA } }));
  await page.getByRole("textbox", { name: "Message" }).fill("An NDA between Acme and Globex under Delaware law");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(conversation(page).getByText("Your NDA is drafted.")).toBeVisible();
  await expect(page.getByText("Saved to My documents", { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("a new user is invited to start their first document", async ({ page }) => {
  await page.goto("/documents/");
  await expect(page).toHaveTitle("My documents | Prelegal");
  await expect(page.getByRole("heading", { name: "No documents yet" })).toBeVisible();

  await page.getByRole("link", { name: "Start a document" }).click();
  await expect(page).toHaveURL(/\/create\/$/);
});

test("saves a drafted document and reopens it with its conversation", async ({ page }) => {
  await page.goto("/create/");
  await draftNda(page);

  await expect(page).toHaveURL(/\/create\/\?doc=\d+$/);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My documents" }).click();
  const entry = documents(page).getByRole("link");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("Mutual Non-Disclosure Agreement");
  await expect(entry).toContainText("Acme Inc and Globex LLC");

  await entry.click();
  await expect(page).toHaveURL(/\/create\/\?doc=\d+$/);
  await expect(conversation(page).getByText("An NDA between Acme and Globex under Delaware law")).toBeVisible();
  await expect(conversation(page).getByText("Your NDA is drafted.")).toBeVisible();
  const preview = page.getByRole("region", { name: "Agreement preview" });
  await expect(preview.getByText("Delaware", { exact: true })).toBeVisible();
  await expect(preview.getByText("January 15, 2027")).toBeVisible();

  // Reloading the page reopens the same document.
  await page.reload();
  await expect(conversation(page).getByText("Your NDA is drafted.")).toBeVisible();
});

test("New document starts over after a saved draft", async ({ page }) => {
  await page.goto("/create/");
  await draftNda(page);
  await expect(page).toHaveURL(/\?doc=\d+$/);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "New document" }).click();
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(conversation(page).getByText("Your NDA is drafted.")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Available documents" })).toBeVisible();
});

test("users only see their own documents", async ({ page }) => {
  await page.goto("/create/");
  await draftNda(page);
  await expect(page).toHaveURL(/\?doc=\d+$/);
  const ownUrl = page.url();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveTitle("Sign in | Prelegal");
  await signUp(page, "Bob");

  await page.goto("/documents/");
  await expect(page.getByRole("heading", { name: "No documents yet" })).toBeVisible();

  // Opening the other user's document by its URL fails.
  allowConsoleError(/404/);
  await page.goto(ownUrl);
  await expect(page.getByRole("heading", { name: "This document could not be opened" })).toBeVisible();
});

test("My documents has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/create/");
  await draftNda(page);
  await page.goto("/documents/");
  await expect(documents(page)).toBeVisible();
  expect((await scanA11y(page)).violations).toEqual([]);
});
