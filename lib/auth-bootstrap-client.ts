"use client";

type BootstrapResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
  profile?: {
    role: "fan" | "creator" | "admin";
    display_name: string;
    avatar_url: string | null;
  } | null;
};

const BOOTSTRAP_TTL_MS = 30_000;

let cachedValue: BootstrapResponse | null = null;
let cachedAt = 0;
let inflightPromise: Promise<BootstrapResponse> | null = null;

async function fetchBootstrap(): Promise<BootstrapResponse> {
  const res = await fetch("/api/auth/bootstrap", {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    return { authenticated: false };
  }
  return (await res.json()) as BootstrapResponse;
}

export async function getAuthBootstrap(force = false): Promise<BootstrapResponse> {
  const now = Date.now();
  if (!force && cachedValue && now - cachedAt < BOOTSTRAP_TTL_MS) {
    return cachedValue;
  }

  if (!force && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = fetchBootstrap()
    .then((value) => {
      // 不缓存未登录态，避免匿名首访后阻塞后续 session 注入场景（如 QA gate / E2E）。
      if (value.authenticated) {
        cachedValue = value;
        cachedAt = Date.now();
      } else {
        cachedValue = null;
        cachedAt = 0;
      }
      return value;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export function invalidateAuthBootstrap() {
  cachedValue = null;
  cachedAt = 0;
  inflightPromise = null;
}

export function prefetchAuthBootstrap() {
  void getAuthBootstrap(false);
}
