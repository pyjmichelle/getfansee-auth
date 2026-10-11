import { describe, expect, it } from "vitest";
import { integrationBaseUrl, integrationEnabled } from "../environment";

const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration("Transactions API: unauthenticated access", () => {
  it("does not expose financial history without a cookie session", async () => {
    const response = await fetch(`${integrationBaseUrl}/api/transactions`, { redirect: "manual" });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Unauthorized" });
  });
});
