# 🔐 GitHub Secrets 配置指南

## 📋 需要配置的 Secrets

要让 CI/CD 正常工作,你需要在 GitHub 仓库中配置以下 3 个 Secrets:

---

## 🎯 配置步骤

### Step 1: 获取 Supabase 配置

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧 **Settings** ⚙️
4. 点击 **API**
5. 复制以下信息:

```
Project URL:    https://xxx.supabase.co
anon public:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Step 2: 添加到 GitHub Secrets

1. 打开你的 GitHub 仓库: https://github.com/pyjmichelle/getfansee-auth

2. 点击 **Settings** (仓库设置)

3. 在左侧菜单中找到 **Secrets and variables** → **Actions**

4. 点击 **New repository secret** 按钮

5. 添加以下 3 个 Secrets:

---

#### Secret 1: NEXT_PUBLIC_SUPABASE_URL

```
Name:  NEXT_PUBLIC_SUPABASE_URL
Value: https://xxx.supabase.co
       (从 Supabase → Settings → API → Project URL 复制)
```

点击 **Add secret**

---

#### Secret 2: NEXT_PUBLIC_SUPABASE_ANON_KEY

```
Name:  NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       (从 Supabase → Settings → API → anon public 复制)
```

点击 **Add secret**

---

#### Secret 3: SUPABASE_SERVICE_ROLE_KEY

```
Name:  SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       (从 Supabase → Settings → API → service_role 复制)
```

⚠️ **注意**: service_role 密钥拥有最高权限,请妥善保管!

点击 **Add secret**

---

### Step 3: 配置工作流权限

1. 在仓库 **Settings** 中
2. 找到 **Actions** → **General**
3. 滚动到 **Workflow permissions** 部分
4. 选择:
   - ✅ **Read and write permissions**
5. 勾选:
   - ✅ **Allow GitHub Actions to create and approve pull requests**
6. 点击 **Save** 保存

---

## ✅ 验证配置

### 方法 1: 检查 Secrets 列表

在 **Settings** → **Secrets and variables** → **Actions** 页面,你应该看到:

```
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
```

### 方法 2: 触发 CI 测试

```bash
# 创建测试提交
git checkout -b test/ci-config
echo "test" >> README.md
git commit -am "test: 验证 CI 配置"
git push origin test/ci-config
```

然后在 GitHub 上:

1. 访问 **Actions** 标签
2. 查看最新的工作流运行
3. 确认构建步骤没有环境变量相关的错误

---

## 🐛 常见问题

### Q1: Secret 添加后看不到值?

**A**: 这是正常的!为了安全,GitHub 不会显示 Secret 的值。你只能:

- 看到 Secret 的名称
- 更新 Secret 的值
- 删除 Secret

### Q2: CI 报错 "Missing environment variable"?

**A**: 检查:

1. Secret 名称是否完全匹配 (大小写敏感)
2. Secret 值是否正确复制 (没有多余空格)
3. 工作流文件中是否正确引用: `${{ secrets.SECRET_NAME }}`

### Q3: 如何更新 Secret?

**A**:

1. 进入 **Settings** → **Secrets and variables** → **Actions**
2. 点击要更新的 Secret
3. 点击 **Update secret**
4. 输入新值并保存

### Q4: 本地开发需要这些 Secrets 吗?

**A**: 不需要!本地使用 `.env.local` 文件:

```bash
# .env.local (本地开发)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

Secrets 只在 GitHub Actions 中使用。

---

## 🔒 安全最佳实践

### ✅ 应该做的

- ✅ 只在 GitHub Secrets 中存储敏感信息
- ✅ 定期轮换 API 密钥
- ✅ 使用 service_role 密钥要特别小心
- ✅ 检查工作流日志,确保没有泄露 Secret

### ❌ 不应该做的

- ❌ 不要将 Secrets 提交到代码仓库
- ❌ 不要在 PR 评论或 Issue 中粘贴 Secrets
- ❌ 不要在工作流中 `echo` Secret 值
- ❌ 不要与不信任的人分享 service_role 密钥

---

## 📊 配置完成检查清单

完成以下所有步骤:

- [ ] ✅ 从 Supabase 获取了 3 个配置值
- [ ] ✅ 在 GitHub 添加了 `NEXT_PUBLIC_SUPABASE_URL`
- [ ] ✅ 在 GitHub 添加了 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] ✅ 在 GitHub 添加了 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] ✅ 配置了 Workflow permissions 为 "Read and write"
- [ ] ✅ 勾选了 "Allow GitHub Actions to create and approve pull requests"
- [ ] ✅ 触发了一次 CI 运行验证配置

---

## 🎉 完成!

配置完成后,你的 CI/CD 流水线就可以正常工作了!

每次推送代码或创建 PR 时:

- ✅ 自动运行所有检查
- ✅ 自动评论代码问题
- ✅ 自动添加 PR 标签
- ✅ 自动安全扫描

---

## 📚 相关文档

- [PRE_COMMIT_CHECKLIST.md](.github/PRE_COMMIT_CHECKLIST.md) - 提交前检查清单
- [WORKFLOW_GUIDE.md](.github/workflows/WORKFLOW_GUIDE.md) - CI 工作流指南
- [CI_REVIEW_SETUP.md](../CI_REVIEW_SETUP.md) - CI 审查系统配置

---

**需要帮助?** 查看 [GitHub Secrets 文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
