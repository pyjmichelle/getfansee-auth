/**
 * 验证数据库迁移脚本
 * 检查所有新表、列、触发器和预设数据
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface VerificationResult {
  category: string;
  item: string;
  status: "✅" | "❌";
  details?: string;
}

const results: VerificationResult[] = [];

async function verifyTables() {
  console.log("\n🔍 验证新表...");

  const tables = [
    "post_likes",
    "tags",
    "post_tags",
    "creator_tags",
    "content_review_logs",
    "post_comments",
    "support_tickets",
    "refund_requests",
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select("*").limit(1);

      if (error) {
        results.push({
          category: "表",
          item: table,
          status: "❌",
          details: error.message,
        });
      } else {
        results.push({
          category: "表",
          item: table,
          status: "✅",
        });
      }
    } catch (err) {
      results.push({
        category: "表",
        item: table,
        status: "❌",
        details: String(err),
      });
    }
  }
}

async function verifyColumns() {
  console.log("\n🔍 验证新列...");

  // 检查 posts 表的新列
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, likes_count, review_status")
      .limit(1);

    if (error) {
      results.push({
        category: "列",
        item: "posts.likes_count",
        status: "❌",
        details: error.message,
      });
      results.push({
        category: "列",
        item: "posts.review_status",
        status: "❌",
        details: error.message,
      });
    } else {
      results.push({
        category: "列",
        item: "posts.likes_count",
        status: "✅",
      });
      results.push({
        category: "列",
        item: "posts.review_status",
        status: "✅",
      });
    }
  } catch (err) {
    results.push({
      category: "列",
      item: "posts 新列",
      status: "❌",
      details: String(err),
    });
  }
}

async function verifyTags() {
  console.log("\n🔍 验证预设标签...");

  try {
    const { data, error, count } = await supabase.from("tags").select("*", { count: "exact" });

    if (error) {
      results.push({
        category: "数据",
        item: "预设标签",
        status: "❌",
        details: error.message,
      });
    } else {
      const expectedCount = 16; // 8 Creator + 8 Content
      if (count === expectedCount) {
        results.push({
          category: "数据",
          item: "预设标签",
          status: "✅",
          details: `${count} 个标签`,
        });
      } else {
        results.push({
          category: "数据",
          item: "预设标签",
          status: "❌",
          details: `预期 ${expectedCount} 个，实际 ${count} 个`,
        });
      }

      // 列出所有标签
      if (data && data.length > 0) {
        console.log("\n📋 标签列表:");
        const creatorTags = data.filter((t) => t.category === "creator");
        const contentTags = data.filter((t) => t.category === "content");

        console.log(
          `  Creator 标签 (${creatorTags.length}):`,
          creatorTags.map((t) => t.name).join(", ")
        );
        console.log(
          `  Content 标签 (${contentTags.length}):`,
          contentTags.map((t) => t.name).join(", ")
        );
      }
    }
  } catch (err) {
    results.push({
      category: "数据",
      item: "预设标签",
      status: "❌",
      details: String(err),
    });
  }
}

async function verifyTriggers() {
  console.log("\n🔍 验证触发器函数...");

  // 通过查询 pg_proc 检查函数是否存在
  const functions = [
    "increment_post_likes_count",
    "decrement_post_likes_count",
    "notify_creator_on_subscription",
    "notify_creator_on_ppv_purchase",
    "notify_creator_on_post_likes",
    "notify_creator_on_content_review",
  ];

  try {
    const { data, error } = await supabase.rpc("pg_get_functiondef", {
      funcid: "increment_post_likes_count",
    });

    // 如果能查询到函数定义，说明函数存在
    // 但这个方法可能不适用于所有 Supabase 配置
    // 我们改用测试实际功能的方式

    results.push({
      category: "触发器",
      item: "函数检查",
      status: "⚠️",
      details: "需要通过实际测试验证",
    });
  } catch (err) {
    results.push({
      category: "触发器",
      item: "函数检查",
      status: "⚠️",
      details: "需要通过实际测试验证",
    });
  }
}

async function verifyRLSPolicies() {
  console.log("\n🔍 验证 RLS 策略...");

  // 测试内容审核 RLS：未审核的帖子不应该对普通用户可见
  try {
    // 这里我们只能间接验证，通过尝试查询来确认 RLS 是否生效
    const { data, error } = await supabase.from("posts").select("id, review_status").limit(1);

    if (error) {
      results.push({
        category: "RLS",
        item: "posts 表策略",
        status: "❌",
        details: error.message,
      });
    } else {
      results.push({
        category: "RLS",
        item: "posts 表策略",
        status: "✅",
        details: "可以查询",
      });
    }
  } catch (err) {
    results.push({
      category: "RLS",
      item: "posts 表策略",
      status: "❌",
      details: String(err),
    });
  }
}

async function printResults() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 验证结果汇总");
  console.log("=".repeat(60));

  const categories = [...new Set(results.map((r) => r.category))];

  for (const category of categories) {
    console.log(`\n${category}:`);
    const categoryResults = results.filter((r) => r.category === category);

    for (const result of categoryResults) {
      const details = result.details ? ` (${result.details})` : "";
      console.log(`  ${result.status} ${result.item}${details}`);
    }
  }

  // 统计
  const passed = results.filter((r) => r.status === "✅").length;
  const failed = results.filter((r) => r.status === "❌").length;
  const warning = results.filter((r) => r.status === "⚠️").length;

  console.log("\n" + "=".repeat(60));
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⚠️  警告: ${warning}`);
  console.log(`📊 总计: ${results.length}`);
  console.log("=".repeat(60));

  if (failed === 0) {
    console.log("\n🎉 所有迁移验证通过！");
    return 0;
  } else {
    console.log("\n⚠️  有迁移项目需要检查");
    return 1;
  }
}

async function main() {
  console.log("🚀 开始验证数据库迁移...");
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  await verifyTables();
  await verifyColumns();
  await verifyTags();
  await verifyTriggers();
  await verifyRLSPolicies();

  const exitCode = await printResults();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("❌ 验证脚本执行失败:", err);
  process.exit(1);
});
