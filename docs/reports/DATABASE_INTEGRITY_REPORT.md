# DATABASE INTEGRITY REPORT

**Generated:** 2026-03-10  
**Agent:** Database Integrity Agent  
**Scope:** Schema, Migrations, Types, Financial Transactions

---

## EXECUTIVE SUMMARY

**Overall Risk Level:** 🟡 MEDIUM-HIGH

**Critical Findings:** 6  
**High Priority:** 8  
**Medium Priority:** 5  
**Low Priority:** 3

**Financial Safety Status:** ⚠️ NEEDS ATTENTION

核心财务链路（wallet recharge / PPV unlock / creator earnings / withdrawals）存在多个完整性风险，包括缺失索引、nullable 字段风险、事务安全性不足、以及潜在的 race condition。

---

## 1. FOREIGN KEY CONSISTENCY

### 🔴 CRITICAL-01: purchases.fan_id 与 purchases.post_id 外键不一致

**Severity:** P0  
**File:** `migrations/013_money_access_mvp.sql:189-196`, `migrations/030_financial_schema_hardening.sql:179`  
**Code Reference:**

```sql
-- 013_money_access_mvp.sql
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  paid_amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(fan_id, post_id)
);

-- 030_financial_schema_hardening.sql
INSERT INTO public.purchases (fan_id, post_id, paid_amount_cents, idempotency_key)
VALUES (p_user_id, p_post_id, v_price_cents, v_computed_idempotency_key)
```

**Impact:**

- `purchases.fan_id` 引用 `auth.users(id)`，但其他表（如 `subscriptions`）使用不同的用户 ID 列名（`subscriber_id`）
- 当用户被删除时，`ON DELETE CASCADE` 会级联删除购买记录，但不会回滚已扣除的钱包余额
- 财务记录丢失风险：用户删除 → 购买记录消失 → 无法追溯交易

**Recommended Fix:**

```sql
-- 1. 添加软删除标记，防止硬删除导致财务记录丢失
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- 2. 修改外键为 SET NULL 而非 CASCADE（保留财务记录）
ALTER TABLE public.purchases
DROP CONSTRAINT IF EXISTS purchases_fan_id_fkey;

ALTER TABLE public.purchases
ALTER COLUMN fan_id DROP NOT NULL;

ALTER TABLE public.purchases
ADD CONSTRAINT purchases_fan_id_fkey
FOREIGN KEY (fan_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. 添加审计触发器记录删除操作
CREATE TABLE IF NOT EXISTS public.purchases_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  fan_id uuid,
  post_id uuid,
  paid_amount_cents bigint,
  operation text NOT NULL,
  operated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
```

**Evidence:** 直接读取 migration 文件确认

---

### 🔴 CRITICAL-02: transactions 表缺少外键约束

**Severity:** P0  
**File:** `migrations/018_feature_completion.sql:68-78`  
**Code Reference:**

```sql
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'subscription', 'ppv_purchase', 'commission', 'payout')),
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  available_on timestamptz NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
```

**Impact:**

- `metadata` 中存储的 `post_id`, `creator_id`, `purchase_id` 等关联 ID 没有外键约束
- 当关联记录被删除时，`transactions` 表中的 `metadata` 变成悬空引用
- 无法通过数据库层面保证引用完整性
- 财务审计时无法追溯已删除的 post/creator

**Recommended Fix:**

```sql
-- 方案 1: 添加显式外键列（推荐）
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS related_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS related_creator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS related_purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_related_post
ON public.transactions(related_post_id) WHERE related_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_related_creator
ON public.transactions(related_creator_id) WHERE related_creator_id IS NOT NULL;

-- 方案 2: 使用触发器验证 metadata 引用（备选）
CREATE OR REPLACE FUNCTION validate_transaction_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.metadata ? 'post_id' THEN
    IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = (NEW.metadata->>'post_id')::uuid) THEN
      RAISE EXCEPTION 'Invalid post_id in metadata: %', NEW.metadata->>'post_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_transaction_metadata_trigger
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION validate_transaction_metadata();
```

**Evidence:** 直接读取 migration 文件确认

---

### 🟡 HIGH-01: wallet_accounts.user_id 缺少唯一索引（已有 UNIQUE 约束但应加速查询）

**Severity:** P1  
**File:** `migrations/018_feature_completion.sql:39-47`  
**Code Reference:**

```sql
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance_cents bigint NOT NULL DEFAULT 0,
  pending_balance_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id)  -- 有约束但缺少显式索引
);
```

**Impact:**

- 虽然有 `UNIQUE(user_id)` 约束（会自动创建索引），但在高并发场景下可能不够优化
- `SELECT FOR UPDATE` 操作频繁时可能产生锁竞争

**Recommended Fix:**

```sql
-- 显式创建覆盖索引（包含常用查询字段）
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_balance
ON public.wallet_accounts(user_id, available_balance_cents, pending_balance_cents);

-- 添加部分索引（仅索引有余额的账户）
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_active
ON public.wallet_accounts(user_id)
WHERE available_balance_cents > 0 OR pending_balance_cents > 0;
```

**Evidence:** 直接读取 migration 文件确认

---

## 2. MISSING INDEXES

### 🔴 CRITICAL-03: transactions 表缺少复合索引（财务查询性能风险）

**Severity:** P0  
**File:** `migrations/018_feature_completion.sql:83-84`  
**Code Reference:**

```sql
CREATE INDEX IF NOT EXISTS idx_transactions_user_type
ON public.transactions(user_id, type, created_at DESC);
```

**Impact:**

- 缺少 `(user_id, status, available_on)` 复合索引，creator earnings 查询会全表扫描
- 缺少 `(type, status, created_at)` 索引，财务审计查询效率低
- 在 `lib/paywall.ts:204-210` 中的 `getCreatorEarnings` 查询使用 `OR` 条件，无法有效利用现有索引

