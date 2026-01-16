/**
 * 测试创建帖子 API
 * 模拟前端调用 /api/posts
 */

async function testCreatePost() {
  const testPost = {
    title: "Test Post from Script",
    content: "This is a test post to verify the create post API",
    visibility: "free",
    priceCents: null,
    previewEnabled: false,
    watermarkEnabled: true,
  };

  console.log("=== 测试创建帖子 API ===\n");
  console.log("请求数据:", JSON.stringify(testPost, null, 2));

  try {
    const response = await fetch("http://localhost:3002/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 注意：这里没有 Cookie，需要在浏览器中登录后测试
      },
      body: JSON.stringify(testPost),
    });

    const result = await response.json();

    console.log("\n响应状态:", response.status);
    console.log("响应数据:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("\n✅ 帖子创建成功! Post ID:", result.postId);
    } else {
      console.log("\n❌ 帖子创建失败:", result.error);
    }
  } catch (err) {
    console.error("\n❌ 请求失败:", err);
  }
}

testCreatePost();
