import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Fails any test whose page logs an error, e.g. a hydration mismatch or a crash. */
export function failOnPageErrors() {
  let pageErrors: string[];
  test.beforeEach(({ page }) => {
    pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(message.text());
    });
  });
  test.afterEach(() => {
    expect(pageErrors).toEqual([]);
  });
}

/** Runs an axe scan for WCAG 2.1 A/AA issues. */
export function scanA11y(page: Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
}
