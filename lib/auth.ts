import { supabase } from "./supabase-client"

export type AppUser = {
  id: string
  email: string
}

/**
 * 获取当前登录用户
 * 使用 getSession() 而不是 getUser()，避免在没有 session 时抛出错误
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error("[auth] getSession error", error)
    return null
  }

  if (!session?.user || !session.user.email) return null
  return { id: session.user.id, email: session.user.email }
}

/**
 * 确保 profiles 中存在记录，默认 role = 'fan'
 */
export async function ensureProfile() {
  const user = await getCurrentUser()
  if (!user) return

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, age_verified")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[auth] ensureProfile select error", error)
    return
  }

  if (!data) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      display_name: user.email.split("@")[0],
      role: "fan",
      age_verified: false,
    })
    if (insertError) {
      console.error("[auth] ensureProfile insert error", insertError)
    }
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/verify` : undefined,
    },
  })
  
  // 验证证据：打印 session 状态和 user.id
  if (process.env.NODE_ENV === "development") {
    console.log("[auth] signUp response:", {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      userId: data?.user?.id || "none",
      error: error?.message || "none",
    })
  }
  
  if (error) {
    console.error("[auth] signUp error:", error)
    throw error
  }
  
  // 返回完整的数据，包括 user 和 session（如果有）
  return data
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  // 验证证据：打印 session 状态和 user.id
  if (process.env.NODE_ENV === "development") {
    console.log("[auth] signIn response:", {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      userId: data?.user?.id || "none",
      error: error?.message || "none",
    })
  }
  
  if (error) throw error
  // 登录后一定有 session，返回完整数据
  return data
}

export async function signInWithMagicLink(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/auth/verify` : undefined,
    },
  })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/verify` : undefined,
    },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}


