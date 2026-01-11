/**
 * 通用 Auth Helper，封装 getCurrentUser 以便在 Server/Client 环境中复用
 */

import type { AppUser } from "./auth";

export async function getCurrentUserUniversal(): Promise<AppUser | null> {
  if (typeof window === "undefined") {
    const { getCurrentUser } = await import("./auth-server");
    return getCurrentUser();
  }

  const { getCurrentUser } = await import("./auth");
  return getCurrentUser();
}
