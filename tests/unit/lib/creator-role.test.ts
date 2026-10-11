import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  verification: vi.fn(),
  update: vi.fn(),
  saved: vi.fn(),
}));
vi.mock("@/lib/server/auth-server", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: table === "creator_verifications" ? mocks.verification : mocks.saved,
        update: mocks.update.mockImplementation(() => query),
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/server/supabase-server", () => ({ getSupabaseServerClient: vi.fn() }));
import { setRoleCreator } from "@/lib/server/profile-server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user-1" });
  mocks.verification.mockResolvedValue({ data: { status: "approved" }, error: null });
  mocks.saved.mockResolvedValue({ data: { id: "user-1" }, error: null });
});
describe("server creator promotion", () => {
  it("uses privileged write only after own verified KYC", async () => {
    expect(await setRoleCreator("user-1")).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ role: "creator" });
  });
  it("refuses promoting another account", async () => {
    expect(await setRoleCreator("user-2")).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses unapproved KYC", async () => {
    mocks.verification.mockResolvedValue({ data: { status: "pending" }, error: null });
    expect(await setRoleCreator("user-1")).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not report success when profile update affects no row", async () => {
    mocks.saved.mockResolvedValue({ data: null, error: null });
    expect(await setRoleCreator("user-1")).toBe(false);
  });
});
