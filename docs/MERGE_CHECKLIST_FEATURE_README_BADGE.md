# 合并 `feature/add-readme-badge` 到 main — 检查清单

**分支**: `feature/add-readme-badge`  
**最新提交**: `ae6ca34` — fix(audit): make audit:full more resilient in CI when sessions are missing  
**远程**: `origin` → `pyjmichelle/getfansee-auth`

---

## 本地验证（已完成）

- [x] `pnpm check-all` — 通过（type-check, lint, format:check）
- [x] `pnpm build` — 通过
- [x] 代码已推送到 `origin feature/add-readme-badge`

---

## 在 GitHub 上完成合并

### 1. 查看 CI 状态

1. 打开 **Actions**：<https://github.com/pyjmichelle/getfansee-auth/actions>
2. 找到针对分支 **feature/add-readme-badge**（或对应 PR）的最新 workflow run。
3. 确认以下 job 均为绿色：
   - **Lint & Type Check**
   - **Build**
   - **QA Gate (ui + deadclick)**（含 Create test sessions → Check server → gate-ui → gate-deadclick → audit:full）
   - **E2E Tests (chromium)**

若 **QA Gate** 仍失败：点进该 job，看是哪一个 step 失败（Create test sessions / Check server / gate-ui / gate-deadclick / audit:full），把 step 名和日志最后几行贴给助手，便于针对性修。

### 2. 打开 PR 并合并

1. 打开 **Pull requests**：<https://github.com/pyjmichelle/getfansee-auth/pulls>
2. 找到 **base: main ← compare: feature/add-readme-badge** 的 PR。
3. 若所有必需检查通过，**Merge pull request** 会可点：
   - 可选 **Squash and merge** 或 **Create a merge commit**，按仓库惯例选择。
   - 点击 **Merge pull request**，确认合并。

### 3. 合并后（可选）

```bash
git checkout main
git pull origin main
# 如需删除远程分支：
# git push origin --delete feature/add-readme-badge
# 本地删除：
# git branch -d feature/add-readme-badge
```

---

## 若未安装 GitHub CLI 又想用命令行合并

安装 `gh` 后可在本机执行：

```bash
# 安装 gh: https://cli.github.com/
# 然后登录: gh auth login

cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
gh pr list --base main --head feature/add-readme-badge
gh pr checks  # 在 PR 分支下运行，查看检查状态
gh pr merge --squash  # 或 --merge，在 PR 分支下运行
```

---

_生成自合并流程辅助。_
