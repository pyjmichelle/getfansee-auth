#!/usr/bin/env tsx
/**
 * Data Integrity Check - 前后端数据一致性验证
 * 确保前端显示的数据与数据库中的数据完全一致
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface IntegrityCheck {
  name: string;
  status: "✅" | "❌" | "⚠️";
  details: string;
  data?: any;
}

async function checkWalletBalanceIntegrity(): Promise<IntegrityCheck[]> {
  const checks: IntegrityCheck[] = [];

  try {
    // 获取所有钱包账户
    const { data: wallets, error } = await supabase.from("wallet_accounts").select("*").limit(10);

    if (error) {
      checks.push({
        name: "Wallet Accounts Query",
        status: "❌",
        details: `Failed to query wallet_accounts: ${error.message}`,
      });
      return checks;
    }

    checks.push({
      name: "Wallet Accounts Query",
      status: "✅",
      details: `Found ${wallets?.length || 0} wallet accounts`,
    });

    // 验证每个钱包的余额一致性
    for (const wallet of wallets || []) {
      // 计算该用户所有交易的总和
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("amount_cents, status")
        .eq("user_id", wallet.user_id)
        .eq("status", "completed");

      if (txError) {
        checks.push({
          name: `Wallet ${wallet.user_id.substring(0, 8)}... Balance`,
          status: "❌",
          details: `Failed to query transactions: ${txError.message}`,
        });
        continue;
      }

      const calculatedBalance = (transactions || []).reduce((sum, tx) => sum + tx.amount_cents, 0);

      const dbBalance = wallet.available_balance_cents;
      const isConsistent = calculatedBalance === dbBalance;

      checks.push({
        name: `Wallet ${wallet.user_id.substring(0, 8)}... Balance`,
        status: isConsistent ? "✅" : "❌",
        details: isConsistent
          ? `Consistent: $${(dbBalance / 100).toFixed(2)}`
          : `Mismatch: DB=$${(dbBalance / 100).toFixed(2)}, Calculated=$${(calculatedBalance / 100).toFixed(2)}`,
        data: {
          user_id: wallet.user_id,
          db_balance: dbBalance,
          calculated_balance: calculatedBalance,
          transaction_count: transactions?.length || 0,
        },
      });
    }
  } catch (err) {
    checks.push({
      name: "Wallet Balance Integrity",
      status: "❌",
      details: `Exception: ${err}`,
    });
  }

  return checks;
}

async function checkPurchaseRecordIntegrity(): Promise<IntegrityCheck[]> {
  const checks: IntegrityCheck[] = [];

  try {
    // 获取所有购买记录
    const { data: purchases, error } = await supabase.from("purchases").select("*").limit(20);

    if (error) {
      checks.push({
        name: "Purchases Query",
        status: "❌",
        details: `Failed to query purchases: ${error.message}`,
      });
      return checks;
    }

    checks.push({
      name: "Purchases Query",
      status: "✅",
      details: `Found ${purchases?.length || 0} purchase records`,
    });

    // 验证每条购买记录是否有对应的交易记录
    let matchedCount = 0;
    let mismatchedCount = 0;

    for (const purchase of purchases || []) {
      // 查找对应的交易记录
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", purchase.fan_id)
        .eq("type", "ppv_purchase")
        .contains("metadata", { post_id: purchase.post_id });

      if (txError) {
        checks.push({
          name: `Purchase ${purchase.id.substring(0, 8)}... Transaction`,
          status: "❌",
          details: `Failed to query transactions: ${txError.message}`,
        });
        mismatchedCount++;
        continue;
      }

      const hasTransaction = (transactions?.length || 0) > 0;

      if (hasTransaction) {
        matchedCount++;
      } else {
        mismatchedCount++;
        checks.push({
          name: `Purchase ${purchase.id.substring(0, 8)}... Transaction`,
          status: "❌",
          details: `No matching transaction found for purchase`,
          data: {
            purchase_id: purchase.id,
            fan_id: purchase.fan_id,
            post_id: purchase.post_id,
          },
        });
      }
    }

    checks.push({
      name: "Purchase-Transaction Matching",
      status: mismatchedCount === 0 ? "✅" : "⚠️",
      details: `Matched: ${matchedCount}, Mismatched: ${mismatchedCount}`,
    });
  } catch (err) {
    checks.push({
      name: "Purchase Record Integrity",
      status: "❌",
      details: `Exception: ${err}`,
    });
  }

  return checks;
}

async function checkCreatorEarningsIntegrity(): Promise<IntegrityCheck[]> {
  const checks: IntegrityCheck[] = [];

  try {
    // 获取所有 Creator
    const { data: creators, error } = await supabase
      .from("profiles")
      .select("id, username, role")
      .eq("role", "creator")
      .limit(10);

    if (error) {
      checks.push({
        name: "Creators Query",
        status: "❌",
        details: `Failed to query creators: ${error.message}`,
      });
      return checks;
    }

    checks.push({
      name: "Creators Query",
      status: "✅",
      details: `Found ${creators?.length || 0} creators`,
    });

    // 验证每个 Creator 的收益
    for (const creator of creators || []) {
      // 从 purchases 表计算总收益
      const { data: purchases, error: purchaseError } = await supabase
        .from("purchases")
        .select("paid_amount_cents, post_id")
        .in("post_id", supabase.from("posts").select("id").eq("creator_id", creator.id));

      if (purchaseError) {
        checks.push({
          name: `Creator ${creator.username} Earnings (Purchases)`,
          status: "❌",
          details: `Failed to query purchases: ${purchaseError.message}`,
        });
        continue;
      }

      const purchasesTotal = (purchases || []).reduce(
        (sum, p) => sum + (p.paid_amount_cents || 0),
        0
      );

      // 从 transactions 表计算总收益
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("amount_cents, metadata")
        .eq("type", "ppv_purchase")
        .eq("status", "completed")
        .contains("metadata", { creator_id: creator.id });

      if (txError) {
        checks.push({
          name: `Creator ${creator.username} Earnings (Transactions)`,
          status: "❌",
          details: `Failed to query transactions: ${txError.message}`,
        });
        continue;
      }

      const transactionsTotal = Math.abs(
        (transactions || []).reduce((sum, tx) => sum + tx.amount_cents, 0)
      );

      const isConsistent = purchasesTotal === transactionsTotal;

      checks.push({
        name: `Creator ${creator.username} Earnings`,
        status: isConsistent ? "✅" : "⚠️",
        details: isConsistent
          ? `Consistent: $${(purchasesTotal / 100).toFixed(2)}`
          : `Mismatch: Purchases=$${(purchasesTotal / 100).toFixed(2)}, Transactions=$${(transactionsTotal / 100).toFixed(2)}`,
        data: {
          creator_id: creator.id,
          purchases_total: purchasesTotal,
          transactions_total: transactionsTotal,
          purchase_count: purchases?.length || 0,
          transaction_count: transactions?.length || 0,
        },
      });
    }
  } catch (err) {
    checks.push({
      name: "Creator Earnings Integrity",
      status: "❌",
      details: `Exception: ${err}`,
    });
  }

  return checks;
}

async function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("DATA INTEGRITY REPORT");
  console.log("=".repeat(60) + "\n");

  // Wallet Balance Checks
  console.log("WALLET BALANCE INTEGRITY");
  console.log("-".repeat(60));
  const walletChecks = await checkWalletBalanceIntegrity();
  for (const check of walletChecks) {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.details}`);
  }

  // Purchase Record Checks
  console.log("\n" + "PURCHASE RECORD INTEGRITY");
  console.log("-".repeat(60));
  const purchaseChecks = await checkPurchaseRecordIntegrity();
  for (const check of purchaseChecks) {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.details}`);
  }

  // Creator Earnings Checks
  console.log("\n" + "CREATOR EARNINGS INTEGRITY");
  console.log("-".repeat(60));
  const earningsChecks = await checkCreatorEarningsIntegrity();
  for (const check of earningsChecks) {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.details}`);
  }

  // Summary
  const allChecks = [...walletChecks, ...purchaseChecks, ...earningsChecks];
  const passedCount = allChecks.filter((c) => c.status === "✅").length;
  const failedCount = allChecks.filter((c) => c.status === "❌").length;
  const warningCount = allChecks.filter((c) => c.status === "⚠️").length;

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passedCount}`);
  console.log(`⚠️  Warnings: ${warningCount}`);
  console.log(`❌ Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log("\n❌ Data integrity issues detected!");
  } else if (warningCount > 0) {
    console.log("\n⚠️  Minor data inconsistencies found.");
  } else {
    console.log("\n✅ All data integrity checks passed!");
  }

  // Write report to file
  const fs = require("fs");
  const path = require("path");
  const reportPath = path.join(process.cwd(), "DATA_INTEGRITY_REPORT.md");

  let reportContent = `# Data Integrity Report\n\n`;
  reportContent += `**Generated**: ${new Date().toISOString()}\n\n`;

  reportContent += `## Summary\n\n`;
  reportContent += `- ✅ Passed: ${passedCount}\n`;
  reportContent += `- ⚠️ Warnings: ${warningCount}\n`;
  reportContent += `- ❌ Failed: ${failedCount}\n\n`;

  reportContent += `## Wallet Balance Integrity\n\n`;
  for (const check of walletChecks) {
    reportContent += `- ${check.status} **${check.name}**: ${check.details}\n`;
  }

  reportContent += `\n## Purchase Record Integrity\n\n`;
  for (const check of purchaseChecks) {
    reportContent += `- ${check.status} **${check.name}**: ${check.details}\n`;
  }

  reportContent += `\n## Creator Earnings Integrity\n\n`;
  for (const check of earningsChecks) {
    reportContent += `- ${check.status} **${check.name}**: ${check.details}\n`;
  }

  fs.writeFileSync(reportPath, reportContent);
  console.log(`\nReport saved to: ${reportPath}\n`);
}

// Main execution
generateReport().catch((err) => {
  console.error("Fatal error running data integrity check:", err);
  process.exit(1);
});
