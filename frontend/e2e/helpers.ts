import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

let allowedErrors: RegExp[] = [];

/** Fails any test whose page logs an error, e.g. a hydration mismatch or a crash. */
export function failOnPageErrors() {
  let pageErrors: string[];
  test.beforeEach(({ page }) => {
    pageErrors = [];
    allowedErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(message.text());
    });
  });
  test.afterEach(() => {
    expect(pageErrors.filter((error) => !allowedErrors.some((allowed) => allowed.test(error)))).toEqual([]);
  });
}

/** Lets the current test log an expected error, e.g. the browser reporting a rejected sign-in. */
export function allowConsoleError(pattern: RegExp) {
  allowedErrors.push(pattern);
}

/** Runs an axe scan for WCAG 2.1 A/AA issues. */
export function scanA11y(page: Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
}

export const PASSWORD = "correct horse battery";

/**
 * Registers a new account through the API and signs the page's browser context in.
 * Emails are unique: tests run in parallel against one database.
 */
export async function signUp(page: Page, name = "Ada Lovelace") {
  const email = `${crypto.randomUUID()}@acme.test`;
  const response = await page.request.post("/api/auth/signup", { data: { name, email, password: PASSWORD } });
  expect(response.status()).toBe(201);
  return { name, email };
}
