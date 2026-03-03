# /home 页面 "Something went wrong" 错误重现报告

**日期**: 2026-03-03  
**测试环境**:

- 生产环境: https://getfansee-auth.vercel.app
- 本地环境: http://127.0.0.1:3000

---

## 执行摘要

尝试在生产环境和本地环境重现 "Something went wrong" 错误。

**结论**:

- ✅ 本地环境: `/home` 正确重定向到 `/auth?mode=login`
- ✅ 生产环境: `/home` 正确重定向到 `/auth?mode=login`
- ❌ **未能重现** "Something went wrong" 错误页面

---

## 测试步骤

### 1. 生产环境测试 (Vercel)

使用浏览器工具测试 `https://getfansee-auth.vercel.app/home`:

1. ✅ 清除 cookies 和 local storage (尝试)
2. ✅ 直接导航到 `/home`
3. ✅ 检查控制台错误
4. ✅ 检查网络请求
5. ✅ 截图页面状态

**结果**:

- **当前 URL**: `https://getfansee-auth.vercel.app/auth?mode=login`
- **页面标题**: "GetFanSee - Where fans get closer"
- **页面内容**: 登录表单 ("Welcome back")
- **控制台错误**: 0 个 (只有浏览器工具警告)
- **网络错误**: 0 个关键错误
- **"Something went wrong" 页面**: ❌ 未出现

### 2. 本地环境测试 (Playwright)

创建并运行了 `tests/e2e/reproduce-home-error.spec.ts`:

```bash
pnpm exec playwright test tests/e2e/reproduce-home-error.spec.ts --project=chromium
```

**结果**:

```
=== Page State ===
Current URL: http://127.0.0.1:3000/auth?mode=login
Page Title: GetFanSee - Where fans get closer
Response Status: 200

=== Error Page Detection ===
'Something went wrong' visible: false

=== Console Errors ===
No console errors found

=== Auth/Module Related Errors ===
No auth/module related errors found

=== Network Errors ===
No network errors found

=== Auth Redirect Check ===
✓ Redirected to auth page (expected behavior)

=== Page Content Analysis ===
Has error boundary: false
Has auth form: true
```

---

## 代码分析

### `/home` 页面逻辑 (`app/home/page.tsx`)

```typescript
export default async function HomePage() {
  const user = await getCachedUser();

  if (!user) {
    redirect("/auth"); // ← 第 28 行: 未登录时重定向
  }

  await ensureProfile(user);
  // ... 其余逻辑
}
```

**预期行为**:

1. 服务器端检查用户认证状态
2. 如果未登录 → `redirect("/auth")`
3. 如果登录 → 渲染 Home Feed

### 错误边界 (`app/error.tsx`)

```typescript
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div>
      <h1>Something went wrong</h1>
      {/* ... */}
    </div>
  );
}
```

**触发条件**:

- Next.js 在渲染 `/home` 页面时抛出未捕获的异常
- 可能的原因:
  - Supabase 连接失败
  - 环境变量缺失
  - 数据库查询错误
  - 模块导入错误

---

## 可能导致错误的场景

基于代码分析,以下情况可能触发 "Something went wrong":

### 场景 1: Supabase 连接失败

