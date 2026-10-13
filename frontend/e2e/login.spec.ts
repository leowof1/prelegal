import { expect, test } from "@playwright/test";
import { failOnPageErrors, scanA11y } from "./helpers";

failOnPageErrors();

test("signs in with any name and email and enters the platform", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Sign in | Prelegal");

  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@acme.test");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Document Creator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // The session survives a full page reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("signs out back to the login screen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@acme.test");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveTitle("Sign in | Prelegal");
  await page.goto("/create/");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("does not sign in without a valid email", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveTitle("Sign in | Prelegal");
});

test("reaches the creator at /create without a trailing slash", async ({ page }) => {
  await page.goto("/create");
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Document Creator" })).toBeVisible();
});

test("the API is served alongside the frontend", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("the login screen has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  expect((await scanA11y(page)).violations).toEqual([]);
});
