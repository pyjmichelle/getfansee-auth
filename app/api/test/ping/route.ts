/**
 * CI/E2E 健康检查：确认 test-mode 已开启，/api/test/* 路由可用。
 * GET 返回 200 表示 test-mode 开启；否则 404。
 * 门控仅 E2E 与 PLAYWRIGHT_TEST_MODE，不依赖 NEXT_PUBLIC_TEST_MODE。
 */
const isTestEnv = process.env.E2E === "1" || process.env.PLAYWRIGHT_TEST_MODE === "true";

export async function GET() {
  if (!isTestEnv) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(JSON.stringify({ ok: true, testMode: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
