/**
 * Anonymous /home must land on the auth page, never on the error boundary.
 *
 * Guards the 2026-03 investigation in docs/reports/home-error-reproduction-report.md,
 * where users reported a "Something went wrong" screen on /home. The cause was
 * never reproduced and the correct behaviour — a redirect to /auth — has held
 * since; this keeps a regression from sliding back in unnoticed.
 *
 * The redirect happens in two hops: /home returns a server redirect to /auth,
 * then /auth rewrites its own URL to ?mode=login once hydrated. Waiting on
 * `networkidle` races that second hop and aborts the navigation, so assert on
 * the settled URL instead of on the navigation's own completion.
 */

import { test, expect } from "@playwright/test";
import { isNavigationAbortError } from "./shared/helpers";

test.describe("anonymous /home", () => {
  test("redirects to auth instead of rendering the error boundary", async ({ page, context }) => {
    await context.clearCookies();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // The client-side rewrite on /auth can abort this navigation mid-flight.
    // That abort is the redirect working, so let the landing URL below decide;
    // anything else is a genuine failure to load and must still surface.
    await page.goto("/home", { waitUntil: "domcontentloaded" }).catch((error: unknown) => {
      if (!isNavigationAbortError(error)) throw error;
    });

    await expect(page).toHaveURL(/\/auth(\?|$)/);

    // Console output is carried into the failure message rather than asserted
    // on: the March report's smoking gun would have been an auth-bootstrap or
    // module error, and that context is what makes a red run diagnosable.
    await expect(
      page.locator('h1:has-text("Something went wrong")'),
      `console errors: ${consoleErrors.join(" | ") || "none"}`
    ).toHaveCount(0);
  });
});