**Recommended Fix:**

```sql
-- 1. Creator earnings 查询优化
CREATE INDEX IF NOT EXISTS idx_transactions_creator_earnings
ON public.transactions(user_id, type, status, created_at DESC)
WHERE type IN ('ppv_revenue', 'subscription', 'commission');

-- 2. 财务结算查询优化（pending → available）
CREATE INDEX IF NOT EXISTS idx_transactions_settlement
ON public.transactions(status, available_on, type)
WHERE status = 'pending' AND available_on IS NOT NULL;

-- 3. 幂等性查询优化（recharge_wallet 中的快速返回路径）
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency
ON public.transactions(user_id, type, status, ((metadata->>'idempotency_key')))
WHERE metadata ? 'idempotency_key';

-- 4. 财务审计查询优化
CREATE INDEX IF NOT EXISTS idx_transactions_audit
ON public.transactions(type, status, created_at DESC);
```

**Evidence:**

- `lib/paywall.ts:204-210` - getCreatorEarnings 使用 OR 查询
- `migrations/030_financial_schema_hardening.sql:276-286` - recharge_wallet 幂等性查询

---

### 🔴 CRITICAL-04: purchases 表缺少关键索引

**Severity:** P0  
**File:** `migrations/013_money_access_mvp.sql:189-196`  
**Code Reference:**

```sql
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  paid_amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(fan_id, post_id)  -- 只有这一个索引
);
```

**Impact:**

- 缺少 `(post_id, created_at)` 索引，查询某个 post 的购买记录时效率低
- 缺少 `(fan_id, created_at)` 索引，用户购买历史查询慢（`app/api/purchases/route.ts:17-34`）
- 缺少 `(idempotency_key)` 索引（虽然 migration 030 添加了，但不在主表定义中）

**Recommended Fix:**

```sql
-- 1. 用户购买历史查询优化
CREATE INDEX IF NOT EXISTS idx_purchases_fan_created
ON public.purchases(fan_id, created_at DESC);

-- 2. Post 购买统计查询优化
CREATE INDEX IF NOT EXISTS idx_purchases_post_created
ON public.purchases(post_id, created_at DESC);

-- 3. 财务对账查询优化（按金额和时间）
CREATE INDEX IF NOT EXISTS idx_purchases_amount_created
ON public.purchases(paid_amount_cents, created_at DESC);

-- 4. 确保 idempotency_key 索引存在
CREATE INDEX IF NOT EXISTS idx_purchases_idempotency_key
ON public.purchases(idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

**Evidence:**

- `app/api/purchases/route.ts:17-34` - 用户购买记录查询
- `migrations/030_financial_schema_hardening.sql:26-27` - idempotency_key 索引

---

### 🟡 HIGH-02: subscriptions 表缺少状态过滤索引

**Severity:** P1  
**File:** `migrations/008_phase2_paywall.sql:36-45`  
**Code Reference:**

```sql
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  starts_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(subscriber_id, creator_id)
);
```

**Impact:**

- 缺少 `(status, current_period_end)` 索引，过期订阅清理任务效率低
- 缺少 `(creator_id, status, current_period_end)` 索引，creator 订阅者列表查询慢

**Recommended Fix:**

```sql
-- 1. 过期订阅清理任务优化
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry
ON public.subscriptions(status, current_period_end)
WHERE status = 'active';

-- 2. Creator 订阅者列表查询优化
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_active
ON public.subscriptions(creator_id, status, current_period_end DESC)
WHERE status = 'active';

-- 3. 用户订阅状态批量查询优化
CREATE INDEX IF NOT EXISTS idx_subscriptions_fan_active
ON public.subscriptions(subscriber_id, status, current_period_end)
WHERE status = 'active';
```

**Evidence:** `lib/paywall.ts:278-285` - isActiveSubscriber 查询

---

## 3. NULLABLE 风险

### 🔴 CRITICAL-05: transactions.metadata 为 nullable（财务追溯风险）

**Severity:** P0  
**File:** `migrations/018_feature_completion.sql:75`  
**Code Reference:**

```sql
metadata jsonb,  -- nullable，但财务交易必须有元数据
```

**Impact:**

- PPV 购买、充值、提现等财务交易的 `metadata` 可能为 NULL
- 无法追溯交易来源（post_id, creator_id, idempotency_key 等）
- 财务审计时缺失关键信息
- 在 `migrations/030_financial_schema_hardening.sql:196-208` 中，PPV 购买交易强制写入 metadata，但没有约束保证

**Recommended Fix:**

```sql
-- 1. 添加 NOT NULL 约束（对新记录）
ALTER TABLE public.transactions
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- 2. 回填现有 NULL 值
UPDATE public.transactions
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- 3. 添加约束（确保关键交易类型必须有 metadata）
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_metadata_required
CHECK (
  (type NOT IN ('ppv_purchase', 'ppv_revenue', 'deposit', 'withdrawal') OR metadata IS NOT NULL)
);

