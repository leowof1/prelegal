import { expect, test } from "@playwright/test";
import { allowConsoleError, failOnPageErrors, PASSWORD, scanA11y, signUp } from "./helpers";

failOnPageErrors();

test("creates an account and enters the document creator", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Sign in | Prelegal");

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(`${crypto.randomUUID()}@acme.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Document Creator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // The session survives a full page reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("signs out, then signs back in to My documents", async ({ page }) => {
  const { email } = await signUp(page);
  await page.goto("/create/");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveTitle("Sign in | Prelegal");
  await expect(page).toHaveURL(/\/$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/documents\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "My documents" })).toBeVisible();
});

test("rejects a wrong password", async ({ page }) => {
  allowConsoleError(/401/);
  const { email } = await signUp(page);
  await page.request.post("/api/auth/signout");
  await page.goto("/");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
  await expect(page).toHaveTitle("Sign in | Prelegal");
});

test("does not create an account with a short password", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@acme.test");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("sends signed-out visitors to the sign-in screen", async ({ page }) => {
  for (const path of ["/create/", "/documents/", "/create/?doc=1"]) {
    await page.goto(path);
    await expect(page).toHaveTitle("Sign in | Prelegal");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  }
});

test("sends a signed-in user from the sign-in screen to My documents", async ({ page }) => {
  await signUp(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/documents\/$/);
});

test("reaches the creator at /create without a trailing slash", async ({ page }) => {
  await signUp(page);
  await page.goto("/create");
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Document Creator" })).toBeVisible();
});

test("the API is served alongside the frontend", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("the sign-in and sign-up screens have no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect((await scanA11y(page)).violations).toEqual([]);

  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByLabel("Full name")).toBeVisible();
  expect((await scanA11y(page)).violations).toEqual([]);
});
