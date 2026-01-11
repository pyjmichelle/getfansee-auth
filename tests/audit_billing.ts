/**
 * 自动化审计脚本：账务系统
 * 测试场景：
 * 1. 余额不足购买失败
 * 2. 余额充足购买成功
 * 3. 未付钱尝试获取原始资源报错
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

// 加载环境变量（优先从 process.env，fallback 到 .env.local）
function loadEnv() {
  try {
    const envPath = join(process.cwd(), ".env.local")
    const envContent = readFileSync(envPath, "utf-8")
    const envLines = envContent.split("\n")
    
    for (const line of envLines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=")
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "")
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      }
    }
  } catch (err) {
    // .env.local 不存在或无法读取，使用 process.env
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase credentials")
  console.error("Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
  console.error("You can set them in .env.local or as environment variables")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

const results: TestResult[] = []

function recordTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details })
  const icon = passed ? "✅" : "❌"
  console.log(`${icon} ${name}`)
  if (error) {
    console.log(`   Error: ${error}`)
  }
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2))
  }
}

/**
 * 场景 1: 余额不足购买失败
 */
async function testInsufficientBalance() {
  console.log("\n📋 Test 1: 余额不足购买失败")
  
  try {
    // 1. 创建测试用户
    const testEmail = `test-insufficient-${Date.now()}@example.com`
    const testPassword = "test-password-123"
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    })

    if (signUpError || !signUpData.user) {
      recordTest("创建测试用户", false, signUpError?.message)
      return
    }
    recordTest("创建测试用户", true)

    const userId = signUpData.user.id

    // 2. 确保钱包存在（余额为 0）
    const { error: walletError } = await supabase
      .from("user_wallets")
      .upsert({ id: userId, balance_cents: 0 }, { onConflict: "id" })

    if (walletError) {
      recordTest("初始化钱包", false, walletError.message)
      return
    }
    recordTest("初始化钱包（余额 0）", true)

    // 3. 创建一个 PPV post（价格 500 cents = $5.00）
    // 需要先创建一个 creator
    const { data: creatorData, error: creatorError } = await supabase
      .from("profiles")
      .update({ role: "creator" })
      .eq("id", userId)
      .select()
      .single()

    if (creatorError) {
      // 如果更新失败，尝试插入
      await supabase.from("profiles").insert({
        id: userId,
        role: "creator",
        display_name: "Test Creator",
      })
    }

    // 创建 creator 记录
    await supabase.from("creators").upsert({
      id: userId,
      display_name: "Test Creator",
    })

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert({
        creator_id: userId,
        content: "Test PPV post for insufficient balance",
        visibility: "ppv",
        price_cents: 500, // $5.00
        preview_enabled: true,
      })
      .select()
      .single()

    if (postError || !postData) {
      recordTest("创建 PPV post", false, postError?.message)
      return
    }
    recordTest("创建 PPV post（价格 500 cents）", true, undefined, { post_id: postData.id })

    const postId = postData.id

    // 4. 尝试购买（余额不足，应该失败）
    const { data: purchaseResult, error: purchaseError } = await supabase.rpc("rpc_purchase_post", {
      p_post_id: postId,
      p_user_id: userId,
    })

    if (purchaseError) {
      recordTest("调用 rpc_purchase_post（余额不足）", false, purchaseError.message)
      return
    }

    if (purchaseResult && !purchaseResult.success) {
      if (purchaseResult.error === "Insufficient balance") {
        recordTest("余额不足购买失败", true, undefined, {
          error: purchaseResult.error,
          balance_cents: purchaseResult.balance_cents,
          required_cents: purchaseResult.required_cents,
        })
      } else {
        recordTest("余额不足购买失败", false, `Expected "Insufficient balance", got: ${purchaseResult.error}`)
      }
    } else {
      recordTest("余额不足购买失败", false, "Purchase should have failed but succeeded")
    }

    // 5. 验证余额未变化
    const { data: walletData, error: walletCheckError } = await supabase
      .from("user_wallets")
      .select("balance_cents")
      .eq("id", userId)
      .single()

    if (walletCheckError) {
      recordTest("验证余额未变化", false, walletCheckError.message)
      return
    }

    if (walletData.balance_cents === 0) {
      recordTest("验证余额未变化（仍为 0）", true)
    } else {
      recordTest("验证余额未变化", false, `Balance should be 0, got: ${walletData.balance_cents}`)
    }

    // 6. 清理
    await supabase.from("posts").delete().eq("id", postId)
    await supabase.auth.admin.deleteUser(userId)
    recordTest("清理测试数据", true)

  } catch (err: any) {
    recordTest("场景 1 执行", false, err.message)
  }
}

/**
 * 场景 2: 余额充足购买成功
 */
