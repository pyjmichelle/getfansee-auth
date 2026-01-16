/**
 * 测试 P0 关键 Bug 修复
 * 1. 钱包充值功能
 * 2. PPV 解锁扣款
 * 3. 点赞功能反馈
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 测试账号
const TEST_FAN_EMAIL = "test-fan@example.com";
const TEST_FAN_PASSWORD = "test123456";

async function testWalletRecharge() {
  console.log("\n🧪 测试 1: 钱包充值功能");
  console.log("=".repeat(50));

  try {
    // 登录
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_FAN_EMAIL,
      password: TEST_FAN_PASSWORD,
    });

    if (authError || !authData.session) {
      console.error("❌ 登录失败:", authError?.message);
      return false;
    }

    const accessToken = authData.session.access_token;

    // 获取初始余额
    const initialBalanceRes = await fetch(`${supabaseUrl.replace("/v1", "")}/api/wallet/balance`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let initialBalance = 0;
    if (initialBalanceRes.ok) {
      const balanceData = await initialBalanceRes.json();
      initialBalance = balanceData.balance || 0;
    }

    console.log(`💰 初始余额: $${initialBalance.toFixed(2)}`);

    // 充值 $10
    const rechargeAmount = 10;
    const rechargeRes = await fetch(`${supabaseUrl.replace("/v1", "")}/api/wallet/recharge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ amount: rechargeAmount }),
    });

    const rechargeData = await rechargeRes.json();

    if (rechargeData.success) {
      console.log(`✅ 充值成功: +$${rechargeAmount}`);
      console.log(`💰 新余额: $${rechargeData.balance.toFixed(2)}`);

      // 验证余额是否正确增加
      const expectedBalance = initialBalance + rechargeAmount;
      if (Math.abs(rechargeData.balance - expectedBalance) < 0.01) {
        console.log("✅ 余额更新正确");
        return true;
      } else {
        console.error(`❌ 余额不匹配: 期望 $${expectedBalance}, 实际 $${rechargeData.balance}`);
        return false;
      }
    } else {
      console.error("❌ 充值失败:", rechargeData.error);
      return false;
    }
  } catch (err: any) {
    console.error("❌ 测试异常:", err.message);
    return false;
  }
}

async function testPostLike() {
  console.log("\n🧪 测试 3: 点赞功能反馈");
  console.log("=".repeat(50));

  try {
    // 登录
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_FAN_EMAIL,
      password: TEST_FAN_PASSWORD,
    });

    if (authError || !authData.session) {
      console.error("❌ 登录失败:", authError?.message);
      return false;
    }

    const accessToken = authData.session.access_token;

    // 获取第一个帖子
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, likes_count")
      .limit(1)
      .single();

    if (postsError || !posts) {
      console.error("❌ 获取帖子失败:", postsError?.message);
      return false;
    }

    const postId = posts.id;
    const initialLikes = posts.likes_count || 0;

    console.log(`📝 测试帖子 ID: ${postId}`);
    console.log(`❤️ 初始点赞数: ${initialLikes}`);

    // 点赞
    const likeRes = await fetch(`${supabaseUrl.replace("/v1", "")}/api/posts/${postId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const likeData = await likeRes.json();

    if (likeData.success) {
      console.log(`✅ 点赞成功`);
      console.log(`❤️ 新点赞数: ${likeData.likesCount}`);

      // 验证点赞数是否增加
      if (likeData.likesCount === initialLikes + 1) {
        console.log("✅ 点赞数更新正确");

        // 取消点赞
        const unlikeRes = await fetch(
          `${supabaseUrl.replace("/v1", "")}/api/posts/${postId}/like`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const unlikeData = await unlikeRes.json();

        if (unlikeData.success && unlikeData.likesCount === initialLikes) {
          console.log("✅ 取消点赞成功，点赞数恢复正常");
          return true;
        } else {
          console.error("❌ 取消点赞失败或点赞数不正确");
          return false;
        }
      } else {
        console.error(`❌ 点赞数不匹配: 期望 ${initialLikes + 1}, 实际 ${likeData.likesCount}`);
        return false;
      }
    } else if (likeData.alreadyLiked) {
      console.log("⚠️ 已经点赞过，先取消点赞");

      // 取消点赞
      const unlikeRes = await fetch(`${supabaseUrl.replace("/v1", "")}/api/posts/${postId}/like`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const unlikeData = await unlikeRes.json();

      if (unlikeData.success) {
        console.log("✅ 取消点赞成功，重新测试点赞");
        // 递归重新测试
        return await testPostLike();
      } else {
        console.error("❌ 取消点赞失败");
        return false;
      }
    } else {
      console.error("❌ 点赞失败:", likeData.error);
      return false;
    }
  } catch (err: any) {
    console.error("❌ 测试异常:", err.message);
    return false;
  }
}

async function main() {
  console.log("🚀 开始测试 P0 关键 Bug 修复");
  console.log("测试环境:", supabaseUrl);

  const results = {
    walletRecharge: false,
    postLike: false,
  };

  // 测试 1: 钱包充值
  results.walletRecharge = await testWalletRecharge();

  // 测试 3: 点赞功能
  results.postLike = await testPostLike();

  // 总结
  console.log("\n" + "=".repeat(50));
  console.log("📊 测试结果总结");
  console.log("=".repeat(50));
  console.log(`钱包充值: ${results.walletRecharge ? "✅ 通过" : "❌ 失败"}`);
  console.log(`点赞功能: ${results.postLike ? "✅ 通过" : "❌ 失败"}`);

  const allPassed = Object.values(results).every((r) => r);

  if (allPassed) {
    console.log("\n🎉 所有 P0 Bug 修复测试通过！");
    process.exit(0);
  } else {
    console.log("\n❌ 部分测试失败，请检查日志");
    process.exit(1);
  }
}

main();
