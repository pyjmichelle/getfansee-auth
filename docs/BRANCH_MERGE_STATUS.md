# 分支合并与功能状态

## 当前状态（一句话）

- **代码推送**：`feature/add-readme-badge` 上共 **33 个 commit** 已全部**成功推送到远程**（含 comments 修复 + atomic-unlock 轮询修复）。
- **合并到 main**：**尚未合并**，所以 Vercel 生产环境还看不到这些改动。
- **你“真正能看见”的时间**：**PR 合并到 main 之后约 1～3 分钟**（Vercel 自动部署）。

---

## 一、什么时候合并到 main？

**建议：CI 全绿再合并。**

1. 在 GitHub 打开：**Pull Request**（`feature/add-readme-badge` → `main`）。
2. 看 **Checks**：
   - Lint & Type Check ✅
   - Build ✅
   - QA Gate (ui + deadclick) ✅
   - E2E Tests (chromium) ✅
   - Quality Gate ✅
3. **全部通过** → 点 **Merge pull request**，合并到 main。
4. 合并后 1～3 分钟内，Vercel 会部署 main，你在 Vercel 上就能看到最新版本。

若 E2E 或 QA Gate 有失败，先看失败 job 的日志，修完再推同一分支，等 CI 再次全绿后合并。

---

## 二、哪些代码“推上去成功了”、哪些没有？

| 类型                            | 状态      | 说明                                                      |
| ------------------------------- | --------- | --------------------------------------------------------- |
| 推到 `feature/add-readme-badge` | ✅ 成功   | 32 个 commit 都已推送到 `origin/feature/add-readme-badge` |
| 合并到 `main`                   | ❌ 未做   | 需要你在 GitHub 上 Merge PR                               |
| 部署到 Vercel 生产              | ⏳ 未发生 | 合并 main 后会自动部署                                    |

**结论**：

- “推上去成功” = 远程分支上的代码都在，没有漏推。
- “还没有” = 还没合并到 main，所以生产环境（Vercel）还没这批代码。

---

## 三、这些代码代表哪些功能？哪些“成功了”、哪些没有？

### 1. 产品功能（用户能直接感受到）

| 功能                                               | 对应 commit / 改动                               | 推送到分支 | 合并 main | 线上可见 |
| -------------------------------------------------- | ------------------------------------------------ | ---------- | --------- | -------- |
| 帖子详情页点击「Unlock」/「Subscribe」打开支付弹窗 | `b69334c`：PaywallModal 绑定 + refetchCanView    | ✅         | ❌        | ❌       |
| 购买记录 API、交易记录 API                         | `b69334c`：`/api/purchases`、`/api/transactions` | ✅         | ❌        | ❌       |
| 购买页在测试模式下加载真实数据                     | `d5143e5`：purchases 页 CI 行为                  | ✅         | ❌        | ❌       |

**“成功了”**：指这些功能在 **feature 分支上已经实现并推上去了**。  
**“没有”**：指还没合并到 main，所以 **Vercel 生产环境还看不到**。

### 2. E2E / 测试与数据（保障质量，用户无感）

| 功能                                                       | 说明                                     | 推送到分支 | 合并 main |
| ---------------------------------------------------------- | ---------------------------------------- | ---------- | --------- |
| atomic-unlock / money-flow paywall 超时与流程              | 帖子详情 PaywallModal 出现、解锁流程     | ✅         | ❌        |
| complete-journey / edge-cases / paywall-flow / sprint4-mvp | 完整流程、边界、付费流程、购买历史等 E2E | ✅         | ❌        |
| fixtures：wallet_accounts、transactions                    | E2E 测试数据与 API 一致                  | ✅         | ❌        |

这些都不影响“用户在 Vercel 上能点什么”，只影响 CI 和测试是否稳定。

### 3. CI / QA / 文档（开发与部署体验）

| 类别                        | 说明                                              | 推送到分支 |
| --------------------------- | ------------------------------------------------- | ---------- |
| CI 流程                     | QA Gate 分步、check-server、audit、session 创建等 | ✅         |
| README 徽章与文档           | CI 状态徽章、监控计划、合并清单等                 | ✅         |
| pre-push / pnpm 10 / 锁文件 | 本地检查与 CI 一致                                | ✅         |

同样：都已推上 feature 分支，未合并 main，Vercel 上“看不见”这些（它们只影响仓库和 CI）。

---

## 四、功能维度：哪些“成功了”、哪些“没有”

- **在“代码已写好并推上 feature 分支”这个意义上**：
  - 帖子详情 Unlock/Subscribe 弹窗、购买与交易 API、购买页测试模式行为、E2E 与 CI 相关改动，**都算成功了**（都在远程分支上）。
- **在“用户能在线上（Vercel）用到”这个意义上**：
  - **都还没有**，因为还没合并到 main，Vercel 部署的是 main。

所以：

- **功能开发 / 推送**：✅ 已完成并成功推送。
- **功能上线（Vercel 可见）**：❌ 未完成，差一步「合并到 main」。

---

## 五、还要多久可以真正看见？

| 步骤                                   | 预计耗时               | 说明                               |
| -------------------------------------- | ---------------------- | ---------------------------------- |
| 1. 在 GitHub 合并 PR（feature → main） | 你操作 1 分钟内        | 建议 CI 全绿后再点 Merge           |
| 2. Vercel 检测到 main 更新并部署       | 约 1～3 分钟           | 自动，无需你再操作                 |
| 3. 在 Vercel 上看到新版本              | 合并后约 **2～4 分钟** | 看 Vercel 的 Production Deployment |

**总结**：

- **合并时机**：CI 全绿后即可合并。
- **“真正看见”的时间**：从你点击 Merge 算起，大约 **2～4 分钟** 就能在 Vercel 上看到（并可用帖子详情页的 Unlock/Subscribe 弹窗等新功能）。

---

## 六、建议操作顺序

1. 打开 GitHub 仓库 → **Pull Requests** → 找到 `feature/add-readme-badge` → `main` 的 PR。
2. 看 **Checks** 是否全部通过；若有失败，根据日志修完再推。
3. 全部通过后 → **Merge pull request**。
4. 等 2～4 分钟 → 打开 Vercel 项目 → **Deployments**，看最新 Production 部署完成即可。

文档生成时间：可根据 `git log -1 --format=%ci` 填写。
