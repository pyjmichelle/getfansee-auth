# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

GetFanSee is a monolithic Next.js 16 (React 19) creator-fan content platform. All backend logic runs as Next.js API routes; the sole critical external dependency is **Supabase** (PostgreSQL, Auth, Storage).

### Environment Variables

A `.env.local` file is required. Copy from `env.ci.template` and fill in real Supabase credentials. The three required variables are:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Without real Supabase credentials, the UI loads but auth/data flows return "Failed to fetch" errors.

### Key Commands (see `package.json` scripts for full list)

| Task              | Command                                         |
| ----------------- | ----------------------------------------------- |
| Dev server        | `pnpm dev` (port 3000)                          |
| Type-check        | `pnpm type-check`                               |
| Lint              | `pnpm lint`                                     |
| Format check      | `pnpm format:check`                             |
| Full local checks | `pnpm check-all`                                |
| Build             | `pnpm build`                                    |
| Unit tests        | `pnpm test:unit` (vitest)                       |
| E2E tests         | `pnpm test:e2e` (Playwright, requires Chromium) |

### Gotchas & Non-obvious Notes

- **pnpm build scripts**: The repository needs `pnpm.onlyBuiltDependencies` configured in `package.json` to allow esbuild, sharp, @sentry/cli, and agent-browser post-install scripts. Without this, `tsx` and `vitest` will not work because esbuild won't have its platform binary.
- **Husky pre-push hook** runs `SKIP_QA_GATE=1 pnpm ci:verify` which includes lint, type-check, and build. Use `git push --no-verify` only if explicitly needed (discouraged by project rules).
- **Unit tests** (vitest): Many tests fail without real Supabase credentials because the mocking layer expects a functioning Supabase client. 6/33 tests pass with placeholder credentials.
- **Playwright browsers**: Only Chromium is needed for the default E2E project. Install with `pnpm exec playwright install --with-deps chromium`.
- **Next.js config**: Sentry integration is conditionally enabled only when `NEXT_PUBLIC_SENTRY_DSN` is set. Without it, the app runs normally.
- **The root route (`/`)** redirects (307) to `/auth`. This is expected behavior.
- **ESLint max-warnings**: The lint command enforces `--max-warnings=155`. New warnings beyond this threshold will cause lint failure.
