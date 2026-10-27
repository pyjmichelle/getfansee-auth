import { describe, expect, it } from "vitest";
import { integrationBaseUrl, integrationEnabled } from "../environment";

const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration("Paid API: unauthenticated access in isolated E2E mode", () => {
  // Run the local server with E2E=1 so these reach authentication instead of
  // the production Alpha payment-disabled response (403).
  it.each([
    ["/api/subscribe", { creatorId: "00000000-0000-0000-0000-000000000001" }, "Unauthorized"],
    ["/api/unlock", { postId: "00000000-0000-0000-0000-000000000002" }, "UNAUTHORIZED"],
  ])("rejects %s without a verified cookie session", async (route, body, error) => {
    const response = await fetch(`${integrationBaseUrl}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error });
  });
});
