/**
 * The age gate's weakest link is the callback URL: it carries the check id in a
 * query parameter, so possession of that id must not be enough to mint the
 * signed cookie. These tests pin the two properties that make it enough —
 * holding the secret from /start, and not having spent it already.
 */

import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateChain = {
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  select: vi.fn(),
};

const mockAdmin = { from: vi.fn(() => updateChain) };

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(() => mockAdmin),
}));

const CHECK_ID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";

describe("readAgeClaimSecret", () => {
  it("读出属于本次 check 的密钥", async () => {
    const { readAgeClaimSecret } = await import("@/lib/compliance/age-assurance");
    expect(readAgeClaimSecret(`${CHECK_ID}.s3cret`, CHECK_ID)).toBe("s3cret");
  });

  // A cookie left over from an earlier attempt must not be usable against a
  // different check id, or a visitor who failed once could replay that pass.
  it("拒绝写着别的 check id 的 cookie", async () => {
    const { readAgeClaimSecret } = await import("@/lib/compliance/age-assurance");
    const other = "00000000-0000-4000-8000-000000000000";
    expect(readAgeClaimSecret(`${other}.s3cret`, CHECK_ID)).toBeNull();
  });

  // No cookie means the visitor is holding a link, not a session.
  it("没有 cookie 时返回 null", async () => {
    const { readAgeClaimSecret } = await import("@/lib/compliance/age-assurance");
    expect(readAgeClaimSecret(undefined, CHECK_ID)).toBeNull();
    expect(readAgeClaimSecret(`${CHECK_ID}.`, CHECK_ID)).toBeNull();
    expect(readAgeClaimSecret(CHECK_ID, CHECK_ID)).toBeNull();
  });
});

describe("claimPassedAgeCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain.update.mockReturnThis();
    updateChain.eq.mockReturnThis();
    updateChain.is.mockReturnThis();
  });

  // Every guard lives in one UPDATE's WHERE clause on purpose: reading the row
  // and then writing it would let two concurrent callbacks both pass the
  // "not yet claimed" test.
  it("在同一条 UPDATE 里带齐 passed / 密钥哈希 / 未被领取三个条件", async () => {
    updateChain.select.mockResolvedValue({ data: [{ id: CHECK_ID }], error: null });
    const { claimPassedAgeCheck } = await import("@/lib/compliance/age-assurance");

    await expect(claimPassedAgeCheck(CHECK_ID, "s3cret")).resolves.toBe(true);

    expect(updateChain.eq).toHaveBeenCalledWith("id", CHECK_ID);
    expect(updateChain.eq).toHaveBeenCalledWith("status", "passed");
    expect(updateChain.eq).toHaveBeenCalledWith(
      "claim_secret_hash",
      createHash("sha256").update("s3cret").digest("hex")
    );
    expect(updateChain.is).toHaveBeenCalledWith("claimed_at", null);
  });

  // A replay updates nothing, and "nothing updated" has to read as a refusal.
  it("已被领取过时（0 行命中）拒发 cookie", async () => {
    updateChain.select.mockResolvedValue({ data: [], error: null });
    const { claimPassedAgeCheck } = await import("@/lib/compliance/age-assurance");

    await expect(claimPassedAgeCheck(CHECK_ID, "s3cret")).resolves.toBe(false);
  });

  it("数据库报错时拒发 cookie，不当成领取成功", async () => {
    updateChain.select.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { claimPassedAgeCheck } = await import("@/lib/compliance/age-assurance");

    await expect(claimPassedAgeCheck(CHECK_ID, "s3cret")).resolves.toBe(false);
  });
});