-- 4. 添加 metadata 字段验证约束
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_metadata_ppv_fields
CHECK (
  (type != 'ppv_purchase' OR (
    metadata ? 'post_id' AND
    metadata ? 'creator_id' AND
    metadata ? 'purchase_id'
  ))
);

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_metadata_deposit_fields
CHECK (
  (type != 'deposit' OR metadata ? 'idempotency_key')
);
```

**Evidence:**

- `migrations/030_financial_schema_hardening.sql:196-208` - PPV 购买 metadata
- `migrations/030_financial_schema_hardening.sql:305-314` - 充值 metadata

---

### 🟡 HIGH-03: wallet_accounts 余额字段无 CHECK 约束（负余额风险）

**Severity:** P1  
**File:** `migrations/018_feature_completion.sql:42-43`  
**Code Reference:**

```sql
available_balance_cents bigint NOT NULL DEFAULT 0,
pending_balance_cents bigint NOT NULL DEFAULT 0,
-- 缺少 CHECK (available_balance_cents >= 0)
```

**Impact:**

- 虽然业务逻辑中有余额检查（`migrations/030_financial_schema_hardening.sql:169-176`），但数据库层面没有约束
- 如果业务逻辑有 bug 或直接 SQL 更新，可能产生负余额
- 财务对账时无法依赖数据库约束保证数据正确性

**Recommended Fix:**

```sql
-- 1. 添加余额非负约束
ALTER TABLE public.wallet_accounts
ADD CONSTRAINT wallet_accounts_balance_non_negative
CHECK (available_balance_cents >= 0 AND pending_balance_cents >= 0);

-- 2. 添加余额合理性约束（防止异常大额）
ALTER TABLE public.wallet_accounts
ADD CONSTRAINT wallet_accounts_balance_reasonable
CHECK (
  available_balance_cents <= 100000000000 AND  -- 1,000,000 USD
  pending_balance_cents <= 100000000000
);

