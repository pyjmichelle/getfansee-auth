/**
 * 测试服务器健康检查脚本
 * 用于诊断 Playwright 测试前的服务器状态
 */

const SERVER_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const LOG_ENDPOINT = "http://127.0.0.1:7243/ingest/68e3b8f5-5423-4da0-8d81-7693c6fde45d";

async function log(message: string, data?: Record<string, unknown>) {
  const payload = {
    location: "test-server-health.ts",
    message,
    data: data || {},
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "server-check",
  };
  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (logError) {
    console.warn("[test-server-health] Failed to log diagnostics", logError);
  }
}

async function checkServer() {
  await log("开始服务器健康检查", { url: SERVER_URL });

  try {
    // 检查服务器是否响应
    const response = await fetch(SERVER_URL, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    await log("服务器响应", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (response.ok) {
      console.log("✅ 服务器运行正常");
      await log("服务器健康检查通过");
      return true;
    } else {
      console.log(`❌ 服务器响应异常: ${response.status} ${response.statusText}`);
      await log("服务器响应异常", { status: response.status });
      return false;
    }
  } catch (error: any) {
    console.log(`❌ 服务器连接失败: ${error.message}`);
    await log("服务器连接失败", {
      error: error.message,
      name: error.name,
    });
    return false;
  }
}

async function runServerHealthCheck() {
  console.log("🔍 检查测试服务器状态...\n");
  await log("开始诊断流程");

  const isHealthy = await checkServer();

  if (isHealthy) {
    console.log("\n✅ 服务器准备就绪，可以运行测试");
    process.exit(0);
  } else {
    console.log("\n❌ 服务器未就绪，请先启动开发服务器:");
    console.log("   pnpm run dev");
    process.exit(1);
  }
}

runServerHealthCheck().catch((error) => {
  console.error("诊断脚本错误:", error);
  process.exit(1);
});
