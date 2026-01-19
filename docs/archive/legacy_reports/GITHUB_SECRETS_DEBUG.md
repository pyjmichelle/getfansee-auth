# GitHub Secrets 排查指南

## 🔍 问题诊断

### 1. **Secret 名称不匹配** ⭐ 最常见

**症状**: CI 日志显示环境变量为空或未定义

**原因**:

- GitHub Secrets 中的名称：`SUPABASE`
- CI YAML 中引用的名称：`secrets.SUPABASE_SERVICE_ROLE_KEY`
- ❌ 不匹配！

**解决方案 A** - 修改 CI YAML（推荐）:

```yaml
# 修改前
SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

# 修改后
SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE }}
```

**解决方案 B** - 修改 GitHub Secret 名称:

1. 删除现有的 `SUPABASE` Secret
2. 创建新的 Secret，名称改为 `SUPABASE_SERVICE_ROLE_KEY`

---

### 2. **Secret 作用域问题**

**症状**: 在某些分支或 PR 中无法访问 Secrets

**原因**:

- Secrets 默认只在 **Repository Secrets** 中可用
- Fork 的 PR 无法访问原仓库的 Secrets（安全限制）
- Environment Secrets 需要指定 environment

**检查方法**:

```bash
# 查看 CI 配置中是否指定了 environment
grep -A 5 "environment:" .github/workflows/ci.yml
```

**解决方案**:

- 确保 Secrets 在 `Settings → Secrets and variables → Actions → Repository secrets` 中
- 如果使用 Environment Secrets，需要在 job 中指定：
  ```yaml
  jobs:
    my-job:
      environment: production # 指定环境
  ```

---

### 3. **Secret 值包含特殊字符**

**症状**: Secret 值被截断或解析错误

**原因**:

- Secret 值包含 `$`, `"`, `'`, `\n` 等特殊字符
- YAML 解析时被转义

**解决方案**:

- 直接粘贴原始值，不要添加引号
- 不要在值的开头/结尾添加空格
- JWT token 应该是一整行，不要换行

**示例**:

```
✅ 正确: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...
❌ 错误: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI..."
❌ 错误: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
        eyJpc3MiOiJzdXBhYmFzZSI...
```

---

### 4. **Secret 未保存或更新未生效**

**症状**: 刚添加的 Secret 在 CI 中不可用

**原因**:

- 添加 Secret 后没有点击 "Add secret" 按钮
- 浏览器缓存问题
- GitHub 同步延迟（极少见）

**解决方案**:

1. 重新检查 Secret 是否在列表中
2. 尝试编辑并重新保存
3. 触发新的 CI run（不要重新运行旧的）

---

### 5. **权限问题**

**症状**: CI 无法访问 Secrets

**原因**:

- Workflow 权限设置不正确
- 仓库设置限制了 Actions 的权限

**检查方法**:

1. 仓库 `Settings → Actions → General`
2. 检查 "Workflow permissions" 设置
3. 确保至少是 "Read repository contents and packages permissions"

---

## 🛠️ 当前项目的具体问题

### **问题分析**

根据你的截图，GitHub Secrets 配置：

```
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ NEXT_PUBLIC_SUPABASE_URL
✅ SUPABASE
```

CI YAML 中引用：

```yaml
NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }} # ✅ 匹配
NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }} # ✅ 匹配
SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }} # ❌ 不匹配！
```

### **解决方案**

**选项 1: 修改 CI YAML**（已在最新提交中修复）

```yaml
SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE }}
```

**选项 2: 添加新的 GitHub Secret**

1. 访问: https://github.com/pyjmichelle/getfansee-auth/settings/secrets/actions
2. 点击 "New repository secret"
3. Name: `SUPABASE_SERVICE_ROLE_KEY`
4. Value: 从 Supabase Dashboard 复制 `service_role` key
5. 点击 "Add secret"

---

## 🧪 验证 Secrets 是否生效

### **方法 1: 在 CI 中打印（调试用）**

⚠️ **警告**: 不要打印完整的 Secret 值！

```yaml
- name: Debug Secrets
  run: |
    echo "SUPABASE_URL length: ${#NEXT_PUBLIC_SUPABASE_URL}"
    echo "ANON_KEY length: ${#NEXT_PUBLIC_SUPABASE_ANON_KEY}"
    echo "SERVICE_ROLE_KEY length: ${#SUPABASE_SERVICE_ROLE_KEY}"
    echo "SUPABASE_URL starts with: ${NEXT_PUBLIC_SUPABASE_URL:0:20}..."
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE }}
```

### **方法 2: 检查环境变量是否为空**

```yaml
- name: Validate Secrets
  run: |
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
      echo "❌ NEXT_PUBLIC_SUPABASE_URL is empty"
      exit 1
    fi
    if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
      echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is empty"
      exit 1
    fi
    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ SUPABASE_SERVICE_ROLE_KEY is empty"
      exit 1
    fi
    echo "✅ All secrets are present"
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE }}
```

---

## 📚 最佳实践

### 1. **统一命名规范**

```
✅ 推荐: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
❌ 避免: SUPABASE, KEY1, MY_SECRET
```

### 2. **使用 Environment Secrets 进行分层**

```yaml
jobs:
  deploy-staging:
    environment: staging
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }} # 从 staging environment 读取

  deploy-production:
    environment: production
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }} # 从 production environment 读取
```

### 3. **文档化 Secrets**

在 README 或 `.github/SECRETS.md` 中记录：

```markdown
## Required Secrets

| Name                      | Description               | Where to get               |
| ------------------------- | ------------------------- | -------------------------- |
| SUPABASE_URL              | Supabase project URL      | Dashboard → Settings → API |
| SUPABASE_ANON_KEY         | Public anon key           | Dashboard → Settings → API |
| SUPABASE_SERVICE_ROLE_KEY | Service role key (secret) | Dashboard → Settings → API |
```

### 4. **使用 GitHub CLI 管理 Secrets**

```bash
# 列出所有 secrets
gh secret list

# 添加 secret
gh secret set SUPABASE_SERVICE_ROLE_KEY < secret.txt

# 删除 secret
gh secret remove OLD_SECRET
```

---

## 🔗 相关链接

- [GitHub Secrets 官方文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase API Keys 说明](https://supabase.com/docs/guides/api/api-keys)
- [GitHub Actions 环境变量](https://docs.github.com/en/actions/learn-github-actions/variables)

---

**最后更新**: 2026-01-11  
**状态**: ✅ 已识别问题并提供解决方案
