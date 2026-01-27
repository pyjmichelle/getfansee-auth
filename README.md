# getfansee-auth

![CI Status](https://github.com/pyjmichelle/getfansee-auth/actions/workflows/ci.yml/badge.svg)
![Code Quality](https://github.com/pyjmichelle/getfansee-auth/actions/workflows/code-quality.yml/badge.svg)

All AI-assisted development must follow [docs/agents](./docs/agents) and [docs/sop](./docs/sop).

## 📚 快速开始

- **开发工作流程**: 查看 [QUICK_START_WORKFLOW.md](./QUICK_START_WORKFLOW.md) ⚡
- **详细指南**: 查看 [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)
- **部署指南**: 查看 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **贡献指南**: 查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 👥

## 🚀 本地开发设置

### 1. 克隆项目

```bash
git clone <repo-url>
cd authentication-flow-design
pnpm install
```

### 2. 配置环境变量（必需！）

```bash
# 复制环境变量模板
cp env.ci.template .env.local

# 编辑 .env.local 并填入你的 Supabase credentials
```

**⚠️ 重要**: 你需要一个 Supabase 账号和项目。填写：

- `NEXT_PUBLIC_SUPABASE_URL` - 你的 Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 你的 Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - 你的 Supabase service role key

### 3. 验证环境配置

```bash
pnpm check:env
```

如果看到 ✅，说明配置正确！

### 4. 启动开发服务器

```bash
pnpm dev
```

### 5. 运行测试（推送前必须！）

```bash
pnpm ci:verify
```

这会运行所有 CI 检查（lint、type-check、build、qa、e2e）。所有检查必须通过才能推送！

## CI/CD Setup

This project uses GitHub Actions for continuous integration. The following GitHub Secrets are **required** for CI to run successfully:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations in tests)

To configure these secrets:

1. Go to your GitHub repository
2. Navigate to `Settings` → `Secrets and variables` → `Actions`
3. Click `New repository secret` and add each of the above secrets

Without these secrets, the CI pipeline will fail with missing environment variable errors.
