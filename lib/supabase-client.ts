import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 在构建/运行时给出明确提示，方便排查
  // 注意：不会阻止应用运行，但 Supabase 相关功能会失败
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] ❌ 缺少环境变量！请在 .env.local 中配置：",
    "\n  NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL",
    "\n  NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase Anon Key",
    "\n配置后请重启开发服务器（Ctrl+C 然后 pnpm run dev）"
  )
}

// 如果环境变量缺失，使用占位符（会导致请求失败，但不会崩溃）
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder_key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)