-- 3. 添加审计触发器（记录余额变更）
CREATE TABLE IF NOT EXISTS public.wallet_balance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  balance_before_cents bigint,
  balance_after_cents bigint,
  change_cents bigint,
  operation text NOT NULL,
  operated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION audit_wallet_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.available_balance_cents != NEW.available_balance_cents THEN
    INSERT INTO public.wallet_balance_audit (
      user_id,
      balance_before_cents,
      balance_after_cents,
      change_cents,
      operation
    ) VALUES (
      NEW.user_id,
      OLD.available_balance_cents,
      NEW.available_balance_cents,
      NEW.available_balance_cents - OLD.available_balance_cents,
      TG_OP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_wallet_balance_trigger
AFTER UPDATE ON public.wallet_accounts
FOR EACH ROW EXECUTE FUNCTION audit_wallet_balance_change();
```

**Evidence:**

- `migrations/030_financial_schema_hardening.sql:169-176` - 业务层余额检查
- `migrations/018_feature_completion.sql:42-43` - 表定义

---

### 🟡 MEDIUM-01: purchases.idempotency_key 为 nullable

**Severity:** P2  
**File:** `migrations/030_financial_schema_hardening.sql:11-12`  
**Code Reference:**

```sql
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;  -- nullable
```

**Impact:**

- 旧的购买记录可能没有 idempotency_key
- 无法区分是否为幂等重试
- 在 `migrations/030_financial_schema_hardening.sql:110-127` 中，幂等性检查依赖 idempotency_key，但没有保证所有记录都有

**Recommended Fix:**

```sql
-- 1. 回填旧记录的 idempotency_key
UPDATE public.purchases
SET idempotency_key = 'legacy_' || id::text
WHERE idempotency_key IS NULL;

-- 2. 添加 NOT NULL 约束
ALTER TABLE public.purchases
ALTER COLUMN idempotency_key SET NOT NULL;

-- 3. 添加默认值生成函数
CREATE OR REPLACE FUNCTION generate_purchase_idempotency_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.idempotency_key IS NULL THEN
    NEW.idempotency_key := 'auto_' || NEW.id::text || '_' || EXTRACT(EPOCH FROM NOW())::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_purchase_idempotency_key_trigger
BEFORE INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION generate_purchase_idempotency_key();
```

**Evidence:** `migrations/030_financial_schema_hardening.sql:110-127` - 幂等性检查逻辑

---

## 4. TRANSACTION SAFETY

### 🔴 CRITICAL-06: unlock_ppv 函数缺少 SERIALIZABLE 隔离级别

**Severity:** P0  
**File:** `migrations/030_financial_schema_hardening.sql:65-237`  
**Code Reference:**

```sql
CREATE OR REPLACE FUNCTION public.unlock_ppv(
  p_post_id UUID,
  p_user_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- 缺少 SET default_transaction_isolation = 'serializable'
AS $$
```

**Impact:**

- 在高并发场景下，两个并发请求可能同时通过余额检查
- 可能导致余额扣减两次（double spending）
- 虽然有 `SELECT FOR UPDATE` 锁（line 167），但在 `READ COMMITTED` 隔离级别下仍有 race condition 风险
- 幂等性检查（line 110-127）在并发场景下可能失效

**Recommended Fix:**

```sql
-- 方案 1: 使用 SERIALIZABLE 隔离级别（推荐）
CREATE OR REPLACE FUNCTION public.unlock_ppv(
  p_post_id UUID,
  p_user_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET default_transaction_isolation = 'serializable'  -- 添加此行
AS $$
-- ... 函数体保持不变 ...
$$;

-- 方案 2: 使用 advisory lock（备选）
CREATE OR REPLACE FUNCTION public.unlock_ppv(
  p_post_id UUID,
  p_user_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  -- ... 其他变量 ...
BEGIN
  -- 生成锁 key（基于 user_id + post_id）
  v_lock_key := ('x' || substr(md5(p_user_id::text || p_post_id::text), 1, 16))::bit(64)::bigint;

  -- 获取 advisory lock（自动在事务结束时释放）
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- ... 原有逻辑 ...
END;
$$;

-- 方案 3: 使用唯一约束防止重复购买（最安全）
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_fan_post_active
ON public.purchases(fan_id, post_id)
WHERE deleted_at IS NULL;

-- 在 INSERT 时捕获 unique_violation 异常
-- （已在 migrations/030_financial_schema_hardening.sql:179 实现，但需要异常处理）
```

**Evidence:**

- `migrations/030_financial_schema_hardening.sql:162-167` - SELECT FOR UPDATE
- `migrations/030_financial_schema_hardening.sql:110-127` - 幂等性检查

---

### 🟡 HIGH-04: recharge_wallet 函数的幂等性实现不完整

**Severity:** P1  
**File:** `migrations/030_financial_schema_hardening.sql:247-341`  
**Code Reference:**

```sql
-- 快速幂等返回路径（line 276-295）
IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
  SELECT wa.available_balance_cents
  INTO v_existing_balance
  FROM public.transactions t
  LEFT JOIN public.wallet_accounts wa ON wa.user_id = t.user_id
  WHERE t.user_id = p_user_id
    AND t.type = 'deposit'
    AND t.status = 'completed'
    AND t.metadata->>'idempotency_key' = p_idempotency_key
  ORDER BY t.created_at DESC
  LIMIT 1;
  -- ... 返回 ...
END IF;

-- 主逻辑（line 297-328）
INSERT INTO public.wallet_accounts ...
BEGIN
  INSERT INTO public.transactions ...
EXCEPTION
  WHEN unique_violation THEN
    -- 捕获唯一约束冲突，返回当前余额
    -- ... 返回 ...
END;
```

**Impact:**

- 快速返回路径使用 `LEFT JOIN`，如果 wallet_accounts 不存在会返回 NULL
- 异常处理只捕获 `unique_violation`，其他异常会导致事务回滚但钱包余额已更新
- 在 line 297-302 的 `ON CONFLICT DO UPDATE` 和 line 305-315 的 `INSERT` 之间没有原子性保证

**Recommended Fix:**

```sql
CREATE OR REPLACE FUNCTION public.recharge_wallet(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET default_transaction_isolation = 'serializable'  -- 添加隔离级别
AS $$
DECLARE
  v_new_balance BIGINT;
  v_existing_balance BIGINT;
  v_transaction_id UUID;
BEGIN
  -- 1. 参数验证
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized: caller identity mismatch'
    );
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid amount'
    );
  END IF;

  -- 2. 幂等性检查（使用 INNER JOIN 确保 wallet 存在）
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT wa.available_balance_cents, t.id
    INTO v_existing_balance, v_transaction_id
    FROM public.transactions t
    INNER JOIN public.wallet_accounts wa ON wa.user_id = t.user_id  -- 改为 INNER JOIN
    WHERE t.user_id = p_user_id
      AND t.type = 'deposit'
      AND t.status = 'completed'
      AND t.metadata->>'idempotency_key' = p_idempotency_key
    ORDER BY t.created_at DESC
    LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
      RETURN json_build_object(
        'success', true,
        'balance_cents', v_existing_balance,
        'idempotent', true,
        'transaction_id', v_transaction_id
      );
    END IF;
  END IF;

  -- 3. 原子操作：先插入 transaction（利用唯一索引防重），再更新余额
  BEGIN
    v_transaction_id := gen_random_uuid();
    INSERT INTO public.transactions (id, user_id, type, amount_cents, status, metadata)
    VALUES (
      v_transaction_id,
      p_user_id,
      'deposit',
      p_amount_cents,
      'completed',
      json_build_object(
        'payment_method', 'mock',
        'idempotency_key', p_idempotency_key
      )::jsonb
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- 并发冲突，返回已存在的交易结果
      SELECT wa.available_balance_cents
      INTO v_existing_balance
      FROM public.wallet_accounts wa
      WHERE wa.user_id = p_user_id;

      RETURN json_build_object(
        'success', true,
        'balance_cents', COALESCE(v_existing_balance, 0),
        'idempotent', true
      );
  END;

  -- 4. 更新钱包余额（transaction 已插入，此处失败会回滚）
  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, p_amount_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_new_balance;

  RETURN json_build_object(
    'success', true,
    'balance_cents', v_new_balance,
    'idempotent', false,
    'transaction_id', v_transaction_id
  );
END;
$$;
```

**Evidence:**

- `migrations/030_financial_schema_hardening.sql:276-328` - recharge_wallet 实现
- `migrations/030_financial_schema_hardening.sql:52-60` - 幂等性唯一索引

---

### 🟡 MEDIUM-02: 缺少分布式事务协调（creator earnings settlement）

**Severity:** P2  
**File:** `migrations/030_financial_schema_hardening.sql:210-223`  
**Code Reference:**

```sql
-- Creator pending revenue transaction
INSERT INTO public.transactions (user_id, type, amount_cents, status, available_on, metadata)
VALUES (
  v_post.creator_id,
  'ppv_revenue',
  v_price_cents,
  'pending',
  timezone('utc', now()) + interval '7 days',  -- 7 天后可提现
  jsonb_build_object(
    'post_id', p_post_id,
    'fan_id', p_user_id,
    'purchase_id', v_purchase_id
  )
);
```

**Impact:**

- Creator 的 pending 余额需要在 7 天后转为 available 余额
- 没有自动化的结算任务（cron job / background worker）
- 没有 `pending → available` 的状态转换函数
- 如果结算任务失败，creator 无法提现

**Recommended Fix:**

```sql
-- 1. 创建结算函数
CREATE OR REPLACE FUNCTION public.settle_pending_transactions()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settled_count INTEGER := 0;
  v_settled_amount BIGINT := 0;
  v_transaction RECORD;
BEGIN
  -- 查询所有到期的 pending 交易
  FOR v_transaction IN
    SELECT id, user_id, amount_cents, metadata
    FROM public.transactions
    WHERE status = 'pending'
      AND available_on IS NOT NULL
      AND available_on <= timezone('utc', now())
      AND type IN ('ppv_revenue', 'subscription', 'commission')
    FOR UPDATE SKIP LOCKED  -- 防止并发冲突
  LOOP
    -- 更新交易状态
    UPDATE public.transactions
    SET status = 'completed',
        updated_at = timezone('utc', now())
    WHERE id = v_transaction.id;

    -- 从 pending 转到 available
    UPDATE public.wallet_accounts
    SET pending_balance_cents = pending_balance_cents - v_transaction.amount_cents,
        available_balance_cents = available_balance_cents + v_transaction.amount_cents,
        updated_at = timezone('utc', now())
    WHERE user_id = v_transaction.user_id;

    v_settled_count := v_settled_count + 1;
    v_settled_amount := v_settled_amount + v_transaction.amount_cents;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'settled_count', v_settled_count,
    'settled_amount_cents', v_settled_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_pending_transactions() TO service_role;

-- 2. 创建 cron job（需要 pg_cron 扩展）
-- SELECT cron.schedule('settle-pending-transactions', '0 * * * *', 'SELECT public.settle_pending_transactions()');

-- 3. 或使用 Vercel Cron / Supabase Edge Functions
-- 参考 app/api/cron/financial-audit/route.ts
```

**Evidence:**

- `migrations/030_financial_schema_hardening.sql:210-223` - pending 交易创建
- `app/api/cron/financial-audit/route.ts` - 现有 cron job 示例

---

## 5. RACE CONDITION RISKS

### 🔴 CRITICAL-07: 并发充值可能导致余额不一致

**Severity:** P0  
**File:** `migrations/030_financial_schema_hardening.sql:297-302`  
**Code Reference:**

```sql
INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
VALUES (p_user_id, p_amount_cents, 0)
ON CONFLICT (user_id) DO UPDATE
  SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
      updated_at = timezone('utc', now())
RETURNING available_balance_cents INTO v_new_balance;
```

**Impact:**

- `ON CONFLICT DO UPDATE` 使用 `public.wallet_accounts.available_balance_cents`，这是 **UPDATE 开始时** 的值
- 在高并发场景下，两个事务可能读取相同的旧值，导致 lost update
- 例如：初始余额 100，两个并发充值各 50，最终余额可能是 150 而非 200

**Test Case:**

```sql
-- Session 1
BEGIN;
SELECT recharge_wallet('user-id', 5000, 'key-1');  -- +50 USD
-- (暂停，不提交)

-- Session 2
BEGIN;
SELECT recharge_wallet('user-id', 5000, 'key-2');  -- +50 USD
COMMIT;

-- Session 1 继续
COMMIT;

-- 检查余额（可能只有 150 而非 200）
SELECT available_balance_cents FROM wallet_accounts WHERE user_id = 'user-id';
```

**Recommended Fix:**

```sql
-- 方案 1: 使用 SELECT FOR UPDATE（推荐）
CREATE OR REPLACE FUNCTION public.recharge_wallet(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
  v_current_balance BIGINT;
BEGIN
  -- ... 参数验证和幂等性检查 ...

  -- 先插入 transaction（防重）
  INSERT INTO public.transactions (user_id, type, amount_cents, status, metadata)
  VALUES (...);

  -- 锁定钱包行，读取当前余额
  SELECT available_balance_cents INTO v_current_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    -- 首次充值，插入新行
    INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
    VALUES (p_user_id, p_amount_cents, 0)
    RETURNING available_balance_cents INTO v_new_balance;
  ELSE
    -- 更新现有余额
    UPDATE public.wallet_accounts
    SET available_balance_cents = available_balance_cents + p_amount_cents,
        updated_at = timezone('utc', now())
    WHERE user_id = p_user_id
    RETURNING available_balance_cents INTO v_new_balance;
  END IF;

  RETURN json_build_object(
    'success', true,
    'balance_cents', v_new_balance,
    'idempotent', false
  );
END;
$$;

-- 方案 2: 使用 SERIALIZABLE 隔离级别（最安全）
-- （已在 CRITICAL-06 中说明）
```

**Evidence:**

- `migrations/030_financial_schema_hardening.sql:297-302` - ON CONFLICT 逻辑
- PostgreSQL 文档：ON CONFLICT DO UPDATE 在 READ COMMITTED 下有 race condition

---

### 🟡 HIGH-05: unlock_ppv 的幂等性检查有 TOCTOU 漏洞

**Severity:** P1  
**File:** `migrations/030_financial_schema_hardening.sql:110-127`  
**Code Reference:**

```sql
-- Idempotency by key
SELECT id INTO v_existing_purchase
FROM public.purchases
WHERE idempotency_key = v_computed_idempotency_key
LIMIT 1;

IF v_existing_purchase IS NOT NULL THEN
  -- ... 返回幂等结果 ...
END IF;

-- Already purchased check
SELECT id INTO v_existing_purchase
FROM public.purchases
WHERE fan_id = p_user_id
  AND post_id = p_post_id
LIMIT 1;

IF v_existing_purchase IS NOT NULL THEN
  -- ... 返回幂等结果 ...
END IF;
```

**Impact:**

- 两次 SELECT 查询之间没有锁，存在 Time-of-Check to Time-of-Use (TOCTOU) 漏洞
- 两个并发请求可能同时通过检查，导致重复购买
- 虽然有 `UNIQUE(fan_id, post_id)` 约束，但没有异常处理捕获 `unique_violation`

**Recommended Fix:**

```sql
-- 方案 1: 使用 SELECT FOR UPDATE（推荐）
-- Idempotency by key (with lock)
SELECT id INTO v_existing_purchase
FROM public.purchases
WHERE idempotency_key = v_computed_idempotency_key
LIMIT 1
FOR UPDATE;  -- 添加锁

IF v_existing_purchase IS NOT NULL THEN
  -- ... 返回幂等结果 ...
END IF;

-- Already purchased check (with lock)
SELECT id INTO v_existing_purchase
FROM public.purchases
WHERE fan_id = p_user_id
  AND post_id = p_post_id
LIMIT 1
FOR UPDATE;  -- 添加锁

IF v_existing_purchase IS NOT NULL THEN
  -- ... 返回幂等结果 ...
END IF;

-- 方案 2: 使用 INSERT ... ON CONFLICT（更简洁）
BEGIN
  INSERT INTO public.purchases (fan_id, post_id, paid_amount_cents, idempotency_key)
  VALUES (p_user_id, p_post_id, v_price_cents, v_computed_idempotency_key)
  RETURNING id INTO v_purchase_id;
EXCEPTION
  WHEN unique_violation THEN
    -- 已存在，返回幂等结果
    SELECT id, idempotency_key INTO v_purchase_id, v_existing_idempotency_key
    FROM public.purchases
    WHERE fan_id = p_user_id AND post_id = p_post_id;

    SELECT available_balance_cents INTO v_fan_balance
    FROM public.wallet_accounts
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'purchase_id', v_purchase_id,
      'idempotent', true,
      'balance_after_cents', COALESCE(v_fan_balance, 0)
    );
END;

-- 继续后续逻辑（扣费、记录交易等）
```

**Evidence:**

- `migrations/030_financial_schema_hardening.sql:110-150` - 幂等性检查逻辑
- `migrations/013_money_access_mvp.sql:195` - UNIQUE 约束

---

## 6. DUPLICATION RISKS

### 🟡 MEDIUM-03: 多个钱包表并存（schema 演进遗留问题）

**Severity:** P2  
**Files:**

- `migrations/014_billing_system.sql:9-14` - `user_wallets` 表
- `migrations/018_feature_completion.sql:39-47` - `wallet_accounts` 表
- `migrations/019_unify_wallet_schema.sql` - 统一 schema 的尝试

**Code Reference:**

```sql
-- 014_billing_system.sql
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents integer NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  ...
);

-- 018_feature_completion.sql
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance_cents bigint NOT NULL DEFAULT 0,
  pending_balance_cents bigint NOT NULL DEFAULT 0,
  ...
);
```

**Impact:**

- 两个钱包表可能同时存在，导致数据不一致
- `user_wallets` 使用 `balance_cents integer`，`wallet_accounts` 使用 `available_balance_cents bigint`
- 旧代码可能仍在使用 `user_wallets`，新代码使用 `wallet_accounts`
- 财务对账时需要检查两个表

**Recommended Fix:**

```sql
-- 1. 确认当前使用的表
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
  (SELECT COUNT(*) FROM pg_class WHERE relname = t.table_name) as exists
FROM (VALUES ('user_wallets'), ('wallet_accounts')) AS t(table_name);

-- 2. 数据迁移（如果 user_wallets 仍有数据）
INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
SELECT id, balance_cents, 0
FROM public.user_wallets
ON CONFLICT (user_id) DO UPDATE
  SET available_balance_cents = GREATEST(
    public.wallet_accounts.available_balance_cents,
    EXCLUDED.available_balance_cents
  );

-- 3. 删除旧表（确认无引用后）
DROP TABLE IF EXISTS public.user_wallets CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;

-- 4. 更新所有引用旧表的代码和函数
-- （需要全局搜索 'user_wallets' 和 'wallet_transactions'）
```

**Evidence:**

- `migrations/014_billing_system.sql:9-14` - user_wallets 定义
- `migrations/018_feature_completion.sql:39-47` - wallet_accounts 定义
- `migrations/019_unify_wallet_schema.sql` - 统一尝试

---

### 🟡 MEDIUM-04: transactions 表的 type 约束多次修改

**Severity:** P2  
**Files:**

- `migrations/018_feature_completion.sql:71` - 初始 type 约束
- `migrations/030_financial_schema_hardening.sql:32-48` - 扩展 type 约束

**Code Reference:**

```sql
-- 018_feature_completion.sql
type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'subscription', 'ppv_purchase', 'commission', 'payout')),

