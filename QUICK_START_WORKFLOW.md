# ⚡ 快速开始 - 开发工作流

## 🎯 每次开发新功能的标准流程

### 1️⃣ 创建分支 (30 秒)

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### 2️⃣ 开发代码 (你的时间)

```bash
# 编写代码...
git add .
git commit -m "feat: 你的改动"
```

### 3️⃣ 推送前检查 (2 分钟)

```bash
pnpm check-all
```

**必须全部通过** ✅

### 4️⃣ 推送并创建 PR (1 分钟)

```bash
git push origin feature/your-feature-name
```

然后访问: https://github.com/pyjmichelle/getfansee-auth/pulls

点击 **"Compare & pull request"**

### 5️⃣ 等待 CI 通过 (5-10 分钟)

查看: https://github.com/pyjmichelle/getfansee-auth/actions

### 6️⃣ 合并 PR (30 秒)

所有检查通过后,点击 **"Merge pull request"**

### 7️⃣ 清理 (30 秒)

```bash
git checkout main
git pull origin main
git branch -d feature/your-feature-name
```

---

## 🚫 记住:永远不要直接推送到 main!

```bash
# ❌ 错误
git push origin main

# ✅ 正确
git checkout -b feature/xxx
git push origin feature/xxx
# 然后创建 PR
```

---

## 📚 完整文档

- **详细工作流**: `DEVELOPMENT_WORKFLOW.md`
- **分支保护**: `.github/BRANCH_PROTECTION_GUIDE.md`
- **CI 配置**: `SETUP_COMPLETE.md`

---

**遵循这个流程,代码质量有保障!** 🎊