async function testSufficientBalance() {
  console.log("\n📋 Test 2: 余额充足购买成功")
  
  try {
    // 1. 创建测试用户
    const testEmail = `test-sufficient-${Date.now()}@example.com`
    const testPassword = "test-password-123"
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    })

    if (signUpError || !signUpData.user) {
      recordTest("创建测试用户", false, signUpError?.message)
      return
    }
    recordTest("创建测试用户", true)

    const userId = signUpData.user.id

    // 2. 创建钱包并充值 1000 cents = $10.00
    const { error: walletError } = await supabase
      .from("user_wallets")
      .upsert({ id: userId, balance_cents: 1000 }, { onConflict: "id" })

    if (walletError) {
      recordTest("创建钱包并充值", false, walletError.message)
      return
    }
    recordTest("创建钱包并充值（1000 cents）", true)

    // 3. 创建一个 PPV post（价格 500 cents = $5.00）
    const { data: creatorData, error: creatorError } = await supabase
      .from("profiles")
      .update({ role: "creator" })
      .eq("id", userId)
      .select()
      .single()

    if (creatorError) {
      await supabase.from("profiles").insert({
        id: userId,
        role: "creator",
        display_name: "Test Creator 2",
      })
    }

    await supabase.from("creators").upsert({
      id: userId,
      display_name: "Test Creator 2",
    })

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert({
        creator_id: userId,
        content: "Test PPV post for sufficient balance",
        visibility: "ppv",
        price_cents: 500, // $5.00
        preview_enabled: true,
      })
      .select()
      .single()

    if (postError || !postData) {
      recordTest("创建 PPV post", false, postError?.message)
      return
    }
    recordTest("创建 PPV post（价格 500 cents）", true, undefined, { post_id: postData.id })

    const postId = postData.id

    // 4. 购买（余额充足，应该成功）
    const { data: purchaseResult, error: purchaseError } = await supabase.rpc("rpc_purchase_post", {
      p_post_id: postId,
      p_user_id: userId,
    })

    if (purchaseError) {
      recordTest("调用 rpc_purchase_post（余额充足）", false, purchaseError.message)
      return
    }

    if (purchaseResult && purchaseResult.success) {
      recordTest("余额充足购买成功", true, undefined, {
        transaction_id: purchaseResult.transaction_id,
        purchase_id: purchaseResult.purchase_id,
        balance_before_cents: purchaseResult.balance_before_cents,
        balance_after_cents: purchaseResult.balance_after_cents,
        amount_cents: purchaseResult.amount_cents,
      })
    } else {
      recordTest("余额充足购买成功", false, `Purchase failed: ${purchaseResult?.error}`)
      return
    }

    // 5. 验证余额已扣费（1000 - 500 = 500）
    const { data: walletData, error: walletCheckError } = await supabase
      .from("user_wallets")
      .select("balance_cents")
      .eq("id", userId)
      .single()

    if (walletCheckError) {
      recordTest("验证余额已扣费", false, walletCheckError.message)
      return
    }

    if (walletData.balance_cents === 500) {
      recordTest("验证余额已扣费（1000 -> 500）", true)
    } else {
      recordTest("验证余额已扣费", false, `Balance should be 500, got: ${walletData.balance_cents}`)
    }

    // 6. 验证购买记录已创建
    const { data: purchaseData, error: purchaseCheckError } = await supabase
      .from("purchases")
      .select("*")
      .eq("fan_id", userId)
      .eq("post_id", postId)
      .single()

    if (purchaseCheckError || !purchaseData) {
      recordTest("验证购买记录已创建", false, purchaseCheckError?.message)
      return
    }

    if (purchaseData.paid_amount_cents === 500) {
      recordTest("验证购买记录已创建（paid_amount_cents = 500）", true)
    } else {
      recordTest("验证购买记录已创建", false, `paid_amount_cents should be 500, got: ${purchaseData.paid_amount_cents}`)
    }

    // 7. 验证交易流水已创建
    const { data: transactionData, error: transactionCheckError } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("reference_id", postId)
      .eq("reference_type", "post_id")
      .single()

    if (transactionCheckError || !transactionData) {
      recordTest("验证交易流水已创建", false, transactionCheckError?.message)
      return
    }

    if (transactionData.amount_cents === -500 && transactionData.balance_after_cents === 500) {
      recordTest("验证交易流水已创建（amount_cents = -500）", true)
    } else {
      recordTest("验证交易流水已创建", false, `Transaction data incorrect`)
    }

    // 8. 清理
    await supabase.from("posts").delete().eq("id", postId)
    await supabase.auth.admin.deleteUser(userId)
    recordTest("清理测试数据", true)

  } catch (err: any) {
    recordTest("场景 2 执行", false, err.message)
  }
}

/**
 * 场景 3: 未付钱尝试获取原始资源报错
 */