-- 030_financial_schema_hardening.sql
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_type_check
CHECK (
  type IN (
    'deposit',
    'withdrawal',
    'subscription',
    'ppv_purchase',
    'ppv_unlock',  -- 新增
    'ppv_revenue',  -- 新增
    'commission',
    'payout'
  )
);
```

**Impact:**

- 如果 migration 执行顺序错误，可能导致约束不一致
- 旧数据可能使用 `ppv_unlock`，新数据使用 `ppv_purchase`
- 财务报表需要处理多种 type 名称

**Recommended Fix:**

```sql
-- 1. 统一 type 名称（数据迁移）
UPDATE public.transactions
SET type = 'ppv_purchase'
WHERE type = 'ppv_unlock';

-- 2. 使用 enum 类型（更安全）
CREATE TYPE transaction_type AS ENUM (
  'deposit',
  'withdrawal',
  'subscription',
  'ppv_purchase',
  'ppv_revenue',
  'commission',
  'payout',
  'refund'
);

ALTER TABLE public.transactions
ALTER COLUMN type TYPE transaction_type USING type::transaction_type;

-- 3. 添加版本控制注释
COMMENT ON COLUMN public.transactions.type IS
  'Transaction type (v2: unified ppv_unlock → ppv_purchase)';
```

**Evidence:**

- `migrations/018_feature_completion.sql:71` - 初始约束
- `migrations/030_financial_schema_hardening.sql:32-48` - 扩展约束

---

### 🟢 LOW-01: purchases 表的列名不一致

**Severity:** P3  
**Files:**

- `migrations/013_money_access_mvp.sql:193` - `paid_amount_cents integer`
- `migrations/024_atomic_unlock_ppv_safe.sql:275` - `amount`
- `migrations/030_financial_schema_hardening.sql:179` - `paid_amount_cents`

**Code Reference:**

```sql
-- 013_money_access_mvp.sql
paid_amount_cents integer NOT NULL,

