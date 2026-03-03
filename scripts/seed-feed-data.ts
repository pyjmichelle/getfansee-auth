/**
 * 填充 Feed 假数据脚本
 *
 * 使用方法：
 *   pnpm tsx scripts/seed-feed-data.ts
 *
 * 前置条件：
 *   - 需要 SUPABASE_SERVICE_ROLE_KEY（在 .env.local 中配置）
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// 加载环境变量
function loadEnv() {
  const env: Record<string, string> = {};

  // 优先从 process.env 读取
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  // 从 .env.local 读取
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const envPath = join(process.cwd(), ".env.local");
      const envContent = readFileSync(envPath, "utf-8");

      envContent.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          if (key && valueParts.length > 0) {
            const keyName = key.trim();
            const value = valueParts
              .join("=")
              .trim()
              .replace(/^["']|["']$/g, "");
            if (!env[keyName]) {
              env[keyName] = value;
            }
          }
        }
      });
    } catch (err) {
      // .env.local not found
    }
  }

  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\n请在 .env.local 中配置这些变量");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// 假数据：Creator 信息（使用 ui-avatars.com，更可靠）
const demoCreators = [
  {
    display_name: "Sophia Creative",
    bio: "Digital artist and content creator. Sharing my latest works and exclusive content!",
    avatar_url:
      "https://ui-avatars.com/api/?name=Sophia+Creative&background=6366f1&color=fff&size=150&bold=true",
  },
  {
    display_name: "Alex Photography",
    bio: "Professional photographer. Capturing moments that matter.",
    avatar_url:
      "https://ui-avatars.com/api/?name=Alex+Photography&background=ec4899&color=fff&size=150&bold=true",
  },
  {
    display_name: "Maya Lifestyle",
    bio: "Lifestyle blogger sharing daily inspiration and tips.",
    avatar_url:
      "https://ui-avatars.com/api/?name=Maya+Lifestyle&background=10b981&color=fff&size=150&bold=true",
  },
  {
    display_name: "Jordan Fitness",
    bio: "Fitness coach and wellness advocate. Transform your body and mind.",
    avatar_url:
      "https://ui-avatars.com/api/?name=Jordan+Fitness&background=f59e0b&color=fff&size=150&bold=true",
  },
  {
    display_name: "Taylor Music",
    bio: "Musician and producer. New tracks and behind-the-scenes content.",
    avatar_url:
      "https://ui-avatars.com/api/?name=Taylor+Music&background=8b5cf6&color=fff&size=150&bold=true",
  },
];

// 假数据：图片 URL（优先使用本地占位图，其余保留外网图以丰富首屏）
const LOCAL_PLACEHOLDER = "/images/placeholders/post-media-1-pc.jpg";
const demoImages = [
  LOCAL_PLACEHOLDER,
  LOCAL_PLACEHOLDER,
  LOCAL_PLACEHOLDER,
  "https://picsum.photos/800/600?random=4",
  "https://picsum.photos/800/600?random=5",
  "https://picsum.photos/800/600?random=6",
  LOCAL_PLACEHOLDER,
  "https://picsum.photos/800/600?random=8",
  "https://picsum.photos/800/600?random=9",
  "https://picsum.photos/800/600?random=10",
  "https://picsum.photos/800/600?random=11",
  "https://picsum.photos/800/600?random=12",
  "https://picsum.photos/800/600?random=13",
  "https://picsum.photos/800/600?random=14",
  "https://picsum.photos/800/600?random=15",
];

// 假数据：视频 URL（使用更可靠的视频服务）
const demoVideos = [
  "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
  "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
];

// 假数据：Posts
const demoPosts = [
  // Creator 1: Sophia Creative - 免费内容
  {
    title: "Beautiful Landscape Photography",
    content: "Just captured this amazing sunset! Nature never fails to inspire me. 🌅",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[0],
  },
  {
    title: "Morning Coffee Vibes",
    content: "Starting the day with a perfect cup of coffee and good vibes! ☕",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[6],
  },
  {
    title: "Creative Process Video",
    content: "Watch me create this digital artwork from scratch! Full process video.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "video" as const,
    media_url: demoVideos[0],
    preview_enabled: false,
  },
  {
    title: "Check out my latest work!",
    content: "More exclusive content coming soon for subscribers. 🎨✨",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[1],
  },
  {
    title: "Exclusive Artwork - Subscribers Only",
    content:
      "This is a special piece I created just for my subscribers. Thank you for your support!",
    visibility: "subscribers" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[1],
  },
  {
    title: "Premium Collection - $9.99",
    content: "Unlock this premium artwork collection with detailed process videos.",
    visibility: "ppv" as const,
    price_cents: 999,
    media_type: "image" as const,
    media_url: demoImages[2],
  },
  // Creator 2: Alex Photography - 免费内容
  {
    title: "Sunset Photography",
    content: "Captured this beautiful sunset yesterday. Nature never fails to amaze me.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[3],
  },
  {
    title: "City Lights at Night",
    content: "The city never sleeps! Captured these amazing city lights during my night walk.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[7],
  },
  {
    title: "Photography Tips Video",
    content: "Quick tips for better photography! Hope this helps you improve your skills.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "video" as const,
    media_url: demoVideos[1],
    preview_enabled: false,
  },
  {
    title: "Behind the Scenes - Subscribers",
    content: "See how I set up this shot and my editing process.",
    visibility: "subscribers" as const,
    price_cents: 0,
    media_type: "video" as const,
    media_url: demoVideos[0],
    preview_enabled: true,
  },
  {
    title: "Full Tutorial Video - $4.99",
    content: "Complete photography tutorial with all my tips and tricks.",
    visibility: "ppv" as const,
    price_cents: 499,
    media_type: "video" as const,
    media_url: demoVideos[1],
    preview_enabled: true,
  },
  // Creator 3: Maya Lifestyle - 免费内容
  {
    title: "Morning Routine",
    content: "Starting the day right with a healthy breakfast and positive mindset!",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[4],
  },
  {
    title: "Healthy Meal Prep",
    content: "Prepped my meals for the week! Healthy eating made easy. 🥗",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[8],
  },
  {
    title: "Daily Vlog - Day in My Life",
    content: "Follow me through a typical day! From morning routine to evening wind-down.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "video" as const,
    media_url: demoVideos[2],
    preview_enabled: false,
  },
  {
    title: "Exclusive Recipe - Subscribers",
    content: "My secret recipe for the perfect smoothie bowl.",
    visibility: "subscribers" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[5],
  },
  // Creator 4: Jordan Fitness - 免费内容
  {
    title: "Workout Motivation",
    content: "No excuses! Every rep counts. 💪",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[9],
  },
  {
    title: "Quick Home Workout",
    content: "No gym? No problem! Here's a quick 15-minute home workout you can do anywhere.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "video" as const,
    media_url: demoVideos[3],
    preview_enabled: false,
  },
  {
    title: "Fitness Progress Update",
    content: "30 days of consistent training! Progress photos and what I learned.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[10],
  },
  {
    title: "Full Workout Video - $6.99",
    content: "Complete 30-minute workout routine with detailed explanations.",
    visibility: "ppv" as const,
    price_cents: 699,
    media_type: "video" as const,
    media_url: demoVideos[2],
    preview_enabled: true,
  },
  // Creator 5: Taylor Music - 免费内容
  {
    title: "New Track Preview",
    content: "Preview of my latest track. Full version available for subscribers!",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "video" as const,
    media_url: demoVideos[4],
    preview_enabled: false,
  },
  {
    title: "Behind the Scenes - Studio Session",
    content: "Take a look at my creative process in the studio! Making music is my passion.",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "image" as const,
    media_url: demoImages[11],
  },
  {
    title: "Acoustic Performance",
    content: "Performed this song live! Hope you enjoy it. Let me know what you think!",
    visibility: "free" as const,
    price_cents: 0,
    media_type: "video" as const,
    media_url: demoVideos[0],
    preview_enabled: false,
  },
  {
    title: "Full Album - $19.99",
    content: "Complete album with 10 tracks and bonus content.",
    visibility: "ppv" as const,
    price_cents: 1999,
    media_type: "video" as const,
    media_url: demoVideos[4],
    preview_enabled: false,
  },
];

async function seedFeedData() {
  console.log("🌱 开始填充 Feed 假数据...\n");

  try {
    // 1. 获取或创建 demo creators
    const creatorIds: string[] = [];

    for (const creatorInfo of demoCreators) {
      // 检查是否已存在同名 creator
      const { data: existing } = await supabase
        .from("creators")
        .select("id")
        .eq("display_name", creatorInfo.display_name)
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log(`✅ Creator 已存在: ${creatorInfo.display_name} (${existing.id})`);
        creatorIds.push(existing.id);
        // 更新 creator 信息（确保 bio 和 avatar 是最新的）
        await supabase
          .from("creators")
          .update({
            bio: creatorInfo.bio,
            avatar_url: creatorInfo.avatar_url,
          })
          .eq("id", existing.id);
        // 同时更新 profiles 表的 avatar_url（因为 listFeed 从 profiles 获取）
        await supabase
          .from("profiles")
          .update({
            avatar_url: creatorInfo.avatar_url,
          })
          .eq("id", existing.id);
        continue;
      }

      // 创建新用户作为 creator
      const timestamp = Date.now();
      const email = `demo-${creatorInfo.display_name.toLowerCase().replace(/\s+/g, "-")}-${timestamp}@example.com`;
      const password = "DemoPassword123!";

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError || !authData?.user) {
        console.error(`❌ 创建用户失败 (${creatorInfo.display_name}):`, authError);
        continue;
      }

      const userId = authData.user.id;

      // 创建 profile（确保 avatar_url 被设置）
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          email,
          display_name: creatorInfo.display_name,
          role: "creator",
          age_verified: true,
          avatar_url: creatorInfo.avatar_url,
        },
        {
          onConflict: "id",
        }
      );

      if (profileError) {
        console.error(`❌ 创建 profile 失败:`, profileError);
        continue;
      }

      // 创建或更新 creator 记录（使用 upsert）
      const { error: creatorError } = await supabase.from("creators").upsert(
        {
          id: userId,
          display_name: creatorInfo.display_name,
          bio: creatorInfo.bio,
          avatar_url: creatorInfo.avatar_url,
        },
        {
          onConflict: "id",
        }
      );

      if (creatorError) {
        console.error(`❌ 创建/更新 creator 记录失败:`, creatorError);
        continue;
      }

      console.log(`✅ 创建 Creator: ${creatorInfo.display_name} (${userId})`);
      creatorIds.push(userId);
    }

    if (creatorIds.length === 0) {
      console.log("⚠️  没有可用的 creators，跳过 posts 创建");
      return;
    }

    // 2. 创建 posts
    let postIndex = 0;
    let creatorIndex = 0;

    for (const postData of demoPosts) {
      const creatorId = creatorIds[creatorIndex % creatorIds.length];
      creatorIndex++;

      // 创建 post（确保 price_cents 不为 null）
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          creator_id: creatorId,
          title: postData.title,
          content: postData.content,
          visibility: postData.visibility,
          price_cents: postData.price_cents ?? 0, // 如果为 null，使用 0
          preview_enabled: postData.preview_enabled || false,
          watermark_enabled: postData.media_type === "image",
        })
        .select("id")
        .single();

      if (postError || !post) {
        console.error(`❌ 创建 post 失败 ("${postData.title}"):`, postError);
        continue;
      }

      // 创建 post_media 记录
      const { error: mediaError } = await supabase.from("post_media").insert({
        post_id: post.id,
        media_url: postData.media_url,
        media_type: postData.media_type,
        file_name: `${postData.media_type}-${postIndex + 1}.${postData.media_type === "image" ? "jpg" : "mp4"}`,
        file_size: null,
        sort_order: 0,
      });

      if (mediaError) {
        console.error(`❌ 创建 post_media 失败:`, mediaError);
        continue;
      }

      console.log(
        `✅ 创建 Post: "${postData.title}" (${postData.visibility}, ${postData.media_type})`
      );
      postIndex++;
    }

    console.log("\n✅ Feed 假数据填充完成！");
    console.log(`\n📋 总结:`);
    console.log(`   Creators: ${creatorIds.length}`);
    console.log(`   Posts: ${postIndex}`);
    console.log(`\n🌐 访问 /home 查看 Feed`);
  } catch (error) {
    console.error("\n❌ 填充失败:", error);
    process.exit(1);
  }
}

seedFeedData().catch((err) => {
  console.error("❌ 脚本执行失败:", err);
  process.exit(1);
});
