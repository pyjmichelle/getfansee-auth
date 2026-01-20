# getfansee-auth

![CI Status](https://github.com/pyjmichelle/getfansee-auth/actions/workflows/ci.yml/badge.svg)
![Code Quality](https://github.com/pyjmichelle/getfansee-auth/actions/workflows/code-quality.yml/badge.svg)

All AI-assisted development must follow [docs/agents](./docs/agents) and [docs/sop](./docs/sop).

## 📚 快速开始

- **开发工作流程**: 查看 [QUICK_START_WORKFLOW.md](./QUICK_START_WORKFLOW.md) ⚡
- **详细指南**: 查看 [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)
- **部署指南**: 查看 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

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