-- 024_atomic_unlock_ppv_safe.sql (旧版本)
amount,  -- 使用 amount 而非 paid_amount_cents

-- 030_financial_schema_hardening.sql (新版本)
paid_amount_cents,  -- 已修正
```

**Impact:**

- 如果使用旧版本的 migration，列名可能不一致
- 代码中可能同时使用 `amount` 和 `paid_amount_cents`

**Recommended Fix:**

```sql
-- 1. 确认当前列名
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'purchases'
  AND column_name IN ('amount', 'paid_amount_cents');

-- 2. 如果存在 amount 列，重命名
ALTER TABLE public.purchases
RENAME COLUMN amount TO paid_amount_cents;

-- 3. 统一代码中的列名引用
-- （需要全局搜索 'amount' 并替换为 'paid_amount_cents'）
```

**Evidence:**

- `migrations/013_money_access_mvp.sql:193` - 表定义
- `migrations/024_atomic_unlock_ppv_safe.sql:275` - 旧版本引用

---

## 7. ADDITIONAL FINDINGS

### 🟡 HIGH-06: 缺少财务审计日志表

**Severity:** P1  
**Impact:**

- 所有财务操作（充值、购买、提现）没有不可变的审计日志
- 如果 `transactions` 或 `wallet_accounts` 被篡改，无法追溯
- 缺少操作人员记录（admin 操作、系统自动操作等）

**Recommended Fix:**

```sql
-- 创建审计日志表（append-only）
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,  -- 'recharge', 'purchase', 'withdrawal', 'settlement', 'refund'
  user_id uuid NOT NULL,
  amount_cents bigint NOT NULL,
  balance_before_cents bigint,
  balance_after_cents bigint,
  related_transaction_id uuid,
  related_purchase_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  operated_by uuid,  -- NULL = system, NOT NULL = admin
  operated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ip_address inet,
  user_agent text
);

