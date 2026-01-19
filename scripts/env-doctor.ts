#!/usr/bin/env tsx
/**
 * ENV Doctor - 环境健康检查脚本
 * 验证所有必需的环境变量并测试 Supabase 连接
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

interface EnvCheck {
  name: string;
  value: string | undefined;
  required: boolean;
  status: "✅" | "❌" | "⚠️";
  message: string;
}

interface DatabaseCheck {
  name: string;
  status: "✅" | "❌";
  message: string;
}

async function checkEnvironmentVariables(): Promise<EnvCheck[]> {
  const checks: EnvCheck[] = [];

  // P0 - 必需的环境变量
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  // P1 - 推荐的环境变量
  const optionalVars = ["NEXT_PUBLIC_APP_URL", "NODE_ENV"];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    checks.push({
      name: varName,
      value: value ? `${value.substring(0, 20)}...` : undefined,
      required: true,
      status: value ? "✅" : "❌",
      message: value ? "Present" : "MISSING - Required for core functionality",
    });
  }

  for (const varName of optionalVars) {
    const value = process.env[varName];
    checks.push({
      name: varName,
      value: value,
      required: false,
      status: value ? "✅" : "⚠️",
      message: value ? "Present" : "Not set (using default)",
    });
  }

  return checks;
}

async function checkDatabaseConnectivity(): Promise<DatabaseCheck[]> {
  const checks: DatabaseCheck[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    checks.push({
      name: "Supabase Connection",
      status: "❌",
      message: "Cannot test - missing credentials",
    });
    return checks;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    checks.push({
      name: "Supabase Connection",
      status: connectionError ? "❌" : "✅",
      message: connectionError ? `Failed: ${connectionError.message}` : "Connected successfully",
    });

    // Check critical tables
    const criticalTables = [
      "wallet_accounts",
      "transactions",
      "purchases",
      "notifications",
      "posts",
      "profiles",
    ];

    for (const tableName of criticalTables) {
      try {
        const { error } = await supabase.from(tableName).select("id").limit(1);

        checks.push({
          name: `Table: ${tableName}`,
          status: error ? "❌" : "✅",
          message: error ? `Error: ${error.message}` : "Accessible",
        });
      } catch (err) {
        checks.push({
          name: `Table: ${tableName}`,
          status: "❌",
          message: `Exception: ${err}`,
        });
      }
    }

    // Check RPC functions
    const rpcFunctions = ["rpc_purchase_post", "rpc_get_wallet_balance"];

    for (const funcName of rpcFunctions) {
      try {
        // Try to call with invalid params to check if function exists
        const { error } = await supabase.rpc(funcName, {
          p_user_id: "00000000-0000-0000-0000-000000000000",
        });

        // If we get a specific error (not "function not found"), the function exists
        const exists = !error || !error.message.includes("not found");

        checks.push({
          name: `RPC: ${funcName}`,
          status: exists ? "✅" : "❌",
          message: exists ? "Function exists" : "Function not found",
        });
      } catch (err) {
        checks.push({
          name: `RPC: ${funcName}`,
          status: "❌",
          message: `Exception: ${err}`,
        });
      }
    }
  } catch (err) {
    checks.push({
      name: "Database Tests",
      status: "❌",
      message: `Fatal error: ${err}`,
    });
  }

  return checks;
}

async function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("ENV DOCTOR REPORT");
  console.log("=".repeat(60) + "\n");

  // Environment Variables Check
  console.log("ENVIRONMENT VARIABLES");
  console.log("-".repeat(60));

  const envChecks = await checkEnvironmentVariables();
  let hasP0Failures = false;

  for (const check of envChecks) {
    const maskedValue = check.value
      ? check.value.length > 30
        ? `${check.value.substring(0, 30)}...`
        : check.value
      : "NOT SET";

    console.log(`${check.status} ${check.name}: ${maskedValue}`);
    console.log(`   ${check.message}`);

    if (check.required && check.status === "❌") {
      hasP0Failures = true;
    }
  }

  console.log("\n" + "DATABASE CONNECTIVITY");
  console.log("-".repeat(60));

  const dbChecks = await checkDatabaseConnectivity();
  let hasDbFailures = false;

  for (const check of dbChecks) {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.message}`);

    if (check.status === "❌") {
      hasDbFailures = true;
    }
  }

  // Final Verdict
  console.log("\n" + "=".repeat(60));
  console.log("VERDICT");
  console.log("=".repeat(60));

  if (hasP0Failures) {
    console.log("❌ CRITICAL: Missing required environment variables!");
    console.log("   Cannot proceed with testing. Please fix P0 issues.");
    process.exit(1);
  } else if (hasDbFailures) {
    console.log("⚠️  WARNING: Database connectivity issues detected.");
    console.log("   Some tests may fail. Review database checks above.");
    process.exit(1);
  } else {
    console.log("✅ All critical checks passed. Ready for testing.");
    console.log("\n");
  }

  // Write report to file
  const reportPath = path.join(process.cwd(), "ENV_DOCTOR_REPORT.md");
  let reportContent = `# ENV Doctor Report\n\n`;
  reportContent += `**Generated**: ${new Date().toISOString()}\n\n`;

  reportContent += `## Environment Variables\n\n`;
  for (const check of envChecks) {
    reportContent += `- ${check.status} **${check.name}**: ${check.message}\n`;
  }

  reportContent += `\n## Database Connectivity\n\n`;
  for (const check of dbChecks) {
    reportContent += `- ${check.status} **${check.name}**: ${check.message}\n`;
  }

  reportContent += `\n## Verdict\n\n`;
  if (hasP0Failures) {
    reportContent += `❌ **CRITICAL**: Missing required environment variables. Cannot proceed.\n`;
  } else if (hasDbFailures) {
    reportContent += `⚠️ **WARNING**: Database connectivity issues detected.\n`;
  } else {
    reportContent += `✅ **PASSED**: All critical checks passed. Ready for testing.\n`;
  }

  fs.writeFileSync(reportPath, reportContent);
  console.log(`Report saved to: ${reportPath}\n`);
}

// Main execution
generateReport().catch((err) => {
  console.error("Fatal error running ENV Doctor:", err);
  process.exit(1);
});
