# Contributing Guide

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account (for running tests)

### Initial Setup

1. Clone the repository:

```bash
git clone <repo-url>
cd authentication-flow-design
```

2. Install dependencies:

```bash
pnpm install
```

3. Setup environment variables:

```bash
cp env.ci.template .env.local
```

Edit `.env.local` and fill in your Supabase credentials:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for tests only)

**⚠️ Never commit `.env.local` to git!**

4. Run development server:

```bash
pnpm dev
```

## Running Tests Locally

### Full CI Verification

Before pushing code, run the complete CI verification pipeline:

```bash
pnpm ci:verify
```

This runs:

1. ESLint code quality checks
2. TypeScript type checking
3. Production build
4. QA gates (UI + dead click detection)
5. E2E tests (Chromium)

**All checks must pass before pushing to remote.**

### Individual Test Commands

```bash
# Lint check
pnpm lint

# Type check
pnpm type-check

# Build
pnpm build

# QA gates
pnpm qa:gate

# E2E tests
pnpm exec playwright test --project=chromium

# Unit tests
pnpm test:unit
```

## Git Workflow

### Pre-commit Hook

Automatically runs `lint-staged` on staged files:

- ESLint auto-fix
- Prettier formatting

### Pre-push Hook

Automatically runs `pnpm ci:verify`:

- All checks must pass
- Push is blocked if any check fails

**Do not use `--no-verify` to bypass hooks!**

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```bash
git commit -m "feat(auth): add email verification flow"
git commit -m "fix(paywall): resolve unlock modal crash on mobile"
git commit -m "docs: update API documentation"
```

## Code Quality Standards

### ESLint Rules

- Max warnings: 155 (target: reduce to <50)
- No errors allowed
- Auto-fixable issues should be fixed before commit

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` or specific types)
- All exported functions must have explicit return types

### Testing

- Unit test coverage: >70% (target: >90%)
- E2E tests must pass on Chromium
- No flaky tests allowed

## CI/CD Pipeline

### GitHub Actions Workflows

1. **ci.yml** (Required)
   - Lint & Type Check
   - Build
   - QA Gate
   - E2E Tests
   - Quality Gate

2. **code-quality.yml** (Optional)
   - Code quality checks
   - Reviewdog comments

3. **pr-auto-review.yml** (Informational)
   - PR labels
   - Security audits

### Environment Variables in CI

Required secrets in GitHub:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

See `.github/GITHUB_SECRETS_SETUP.md` for details.

## Troubleshooting

### Build Fails Locally

1. Clear Next.js cache:

```bash
rm -rf .next
pnpm build
```

2. Check environment variables:

```bash
cat .env.local
```

3. Ensure Supabase credentials are valid

### E2E Tests Timeout

1. Check if dev server is running on port 3000:

```bash
lsof -i :3000
```

2. Increase timeout in `playwright.config.ts` if needed

3. Run tests with UI mode for debugging:

```bash
pnpm test:e2e:ui
```

### Pre-push Hook Fails

1. Run each check individually to find the issue:

```bash
pnpm lint
pnpm type-check
pnpm build
```

2. Fix all errors before attempting to push

3. **Never use `git push --no-verify`**

## Getting Help

- Check existing issues: [GitHub Issues](link)
- Read documentation: `/docs` folder
- Ask in discussions: [GitHub Discussions](link)
