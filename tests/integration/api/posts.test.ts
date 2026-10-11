import { describe, expect, it } from "vitest";
import { integrationBaseUrl, integrationEnabled } from "../environment";

const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration("Posts API: unauthenticated access", () => {
  it("rejects creating a post without a verified cookie session", async () => {
    const response = await fetch(`${integrationBaseUrl}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unauthorized", content: "Test", visibility: "free" }),
      redirect: "manual",
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "UNAUTHORIZED", code: "UNAUTHORIZED" });
  });
});
