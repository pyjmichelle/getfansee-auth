import { createClient } from "@supabase/supabase-js";

// 从环境变量读取（运行时通过 source .env.local 加载）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("错误: 缺少环境变量");
  console.error("请先运行: source .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifyTestData() {
  console.log("=== 验证测试账号数据 ===\n");

  // 1. 检查 test-creator@example.com 的 profile
  console.log("1. 检查 test-creator@example.com profile:");
  const { data: creatorProfile, error: creatorError } = await supabase
    .from("profiles")
    .select("id, email, role, display_name, age_verified")
    .eq("email", "test-creator@example.com")
    .single();

  if (creatorError) {
    console.error("❌ 错误:", creatorError.message);
  } else if (creatorProfile) {
    console.log("✅ Profile 存在:");
    console.log(JSON.stringify(creatorProfile, null, 2));
  } else {
    console.log("❌ Profile 不存在");
  }

  // 2. 检查 creators 表
  if (creatorProfile) {
    console.log("\n2. 检查 creators 表记录:");
    const { data: creatorRecord, error: creatorRecordError } = await supabase
      .from("creators")
      .select("id, profile_id, username, status, display_name")
      .eq("profile_id", creatorProfile.id)
      .maybeSingle();

    if (creatorRecordError) {
      console.error("❌ 错误:", creatorRecordError.message);
    } else if (creatorRecord) {
      console.log("✅ Creators 表记录存在:");
      console.log(JSON.stringify(creatorRecord, null, 2));
    } else {
      console.log("⚠️  Creators 表中没有记录");
    }
  }

  // 3. 检查 test-fan@example.com 的 profile
  console.log("\n3. 检查 test-fan@example.com profile:");
  const { data: fanProfile, error: fanError } = await supabase
    .from("profiles")
    .select("id, email, role, display_name")
    .eq("email", "test-fan@example.com")
    .single();

  if (fanError) {
    console.error("❌ 错误:", fanError.message);
  } else if (fanProfile) {
    console.log("✅ Profile 存在:");
    console.log(JSON.stringify(fanProfile, null, 2));
  } else {
    console.log("❌ Profile 不存在");
  }

  // 4. 检查 RLS 策略（从 posts 表 metadata 中推断）
  console.log("\n4. 尝试模拟 Creator 插入 post (检查 RLS):");
  if (creatorProfile && creatorProfile.role === "creator") {
    const testPost = {
      creator_id: creatorProfile.id,
      content: "Test post for RLS verification",
      visibility: "free",
      price_cents: 0,
      is_locked: false,
    };

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert(testPost)
      .select("id")
      .single();

    if (postError) {
      console.error("❌ 插入失败:", postError.message);
      console.error("   Code:", postError.code);
      console.error("   Details:", postError.details);
      console.error("   Hint:", postError.hint);
    } else {
      console.log("✅ 插入成功! Post ID:", postData.id);
      // 删除测试数据
      await supabase.from("posts").delete().eq("id", postData.id);
      console.log("   (已清理测试数据)");
    }
  } else {
    console.log("⚠️  无法测试（Creator profile 不存在或 role 不正确）");
  }

  console.log("\n=== 验证完成 ===");
}

verifyTestData().catch(console.error);