-- 禁止 UPDATE 和 DELETE（只允许 INSERT）
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_audit_log_insert_only
  ON public.financial_audit_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY financial_audit_log_no_update
  ON public.financial_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY financial_audit_log_no_delete
  ON public.financial_audit_log
  FOR DELETE
  USING (false);

-- 索引
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_user_time
ON public.financial_audit_log(user_id, operated_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_audit_log_event_time
ON public.financial_audit_log(event_type, operated_at DESC);

-- 触发器：自动记录所有财务操作
CREATE OR REPLACE FUNCTION log_financial_operation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.financial_audit_log (
    event_type,
    user_id,
    amount_cents,
    related_transaction_id,
    metadata
  ) VALUES (
    TG_ARGV[0],  -- event_type 从触发器参数传入
    NEW.user_id,
    NEW.amount_cents,
    NEW.id,
    NEW.metadata
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_transaction_insert
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION log_financial_operation('transaction_created');
```

**Evidence:** 无现有审计日志表

---

### 🟡 MEDIUM-05: 缺少提现（withdrawal）功能实现

**Severity:** P2  
**Impact:**

- `transactions.type` 包含 `'withdrawal'`，但没有对应的 RPC 函数
- Creator 无法提现 available 余额
- 缺少提现限额、手续费、KYC 验证等逻辑

**Recommended Fix:**

```sql
-- 创建提现函数
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id UUID,
  p_amount_cents BIGINT,
  p_payment_method TEXT,  -- 'bank_transfer', 'paypal', etc.
  p_payment_details JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_balance BIGINT;
  v_withdrawal_id UUID;
  v_min_withdrawal_cents BIGINT := 1000;  -- 最低提现 $10
  v_max_withdrawal_cents BIGINT := 1000000;  -- 最高提现 $10,000
BEGIN
  -- 1. 身份验证
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- 2. KYC 验证（creator 必须通过 KYC）
  IF NOT EXISTS (
    SELECT 1 FROM public.creator_verifications
    WHERE user_id = p_user_id AND status = 'approved'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'KYC verification required'
    );
  END IF;

  -- 3. 金额验证
  IF p_amount_cents < v_min_withdrawal_cents OR p_amount_cents > v_max_withdrawal_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Withdrawal amount must be between $%s and $%s',
        v_min_withdrawal_cents / 100, v_max_withdrawal_cents / 100)
    );
  END IF;

  -- 4. 锁定钱包并检查余额
  SELECT available_balance_cents INTO v_available_balance
  FROM public.wallet_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF COALESCE(v_available_balance, 0) < p_amount_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available_cents', COALESCE(v_available_balance, 0),
      'requested_cents', p_amount_cents
    );
  END IF;

  -- 5. 扣除余额（立即扣除，防止重复提现）
  UPDATE public.wallet_accounts
  SET available_balance_cents = available_balance_cents - p_amount_cents,
      updated_at = timezone('utc', now())
  WHERE user_id = p_user_id;

  -- 6. 创建提现交易记录
  INSERT INTO public.transactions (
    user_id,
    type,
    amount_cents,
    status,
    metadata
  ) VALUES (
    p_user_id,
    'withdrawal',
    -p_amount_cents,
    'pending',  -- 需要人工审核或自动处理
    jsonb_build_object(
      'payment_method', p_payment_method,
      'payment_details', p_payment_details,
      'requested_at', timezone('utc', now())
    )
  ) RETURNING id INTO v_withdrawal_id;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'amount_cents', p_amount_cents,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, BIGINT, TEXT, JSONB) TO authenticated;
