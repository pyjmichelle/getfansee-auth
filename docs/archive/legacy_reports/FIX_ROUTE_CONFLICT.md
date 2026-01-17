# 修复路由冲突错误

## ❌ 错误原因

Next.js 报错：`You cannot use different slug names for the same dynamic path ('id' !== 'username')`

**原因**：`app/creator/` 目录下同时存在：

- `[id]/page.tsx` (Phase 1 需要的)
- `[username]/page.tsx` (旧的)

Next.js 不允许同一层级有两个不同的动态路由参数。

---

## 🔧 修复方法

### 方法 1: 在 Finder 中手动删除（推荐）

1. 打开 Finder
2. 导航到：`/Users/puyijun/Downloads/authentication-flow-design (1)/app/creator/`
3. 找到 `[username]` 文件夹
4. 右键点击 → 移到废纸篓
5. 清空废纸篓（可选）

### 方法 2: 在终端中删除

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)/app/creator"
rm -rf '[username]'
```

### 方法 3: 在 VS Code/Cursor 中删除

1. 在文件浏览器中找到 `app/creator/[username]` 文件夹
2. 右键点击 → 删除
3. 确认删除

---

## ✅ 验证修复

删除后，`app/creator/` 目录下应该只有：

- `[id]/page.tsx` ✅
- `new-post/page.tsx` ✅
- `onboarding/page.tsx` ✅
- 其他非动态路由目录 ✅

**不应该有**：

- `[username]/` ❌

---

## 🚀 修复后

删除 `[username]` 目录后，重新运行：

```bash
pnpm run dev
```

应该可以正常启动了。