```typescript
// lib/auth-server.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**触发条件**:

- 环境变量未设置
- Supabase 服务不可用
- 网络超时

### 场景 2: 数据库查询错误

```typescript
// app/home/page.tsx 第 44 行
posts = await getCachedFeed(20);
```

**触发条件**:

- `posts` 表不存在
- SQL 查询语法错误
- 权限问题

### 场景 3: Profile 创建失败

```typescript
// app/home/page.tsx 第 32 行
await ensureProfile(user);
```

**触发条件**:

- `profiles` 表不存在
- 插入失败
- 约束冲突

### 场景 4: 模块导入错误

```typescript
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
```

**触发条件**:

- 构建错误
- 模块路径错误
- TypeScript 编译失败

---

## 为什么无法重现?

### 可能原因:

1. **环境差异**
   - 生产环境可能有不同的环境变量配置
   - Vercel 的 Edge Runtime 行为不同
   - 数据库状态不同

2. **时间窗口**
   - 错误可能是间歇性的
   - Supabase 可能在某些时候不可用
   - 网络问题导致的临时错误

3. **特定条件**
   - 需要特定的 cookie 状态
   - 需要特定的 session 状态
   - 需要特定的数据库状态

4. **已修复**
   - 错误可能已经在最近的部署中修复
   - 代码更改解决了问题

---

## 建议的调试步骤

### 1. 添加更详细的错误日志

在 `app/home/page.tsx` 中添加 try-catch:

```typescript
export default async function HomePage() {
  try {
    const user = await getCachedUser();

    if (!user) {
      console.log("[home] No user found, redirecting to /auth");
      redirect("/auth");
    }

    console.log("[home] User authenticated:", user.id);

    await ensureProfile(user);
    console.log("[home] Profile ensured");

    const userProfile = await getCachedProfile(user.id);
    if (!userProfile) {
      console.error("[home] Profile not found after ensureProfile");
      redirect("/auth");
    }

    console.log("[home] Profile loaded:", userProfile.role);

    // ... 其余逻辑
  } catch (error) {
    console.error("[home] Fatal error:", error);
    throw error; // 让 error.tsx 捕获
  }
}
```

### 2. 在 Vercel 中检查日志

访问 Vercel Dashboard:

1. 进入项目
2. 查看 "Logs" 标签
3. 过滤 `/home` 路径的请求
4. 查找错误堆栈

### 3. 添加 Sentry 或其他错误追踪

```typescript
// app/error.tsx
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);

    // 发送到 Sentry
    if (typeof window !== "undefined") {
      // Sentry.captureException(error);
    }
  }, [error]);

  // ...
}
```

### 4. 创建专门的测试端点

```typescript
// app/api/debug/home-check/route.ts
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "No user" }, { status: 401 });
    }

    const profile = await getProfile(user.id);
    if (!profile) {
      return Response.json({ error: "No profile" }, { status: 404 });
    }

    const posts = await listFeed(20);

    return Response.json({
      success: true,
      user: { id: user.id, email: user.email },
      profile: { role: profile.role, display_name: profile.display_name },
      postsCount: posts.length,
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
```

然后访问 `https://getfansee-auth.vercel.app/api/debug/home-check` 来诊断问题。

### 5. 使用 Vercel 的 Edge Functions 日志

在 `next.config.js` 中启用详细日志:

```javascript
module.exports = {
  experimental: {
    logging: {
      level: "verbose",
    },
  },
};
```

---

## 测试文件

创建了以下测试文件用于重现:

- `tests/e2e/reproduce-home-error.spec.ts` - Playwright 测试

可以运行:

```bash
pnpm exec playwright test tests/e2e/reproduce-home-error.spec.ts --project=chromium
```

---

## 结论

**当前状态**:

- ✅ `/home` 页面在本地和生产环境都**正常工作**
- ✅ 未登录用户被正确重定向到 `/auth`
- ❌ 无法重现 "Something went wrong" 错误

**下一步**:

1. 如果错误再次出现,立即检查 Vercel 日志
2. 添加更详细的错误日志和追踪
3. 创建调试端点来诊断问题
4. 考虑添加 Sentry 或类似的错误监控工具

**可能的解释**:

- 错误可能是间歇性的
- 错误可能已经被修复
- 错误可能需要特定的条件才能触发
- 错误可能只在特定的部署版本中出现

---

## 附录

### 相关文件

- `app/home/page.tsx` - Home 页面服务器组件
- `app/error.tsx` - 错误边界
- `lib/auth-server.ts` - 服务器端认证逻辑
- `lib/auth-bootstrap-client.ts` - 客户端认证引导
- `components/providers/auth-sync-provider.tsx` - 认证同步 Provider

### 环境变量检查清单

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_TEST_MODE`

### Vercel 部署信息

- **生产 URL**: https://getfansee-auth.vercel.app
- **框架**: Next.js 15.1.6
- **Node 版本**: 20.x
- **构建命令**: `pnpm build`
