---
name: code-check
description: 运行项目代码质量检查（type-check、lint、format、安全脚本），汇总结果并给出修复建议。当用户说「检查代码」「跑检查」「code check」「run checks」时使用。
---

# Code Check Skill（代码检查）

在用户要求**检查代码**、**跑质量检查**、**code check**、**run checks** 时使用本 skill。按项目规范执行本地质量门并汇报结果。

## 触发词

- 检查代码、跑检查、跑一下检查、质量检查
- check code、code check、run checks、run check-all
- 代码有没有问题、类型检查、lint 一下
- 推送前检查、release gate

## 执行步骤

### 1. 运行完整质量门

必须执行（与 CI / 推送前一致）：

```bash
pnpm check-all
```

包含：`type-check` → `lint` → `format:check` → `check:service-role` → `check:admin-client`。

### 2. 汇总结果

- **全部通过**：明确写出「✅ 所有检查通过，可以推送」；可附带耗时。
- **有失败**：
  - 逐项列出失败步骤（如 TypeScript 错误、ESLint 规则、格式、脚本检查）。
  - 给出**具体修复建议**（例如：`pnpm lint:fix`、`pnpm format`、修某文件某行）。
  - 不要只说「应该能修好」，要基于实际命令输出说明。

### 3. 可选：构建检查

若用户明确要「连 build 一起检查」或「完整验证」，再执行：

```bash
pnpm build
```

并在汇总中说明 build 是否通过。

## 规则

- 必须贴出或概括**真实命令输出**（通过/失败、错误条数、首条错误信息）。
- 失败时优先建议自动修复：`pnpm lint:fix`、`pnpm format`；再建议手动改类型/逻辑。
- 与 `.cursor/rules` 中的 RELEASE GATE / check-all 一致：未通过 check-all 不得建议推送。

## 输出模板（通过时）

```text
## 代码检查结果 ✅

- type-check: 通过
- lint: 通过
- format:check: 通过
- check:service-role: 通过
- check:admin-client: 通过

**结论**：所有检查通过，可以推送。推送前 pre-push hook 会再次运行相同检查。
```

## 输出模板（失败时）

```text
## 代码检查结果 ❌

- type-check: 通过
- lint: **失败** — [简述原因，如 ESLint 规则 x 在 file:line]
- ...

**建议**：
1. [具体命令或修改建议]
2. 修复后请再次运行 `pnpm check-all`。
```
