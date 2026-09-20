# Phase C — 你要亲手做的实钱闭环

代码侧（充值/消费开关、账本、提现申请与审核 UI、对账恒等式）已经合进 `main`。  
**Phase C 不能由 AI 代跑**：真卡 onramp、链上转 USDC、Paxum 出金、冷钱包与 PayRam 节点都只能你操作。

本页是按顺序执行的清单。更完整的商务/基建门槛仍以
[`docs/planning/payram-phase0-validation.md`](../planning/payram-phase0-validation.md)
为准。每一笔实钱步骤都要留证据，放到 `docs/reports/payram-phase0/`。

---

## 0. 谁做什么

| 谁        | 做什么                                                                    | 不做什么                        |
| --------- | ------------------------------------------------------------------------- | ------------------------------- |
| 你        | 真卡、链上、Paxum、VPS/PayRam 后台、Vercel 生产环境变量、把实测数字填回表 | 改资金 RPC / 开关语义           |
| AI / 仓库 | 代码、RPC、API、UI、单测、对账脚本、PR CI                                 | 刷真卡、发链上 USDC、登录 Paxum |

未完成 Gate 1（PayRam 书面确认成人+onramp）之前，**不要对真实用户开旗**。1.1 / 1.2 若被拒，整条轨道作废，换有成人政策的处理器。

---

## 1. 开旗之前必须齐的东西

对照 phase-0 Gate 1 + Gate 2。缺一项就停。

- [ ] PayRam 书面确认：成人平台可用，**含 card onramp**
- [ ] 第三方 onramp 供应商身份 + 其 AUP 允许下游成人消费
- [ ] 书面费率（按地区/金额档）和最低刷卡额
- [ ] VPS 上的 PayRam 已装、HTTPS 证书有效
- [ ] 项目**只开 USDC / Base**，不要第二币或第二链
- [ ] 冷钱包种子离线两处备份，并在一次性钱包上恢复验证过
- [ ] SmartSweep 转到冷钱包，阈值写下来
- [ ] `PAYRAM_BASE_URL` + `PAYRAM_API_KEY` 只在 Vercel / `.env.local`，`PAYRAM_WEBHOOK_SECRET` 留空（验签用项目 API Key）
- [ ] `CRON_SECRET` 已设。结算接口是 `GET /api/cron/settlement`，Header：`Authorization: Bearer $CRON_SECRET`
- [ ] 律师意见：MTL/MSB、代金券税点（见 `docs/planning/legal-counsel-brief.md`）
- [ ] Didit 年龄门：没配好 `AGE_ASSURANCE_SECRET` 就不要开 `AGE_ASSURANCE_ENABLED`

可用向导走完后台点击（它会强制写成 `PAYRAM_ENABLED=false`，配置 ≠ 开旗）：

```bash
bash scripts/payram/setup-wizard.sh
```

---

## 2. Webhook 主机（配错会静默丢钱）

Webhook 是粉丝入账的**唯一**路径。下面两个主机都是错的：

| 主机                                            | 为什么错                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `pay.getfansee.com`                             | 这是 PayRam 自己，没有 `/api/webhooks/payram`，会 404 然后一直重试  |
| `getfansee.com`（apex 仍指第三方 PHP 候补页时） | 会 200，PayRam 以为送达成功、不再重试。钱到了、没入账、没有任何报错 |

正确：Vercel 项目 `getfansee-auth` 的应用源，目前是 `https://demo.getfansee.com/api/webhooks/payram`。

先确认应用活着：

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://demo.getfansee.com/home
```

必须是应用的 200，不是候补页。

---

## 3. 成对打开支付开关

生产环境必须**同时**为真，否则进程启动失败（`lib/payments-live.ts`）：

```
NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED=true
PAYRAM_ENABLED=true
PAYRAM_API_KEY=...
PAYRAM_BASE_URL=https://你的-payram-主机
```

只开一边的后果：

- 只开 PayRam：粉丝能充 USDC，但站内花不出去、也提不出来（资金锁死）
- 只开 `CRYPTO_TOPUP`：付费墙可点，但没有入金通道

Webhook 路由只看 PayRam 是否配置好，关公网旗后，进行中的付款仍能入账。

`STRIPE_FIAT_ENABLED` 保持关。不要在生产开 `NEXT_PUBLIC_TEST_MODE` / `E2E`。

---

## 4. 准备三个账号

| 角色    | 用来干什么                       | 备注                                                                   |
| ------- | -------------------------------- | ---------------------------------------------------------------------- |
| Fan     | 真卡充值、解锁 PPV               | 用美国 IP / 美国卡；欧盟现在不能付                                     |
| Creator | 发一条 PPV、收 pending、申请提现 | `profiles.is_verified` 必须为真，否则提现 API 403；订阅价或 PPV 价 > 0 |
| Admin   | `/admin/withdrawals` 登记已付    | 现有 ops 账号见 `.local/admin-credentials.txt`（勿提交）               |

创作者页：`/creator/studio/earnings`  
审核页：`/admin/withdrawals`  
钱包：`/me/wallet`

---

## 5. 实钱闭环（按这个顺序，不要跳）

每一步截图 + 记下 `reference_id` / 金额 / 时间，归档到 `docs/reports/payram-phase0/`。

### 5.1 下单

登录 Fan，钱包页选 **$20** 档，走 PayRam 托管页。记下：

- 返回的付款 URL
- 我方 `payment_orders.reference_id`
- 页上披露的 onramp 费（必须在点卡之前就能看见）

或（已登录会话）打 `POST /api/payments/payram/create-payment`。

### 5.2 Onramp

真卡买 USDC（Base）。记下：

- 卡上实扣
- 客户自托管钱包实收 USDC
- 差额（这就是以后必须写在充值页上的粉丝成本）

### 5.3 链上付款

把 USDC 转到这次订单的充值地址。等确认。

### 5.4 Webhook 入账

确认：

- 恰好一条 `status=FILLED`（字段是 `status`，不是 `state`）
- 签名对 raw body 成立
- Fan 钱包 `available` **只加一次**，金额是链上实收，不是下单额

```sql
SELECT id, reference_id, status, filled_amount_cents, requested_amount_cents
FROM payment_orders
WHERE reference_id = '<reference_id>';
```

### 5.5 重放

把**同一份** body + 签名再 POST 到 webhook。

- 响应必须带 `idempotent: true`
- 余额不变

本地脚本：

```bash
pnpm payram:replay --reference=<reference_id> --amount=20
```

然后**再看一遍数据库余额**，不要只信 API 文案。

### 5.6 篡改

- 改 `filled_amount_in_usd` 但沿用旧签名 → 必须 401
- 签名有效但金额对不上订单 → 拒绝入账，不能加余额

### 5.7 花出去

用入账余额解锁一条 PPV（或订阅）。核对：

- Fan 扣款
- `consumption_orders` 一行
- 平台费快照 20%（Founding Creator 窗口内为 0）
- Creator **pending** 增加，不是 available

余额不足必须 402，且一行都不写。

### 5.8 结算 pending → available

默认 hold 约 7 天。Phase C 小额可以二选一：

1. 等到 `available_on` 之后，再打结算 cron；或
2. 只把**这一笔**测试账本的 `available_on` 改成现在，再打 cron（不要动真实用户的行）

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://demo.getfansee.com/api/cron/settlement
```