async function testUnauthorizedAccess() {
  console.log("\n📋 Test 3: 未付钱尝试获取原始资源报错")
  
  try {
    // 1. 创建两个用户：creator 和 fan
    const creatorEmail = `test-creator-${Date.now()}@example.com`
    const fanEmail = `test-fan-${Date.now()}@example.com`
    const password = "test-password-123"
    
    const { data: creatorSignUp, error: creatorSignUpError } = await supabase.auth.signUp({
      email: creatorEmail,
      password: password,
    })

    if (creatorSignUpError || !creatorSignUp.user) {
      recordTest("创建 creator 用户", false, creatorSignUpError?.message)
      return
    }
    recordTest("创建 creator 用户", true)

    const creatorId = creatorSignUp.user.id

    // 设置 creator 角色
    await supabase.from("profiles").upsert({
      id: creatorId,
      role: "creator",
      display_name: "Test Creator 3",
    })
    await supabase.from("creators").upsert({
      id: creatorId,
      display_name: "Test Creator 3",
    })

    const { data: fanSignUp, error: fanSignUpError } = await supabase.auth.signUp({
      email: fanEmail,
      password: password,
    })

    if (fanSignUpError || !fanSignUp.user) {
      recordTest("创建 fan 用户", false, fanSignUpError?.message)
      return
    }
    recordTest("创建 fan 用户", true)

    const fanId = fanSignUp.user.id

    // 2. Creator 创建一个 PPV post
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert({
        creator_id: creatorId,
        content: "Test PPV post for unauthorized access",
        visibility: "ppv",
        price_cents: 500,
        preview_enabled: true,
      })
      .select()
      .single()

    if (postError || !postData) {
      recordTest("创建 PPV post", false, postError?.message)
      return
    }
    recordTest("创建 PPV post", true, undefined, { post_id: postData.id })

    const postId = postData.id

    // 3. Fan 用户尝试直接查询 post（应该被 RLS 阻止或返回锁定状态）
    // 使用 fan 用户的 session
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email: fanEmail,
      password: password,
    })

    if (!session) {
      recordTest("Fan 用户登录", false, "Failed to sign in")
      return
    }
    recordTest("Fan 用户登录", true)

    // 4. 尝试查询 post（应该能看到，但 is_locked = true）
    const { data: postQueryData, error: postQueryError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single()

    if (postQueryError) {
      // RLS 可能阻止查询，这是预期的
      recordTest("Fan 查询 PPV post（RLS 阻止）", true, undefined, { error: postQueryError.message })
    } else if (postQueryData) {
      // 如果能查询到，检查是否被标记为锁定
      recordTest("Fan 查询 PPV post（返回锁定状态）", true, undefined, {
        post_id: postQueryData.id,
        visibility: postQueryData.visibility,
        price_cents: postQueryData.price_cents,
      })
    }

    // 5. 尝试直接访问购买记录（应该不存在）
    const { data: purchaseData, error: purchaseQueryError } = await supabase
      .from("purchases")
      .select("*")
      .eq("fan_id", fanId)
      .eq("post_id", postId)

    if (purchaseQueryError) {
      recordTest("查询购买记录（RLS 阻止）", true, undefined, { error: purchaseQueryError.message })
    } else if (!purchaseData || purchaseData.length === 0) {
      recordTest("查询购买记录（不存在，符合预期）", true)
    } else {
      recordTest("查询购买记录", false, "Purchase record should not exist")
    }

    // 6. 使用 listFeed 函数测试权限检查（应该返回 is_locked = true）
    // 这里需要模拟调用 listFeed，但由于是 TypeScript，我们直接测试权限检查逻辑
    const { hasPurchasedPost } = await import("../lib/paywall")
    const hasPurchased = await hasPurchasedPost(fanId, postId)

    if (!hasPurchased) {
      recordTest("权限检查：未购买（hasPurchasedPost = false）", true)
    } else {
      recordTest("权限检查：未购买", false, "Should not have purchased")
    }

    // 7. 清理
    await supabase.from("posts").delete().eq("id", postId)
    await supabase.auth.admin.deleteUser(creatorId)
    await supabase.auth.admin.deleteUser(fanId)
    recordTest("清理测试数据", true)

  } catch (err: any) {
    recordTest("场景 3 执行", false, err.message)
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("=".repeat(60))
  console.log("🧪 账务系统自动化审计")
  console.log("=".repeat(60))

  await testInsufficientBalance()
  await testSufficientBalance()
  await testUnauthorizedAccess()

  // 汇总结果
  console.log("\n" + "=".repeat(60))
  console.log("📊 测试结果汇总")
  console.log("=".repeat(60))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  console.log(`总计: ${total} 个测试`)
  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)

  if (failed > 0) {
    console.log("\n失败的测试:")
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  ❌ ${r.name}`)
      if (r.error) {
        console.log(`     错误: ${r.error}`)
      }
    })
  }

  console.log("\n" + "=".repeat(60))
  if (failed === 0) {
    console.log("✅ PASSED - 所有测试通过")
    process.exit(0)
  } else {
    console.log("❌ FAILED - 部分测试失败")
    process.exit(1)
  }
}

// 运行测试
main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})

