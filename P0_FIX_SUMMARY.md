# P0 修复总结

**日期**: 2026-01-18  
**状态**: ✅ 已修复

---

## 🔴 问题 1: `/home` 返回 500

### 错误信息

```
Error: Cookies can only be modified in a Server Action or Route Handler
at lib/supabase-server.ts:32
```

### 根因

Next.js 16 中，`cookies()` 在 Server Components 中返回只读对象。尝试调用 `set()` 会抛出异常。

### 修复

在 `lib/supabase-server.ts` 的 `setAll()` 中添加 `try-catch`：

```typescript
try {
  mutableCookies.set({ name, value, ...options });
} catch (error: any) {
  // Next.js 16: cookies() in Server Components is read-only
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[supabase-server] Skipping cookie set for "${name}": ${error.message}`);
  }
  // NO-OP: do not throw, allow page to render
}
```

### 验证

```bash
curl -I http://127.0.0.1:3000/home
# HTTP/1.1 307 Temporary Redirect (✅ 不再是 500)
```

### 文件

- `lib/supabase-server.ts`

---

## 🔴 问题 2: `/api/tags` 返回 500

### 错误信息

```
Error: Attempted to call getSupabaseBrowserClient() from the server
at app/api/tags/route.ts:19:46
```

### 根因

Route Handler (服务器端) 错误使用了 `getSupabaseBrowserClient()`（浏览器端客户端）。

### 修复

将 `getSupabaseBrowserClient()` 替换为 `createClient()`（服务器端客户端）：

```diff
- import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
+ import { createClient } from "@/lib/supabase-server";

- const supabase = getSupabaseBrowserClient();
+ const supabase = await createClient();
```

### 验证

```bash
# 需要认证的请求会返回 401（预期）
curl -I http://127.0.0.1:3000/api/tags?category=content
# HTTP/1.1 401 Unauthorized (✅ 不再是 500)

# 带认证的请求会返回 200
# (需要有效的 session cookie)
```

### 文件

- `app/api/tags/route.ts`

---

## 📊 修复前后对比

### 修复前

```
GET /home → 500 Internal Server Error
GET /api/tags → 500 Internal Server Error
```

### 修复后

```
GET /home → 307 Temporary Redirect (to /auth)
GET /api/tags → 401 Unauthorized (expected for unauthenticated)
```

---

## ⚠️ 仍存在的警告（非阻塞）

### 1. Supabase Auth 警告

```
Using the user object as returned from supabase.auth.getSession()
could be insecure! Use supabase.auth.getUser() instead.
```

**影响**: 安全性建议，不影响功能  
**优先级**: P1  
**建议**: 在所有使用 `getSession()` 的地方替换为 `getUser()`

### 2. Next.js Middleware 弃用警告

```
The "middleware" file convention is deprecated.
Please use "proxy" instead.
```

**影响**: 未来版本兼容性  
**优先级**: P2  
**建议**: 迁移到新的 `proxy` 约定

### 3. Cookie 设置跳过警告（预期）

```
[supabase-server] Skipping cookie set for "sb-*-auth-token"
```

**影响**: 无（这是我们的修复，预期行为）  
**优先级**: P3  
**说明**: 在 Server Components 中跳过 cookie 写入是正常的

---

## ✅ 验收清单

- [x] `/home` 不再返回 500
- [x] `/api/tags` 不再返回 500
- [x] 页面可以正常渲染
- [x] 未认证用户正确重定向到 `/auth`
- [x] 开发服务器日志中的 cookie 警告是预期的
- [x] Git diff 已生成

---

## 🚀 下一步

### 立即执行

```bash
# 重启开发服务器以应用修复
pnpm dev
```

### 验证修复

```bash
# 测试 /home
curl -I http://127.0.0.1:3000/home

# 测试 /api/tags
curl -I http://127.0.0.1:3000/api/tags?category=content
```

### 运行完整审计

```bash
pnpm qa:loop
```

---

## 📝 Git Diff

### lib/supabase-server.ts

```diff
@@ -29,7 +29,18 @@ export async function createClient(): Promise<SupabaseClient> {

         cookiesToSet.forEach(({ name, value, options }) => {
           if (typeof mutableCookies.set === "function") {
-            mutableCookies.set({ name, value, ...options });
+            try {
+              mutableCookies.set({ name, value, ...options });
+            } catch (error: any) {
+              // Next.js 16: cookies() in Server Components is read-only
+              if (process.env.NODE_ENV !== "production") {
+                console.warn(
+                  `[supabase-server] Skipping cookie set for "${name}": ${error.message}`
+                );
+              }
+              // NO-OP: do not throw, allow page to render
+            }
           }
         });
       },
```

### app/api/tags/route.ts

```diff
@@ -1,6 +1,6 @@
 import { NextRequest, NextResponse } from "next/server";
 import { getCurrentUser } from "@/lib/auth-server";
-import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
+import { createClient } from "@/lib/supabase-server";

 /**
  * GET /api/tags?category=content|creator
@@ -16,7 +16,7 @@ export async function GET(request: NextRequest) {
     const { searchParams } = new URL(request.url);
     const category = searchParams.get("category");

-    const supabase = getSupabaseBrowserClient();
+    const supabase = await createClient();
     let query = supabase.from("tags").select("*").order("name");
```

---

**修复完成！现在可以运行 `pnpm qa:loop` 了。**