确认该创作者 pending 减少、available 增加。

当前 `vercel.json` 只挂了 `/api/cron/financial-audit`。Phase C 用手动 curl 即可；对真实用户开旗前，应把 `/api/cron/settlement` 也排进 Cron。

### 5.9 创作者申请提现

1. Creator 通过 KYC（`is_verified`）
2. `/creator/studio/earnings` 加收款方式（`payram_crypto` 地址或 Paxum）
3. 申请提现，**最低 $20**（`MINIMUM_PAYOUT_CENTS`）
4. 申请成功后 `available` **立刻减少**；`creator_ledger` 会有一笔负数 `payout`，状态必须保持 `available`

此时钱还在你这边，只是账上冻结了。

### 5.10 你先打款，管理员再记账

顺序不能反：

1. 链上 USDC 或 Paxum **先把钱打给创作者**
2. 记下外部单号 / tx hash
3. 登录 Admin → `/admin/withdrawals` → Approve，填 `external_reference`
4. 拒绝则填原因；拒绝会把钱退回 creator `available`，ledger 置 `void`

批准时**不要**把 ledger 行改成 `paid`，否则对账恒等式 #3 会永久失衡。UI / RPC 已经按这个规则写了。

### 5.11 Off-ramp 费率（可选但建议）

若走 USDC → P2P → Paxum，记下点差、到账时间、Paxum 入金费、打给创作者的手续费。这些数字替换 phase-0 表里的估算。

### 5.12 对账

```bash
pnpm reconcile:report
pnpm reconcile:full
```

五条差额都必须是 **0**（整数分，没有四舍五入）：

1. `credited_deposits_match_orders`
2. `consumption_splits_balance`
3. `creator_ledger_matches_wallets`
4. `fan_liability_matches_balances`
5. `payouts_match_ledger`（已付提现合计 = 已挂 `payout_batches` 的负数 payout ledger）

任何非零都要逐笔解释。线上若仍有历史 mock/测试数据造成的旧差额，先把测试账和实钱账分开看，不要用旧脏数据当「新闭环失败」。

---

## 6. 必须记下来的数字

填回 [`payram-phase0-validation.md`](../planning/payram-phase0-validation.md) 的表：

| 指标                     | 估算   | 实测 |
| ------------------------ | ------ | ---- |
| $20 档卡上实扣           | ~$21   |      |
| 客户钱包实收 USDC        | $20.00 |      |
| Base gas                 | ≈$0    |      |
| 刷卡 → webhook 入账耗时  | —      |      |
| P2P off-ramp 点差        | ~1%    |      |
| Paxum 入金费             | —      |      |
| Paxum 打给创作者的手续费 | —      |      |

---

## 7. 什么时候才能对真实用户开旗

Gate 4，缺一条就停：

- [ ] Gate 1–3 做完，证据在 `docs/reports/payram-phase0/`
- [ ] 律师 MTL/MSB + 税点有书面答复
- [ ] Didit 年龄门在生产打开且密钥 ≥ 32 字符
- [ ] 一次完整结算周期后，五条对账恒等式为 0
- [ ] `pnpm check-all && pnpm build && pnpm qa:gate` 绿

开旗时仍必须成对设置第 3 节那四个变量。不要只改一个。

---

## 8. 失败时怎么停

- Webhook 对不上 / 入账两次 / 重放还加余额 → 立刻关 `PAYRAM_ENABLED` 和 `NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED`（成对关）。进行中的付款仍可能入账，这是故意的。
- 提现打错地址 → 不要在 Admin 点 Approve；先走拒绝退回 available，再人工处理。
- 对账非零 → 不许开公测，逐笔查 `payment_orders` / `consumption_orders` / `creator_ledger` / `withdrawal_requests`。
