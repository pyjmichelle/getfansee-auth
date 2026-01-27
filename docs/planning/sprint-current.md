# Sprint Plan – Current

## Sprint Goal

- Maintain green CI/CD gates
- Stabilize auth, build, and Playwright pipeline

## Active Tasks

### P0 – 审查代码并修复以确保 CI 全绿

- Scope:
  - 代码审查与关键缺陷修复
  - CI/质量门禁与测试稳定性
  - 不改变产品需求或范围
- Acceptance Criteria:
  - 识别并修复阻塞 CI 的问题
  - 本地关键门禁命令通过（见 Required Gates）
- Required Gates:
  - pnpm check-all
  - pnpm build
  - pnpm qa:gate
  - pnpm exec playwright test --project=chromium

### P0 – Fix Playwright chromium gate (next/font Google fetch)

- Scope:
  - Playwright webServer / test config only
  - No product or runtime behavior changes
- Acceptance Criteria:
  - `pnpm exec playwright test --project=chromium` passes in CI/offline
- Required Gates:
  - pnpm check-all
  - pnpm build
  - pnpm qa:gate
  - pnpm exec playwright test --project=chromium

---

### P1 – Kernel & Planning normalization

- Scope:
  - Replace hard-coded sprint file dependency
  - Enforce unblock-first planning rule
- Acceptance Criteria:
  - No task blocked by missing planning file