```

**Evidence:**

- `migrations/018_feature_completion.sql:71` - withdrawal type 定义
- 无对应的 RPC 函数实现

---

### 🟢 LOW-02: profiles 表的 bio 字段无长度限制

**Severity:** P3  
**File:** `migrations/001_init.sql:15`  
**Code Reference:**

```sql
bio text,  -- 无长度限制
```

**Impact:**

- 用户可能输入超长 bio，导致存储浪费和查询性能下降
- 前端显示可能溢出

**Recommended Fix:**

```sql
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_bio_length_check
CHECK (LENGTH(bio) <= 1000);
```

**Evidence:** `migrations/001_init.sql:15`

---

### 🟢 LOW-03: 缺少 created_at / updated_at 索引

**Severity:** P3  
**Impact:**

- 按时间排序的查询（如最新交易、最新购买）可能较慢

**Recommended Fix:**

```sql
-- transactions 表
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
ON public.transactions(created_at DESC);

-- purchases 表
CREATE INDEX IF NOT EXISTS idx_purchases_created_at
ON public.purchases(created_at DESC);

-- wallet_accounts 表
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_updated_at
ON public.wallet_accounts(updated_at DESC);
```

**Evidence:** 无现有时间索引

---

## 8. SUMMARY & RECOMMENDATIONS

### 立即修复（P0 - Critical）

1. **CRITICAL-01**: 修改 `purchases.fan_id` 外键为 `ON DELETE SET NULL`，添加软删除
2. **CRITICAL-02**: 为 `transactions.metadata` 添加显式外键列或验证触发器
3. **CRITICAL-03**: 为 `transactions` 表添加财务查询复合索引
4. **CRITICAL-04**: 为 `purchases` 表添加关键索引
5. **CRITICAL-05**: 为 `transactions.metadata` 添加 NOT NULL 约束和字段验证
6. **CRITICAL-06**: 为 `unlock_ppv` 函数添加 SERIALIZABLE 隔离级别
7. **CRITICAL-07**: 修复 `recharge_wallet` 的并发余额更新问题

### 高优先级（P1 - High）

1. **HIGH-01**: 优化 `wallet_accounts.user_id` 索引
2. **HIGH-02**: 为 `subscriptions` 表添加状态过滤索引
3. **HIGH-03**: 为 `wallet_accounts` 余额字段添加 CHECK 约束和审计触发器
4. **HIGH-04**: 完善 `recharge_wallet` 幂等性实现
5. **HIGH-05**: 修复 `unlock_ppv` 幂等性检查的 TOCTOU 漏洞
6. **HIGH-06**: 创建财务审计日志表

### 中优先级（P2 - Medium）

1. **MEDIUM-01**: 为 `purchases.idempotency_key` 添加 NOT NULL 约束
2. **MEDIUM-02**: 实现 creator earnings 自动结算功能
3. **MEDIUM-03**: 清理重复的钱包表（user_wallets vs wallet_accounts）
4. **MEDIUM-04**: 统一 `transactions.type` 枚举值
5. **MEDIUM-05**: 实现提现（withdrawal）功能

### 低优先级（P3 - Low）

1. **LOW-01**: 统一 `purchases` 表列名
2. **LOW-02**: 为 `profiles.bio` 添加长度限制
3. **LOW-03**: 添加 created_at / updated_at 索引

---

## 9. TESTING RECOMMENDATIONS

### 并发测试

```bash
# 使用 pgbench 或 k6 进行并发测试
# 测试场景：
# 1. 100 个并发用户同时充值
# 2. 50 个并发用户购买同一个 post
# 3. 混合场景：充值 + 购买 + 查询余额
```

### 数据完整性验证

```sql
-- 1. 检查余额一致性
SELECT
  wa.user_id,
  wa.available_balance_cents,
  wa.pending_balance_cents,
  COALESCE(SUM(CASE WHEN t.type = 'deposit' THEN t.amount_cents ELSE 0 END), 0) as total_deposits,
  COALESCE(SUM(CASE WHEN t.type = 'ppv_purchase' THEN t.amount_cents ELSE 0 END), 0) as total_purchases,
  COALESCE(SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount_cents ELSE 0 END), 0) as total_withdrawals
FROM public.wallet_accounts wa
LEFT JOIN public.transactions t ON t.user_id = wa.user_id AND t.status = 'completed'
GROUP BY wa.user_id, wa.available_balance_cents, wa.pending_balance_cents
HAVING wa.available_balance_cents != (
  COALESCE(SUM(CASE WHEN t.type = 'deposit' THEN t.amount_cents ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN t.type = 'ppv_purchase' THEN t.amount_cents ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount_cents ELSE 0 END), 0)
);

-- 2. 检查孤儿记录
SELECT 'purchases without transactions' as issue, COUNT(*) as count
FROM public.purchases p
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.metadata->>'purchase_id' = p.id::text
)
UNION ALL
SELECT 'transactions without users', COUNT(*)
FROM public.transactions t
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = t.user_id
);

-- 3. 检查负余额
SELECT user_id, available_balance_cents, pending_balance_cents
FROM public.wallet_accounts
WHERE available_balance_cents < 0 OR pending_balance_cents < 0;
```

---

## 10. CONCLUSION

该数据库 schema 在财务完整性方面存在 **多个高风险问题**，主要集中在：

1. **事务安全性不足**：缺少 SERIALIZABLE 隔离级别，存在 race condition
2. **索引缺失**：财务查询性能可能较差
3. **约束不完整**：nullable 字段、缺少 CHECK 约束
4. **审计能力弱**：缺少不可变审计日志

**建议优先修复 CRITICAL 级别问题**，然后逐步完善 HIGH 和 MEDIUM 级别问题。

**估计修复时间**：

- CRITICAL: 2-3 天
- HIGH: 3-5 天
- MEDIUM: 5-7 天
- LOW: 1-2 天

**总计**: 约 2-3 周（包括测试和验证）

---

**Report End**
