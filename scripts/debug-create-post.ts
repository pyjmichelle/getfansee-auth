/**
 * 直接调用 createPost 函数进行调试
 * 使用 Service Role Key 绕过 RLS
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("错误: 缺少环境变量");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function debugCreatePost() {
  console.log("=== 调试创建帖子功能 ===\n");

  // 1. 获取 test-creator profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, age_verified")
    .eq("email", "test-creator@example.com")
    .single();

  if (!profile) {
    console.error("❌ 找不到 test-creator profile");
    return;
  }

  console.log("✅ Creator Profile:", profile);

  // 2. 尝试直接插入 post (使用 Service Role Key)
  console.log("\n尝试插入帖子...");

  const postData = {
    creator_id: profile.id,
    title: "Debug Test Post",
    content: "This is a debug test post",
    visibility: "free" as const,
    price_cents: 0,
    is_locked: false,
    preview_enabled: false,
    watermark_enabled: true,
  };

  console.log("Post Data:", postData);

  const { data: post, error } = await supabase
    .from("posts")
    .insert(postData)
    .select("id, creator_id, content, visibility")
    .single();

  if (error) {
    console.error("\n❌ 插入失败:");
    console.error("  Code:", error.code);
    console.error("  Message:", error.message);
    console.error("  Details:", error.details);
    console.error("  Hint:", error.hint);
  } else {
    console.log("\n✅ 插入成功:");
    console.log(JSON.stringify(post, null, 2));

    // 清理测试数据
    await supabase.from("posts").delete().eq("id", post.id);
    console.log("\n(已清理测试数据)");
  }

  // 3. 检查 posts 表结构
  console.log("\n检查 posts 表的列...");
  const { data: columns, error: columnsError } = await supabase.from("posts").select("*").limit(1);

  if (columns && columns[0]) {
    console.log("Posts 表列:", Object.keys(columns[0]).join(", "));
  }
}

debugCreatePost().catch(console.error);
