/**
 * 金融审计 Cron Job
 * 定期检查金融系统健康状况，检测异常并发送告警
 *
 * 检测项目：
 * 1. 负余额账户
 * 2. 失败交易激增
 * 3. 卡住的 pending 交易
 * 4. 钱包余额与交易记录不一致
 *
 * 配置：
 * - CRON_SECRET: 用于验证 cron 请求的密钥
 * - ALERT_SLACK_WEBHOOK: Slack webhook URL（可选）
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

interface AuditResult {
  check: string;
  status: "ok" | "warning" | "critical";
  count?: number;
  details?: unknown;
}

interface AuditReport {
  timestamp: string;
  results: AuditResult[];
  overallStatus: "ok" | "warning" | "critical";
}

/**
 * 发送告警到 Slack（如果配置了 webhook）
 */
async function sendSlackAlert(report: AuditReport): Promise<void> {
  const webhookUrl = process.env.ALERT_SLACK_WEBHOOK;
  if (!webhookUrl) {
    return;
  }

  const criticalResults = report.results.filter((r) => r.status === "critical");
  const warningResults = report.results.filter((r) => r.status === "warning");

  if (criticalResults.length === 0 && warningResults.length === 0) {
    return;
  }

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 Financial Audit Alert - ${report.overallStatus.toUpperCase()}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Timestamp:* ${report.timestamp}`,
      },
    },
  ];

  // 添加 critical 问题
  for (const result of criticalResults) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔴 *CRITICAL:* ${result.check}\n${result.count ? `Count: ${result.count}` : ""}\n${
          result.details ? `Details: ${JSON.stringify(result.details)}` : ""
        }`,
      },
    });
  }

  // 添加 warning 问题
  for (const result of warningResults) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🟡 *WARNING:* ${result.check}\n${result.count ? `Count: ${result.count}` : ""}\n${
          result.details ? `Details: ${JSON.stringify(result.details)}` : ""
        }`,
      },
    });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
  } catch (err) {
    logger.error("Failed to send Slack alert", err, { check: "slack_webhook" });
  }
}

/**
 * 检查负余额账户
 */
async function checkNegativeBalances(
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<AuditResult> {
  const { data, error } = await supabase
    .from("wallet_accounts")
    .select("user_id, available_balance_cents")
    .lt("available_balance_cents", 0);

  if (error) {
    return {
      check: "Negative Balances",
      status: "warning",
      details: { error: error.message },
    };
  }

  if (data && data.length > 0) {
    return {
      check: "Negative Balances",
      status: "critical",
      count: data.length,
      details: { affected_users: data.map((d) => d.user_id) },
    };
  }

  return { check: "Negative Balances", status: "ok" };
}

/**
 * 检查最近一小时内的失败交易数量
 */
async function checkFailedTransactions(
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<AuditResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", oneHourAgo);

  if (error) {
    return {
      check: "Failed Transactions (1h)",
      status: "warning",
      details: { error: error.message },
    };
  }

  // 阈值：超过 10 笔失败交易为 warning，超过 50 笔为 critical
  if (count && count > 50) {
    return {
      check: "Failed Transactions (1h)",
      status: "critical",
      count,
    };
  }

  if (count && count > 10) {
    return {
      check: "Failed Transactions (1h)",
      status: "warning",
      count,
    };
  }

  return { check: "Failed Transactions (1h)", status: "ok", count: count || 0 };
}

/**
 * 检查卡住的 pending 交易（超过 24 小时）
 */
async function checkStuckPendingTransactions(
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<AuditResult> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("transactions")
    .select("id, user_id, type, created_at")
    .eq("status", "pending")
    .lt("created_at", twentyFourHoursAgo)
    .limit(100);

  if (error) {
    return {
      check: "Stuck Pending Transactions",
      status: "warning",
      details: { error: error.message },
    };
  }

  if (data && data.length > 0) {
    return {
      check: "Stuck Pending Transactions",
      status: "critical",
      count: data.length,
      details: { sample_transactions: data.slice(0, 5) },
    };
  }

  return { check: "Stuck Pending Transactions", status: "ok" };
}

/**
 * 检查钱包余额与交易记录是否一致（抽样检查）
 */
async function checkBalanceConsistency(
  supabase: ReturnType<typeof getSupabaseAdminClient>
): Promise<AuditResult> {
  // 抽样检查最近有交易的 10 个用户
  const { data: recentUsers, error: userError } = await supabase
    .from("transactions")
    .select("user_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (userError || !recentUsers) {
    return {
      check: "Balance Consistency",
      status: "warning",
      details: { error: userError?.message || "No recent transactions" },
    };
  }

  // 去重并取前 10 个
  const uniqueUserIds = [...new Set(recentUsers.map((r) => r.user_id))].slice(0, 10);
  const inconsistentUsers: string[] = [];

  for (const userId of uniqueUserIds) {
    // 获取钱包余额
    const { data: wallet } = await supabase
      .from("wallet_accounts")
      .select("available_balance_cents")
      .eq("user_id", userId)
      .single();

    if (!wallet) continue;

    // 计算交易记录总和
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount_cents")
      .eq("user_id", userId)
      .eq("status", "completed");

    if (!transactions) continue;

    const calculatedBalance = transactions.reduce((sum, t) => sum + (t.amount_cents || 0), 0);

    // 允许 1 美分的误差
    if (Math.abs(wallet.available_balance_cents - calculatedBalance) > 1) {
      inconsistentUsers.push(userId);
    }
  }

  if (inconsistentUsers.length > 0) {
    return {
      check: "Balance Consistency",
      status: "critical",
      count: inconsistentUsers.length,
      details: { inconsistent_users: inconsistentUsers },
    };
  }

  return { check: "Balance Consistency", status: "ok" };
}

export async function GET(request: NextRequest) {
  // 验证 cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 在生产环境强制验证 secret
  if (process.env.NODE_ENV === "production" && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn("Unauthorized cron request", { endpoint: "/api/cron/financial-audit" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  logger.info("Starting financial audit", { endpoint: "/api/cron/financial-audit" });

  const supabase = getSupabaseAdminClient();
  const results: AuditResult[] = [];

  // 执行所有检查
  results.push(await checkNegativeBalances(supabase));
  results.push(await checkFailedTransactions(supabase));
  results.push(await checkStuckPendingTransactions(supabase));
  results.push(await checkBalanceConsistency(supabase));

  // 确定整体状态
  let overallStatus: "ok" | "warning" | "critical" = "ok";
  if (results.some((r) => r.status === "critical")) {
    overallStatus = "critical";
  } else if (results.some((r) => r.status === "warning")) {
    overallStatus = "warning";
  }

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    results,
    overallStatus,
  };

  // 记录审计日志
  logger.info("Financial audit completed", {
    endpoint: "/api/cron/financial-audit",
    overallStatus,
    results: results.map((r) => ({ check: r.check, status: r.status, count: r.count })),
  });

  // 如果有问题，发送 Slack 告警
  if (overallStatus !== "ok") {
    await sendSlackAlert(report);
  }

  return NextResponse.json(report);
}
