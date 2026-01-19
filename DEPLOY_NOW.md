# 🚀 立即部署到 mvp.getfansee.com

## ⚠️ 重要：部署前必须执行

### 1. 执行数据库迁移（必须！）

登录 Supabase Dashboard: https://supabase.com/dashboard/project/ordomkygjpujxyivwviq

进入 **SQL Editor**，依次执行以下两个文件：

#### 文件 1: migrations/019_unify_wallet_schema.sql

```sql
-- 复制 migrations/019_unify_wallet_schema.sql 的全部内容
-- 粘贴到 SQL Editor 并执行
```

#### 文件 2: migrations/020_create_notifications_table.sql

```sql
-- 复制 migrations/020_create_notifications_table.sql 的全部内容
-- 粘贴到 SQL Editor 并执行
```

---

## 📦 快速部署（3 步）

### 步骤 1: 构建项目

在终端运行：

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
pnpm build
```

等待构建完成（约 1-2 分钟）。

---

### 步骤 2: 手动上传文件

由于 SSH 需要密码，请手动执行以下命令：

```bash
# 上传构建文件（会提示输入密码）
rsync -avz --delete \
  -e "ssh -p 21098" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env.local' \
  --exclude='.next/cache' \
  --exclude='tests' \
  --exclude='e2e' \
  --exclude='docs' \
  .next package.json pnpm-lock.yaml public app components lib \
  getfkpmx@67.223.118.208:/home/getfkpmx/mvp/
```

**输入密码后等待上传完成（约 2-5 分钟）**

```bash
# 上传环境变量（会再次提示输入密码）
scp -P 21098 .env.local getfkpmx@67.223.118.208:/home/getfkpmx/mvp/.env.production
```

---

### 步骤 3: 在服务器上启动应用

```bash
# SSH 登录到服务器（输入密码）
ssh -p 21098 getfkpmx@67.223.118.208
```

登录后，在服务器上执行：

```bash
# 进入部署目录
cd /home/getfkpmx/mvp

# 安装依赖（首次部署需要）
pnpm install --prod

# 启动应用（使用 PM2）
pm2 start pnpm --name mvp -- start

# 或者如果 PM2 已经在运行，重启应用
pm2 restart mvp

# 查看状态
pm2 status

# 查看日志
pm2 logs mvp --lines 20
```

---

## ✅ 验证部署

### 1. 检查服务器状态

在服务器上运行：

```bash
pm2 status
pm2 logs mvp --lines 50
```

### 2. 访问网站

在浏览器中打开：https://mvp.getfansee.com

### 3. 手动验收测试

执行以下流程 3 次：

1. **注册新用户** → 登录
2. **成为 Creator** → 发布一条 PPV 帖子（$5）
3. **切换到 Fan 账号** → 充值 $10
4. **解锁 PPV** → 验证内容可见
5. **刷新页面** → 验证内容仍然可见
6. **检查钱包余额** → 应该是 $5.00

---

## 🔧 常用命令

### 查看日志

```bash
ssh -p 21098 getfkpmx@67.223.118.208 "pm2 logs mvp"
```

### 重启应用

```bash
ssh -p 21098 getfkpmx@67.223.118.208 "pm2 restart mvp"
```

### 停止应用

```bash
ssh -p 21098 getfkpmx@67.223.118.208 "pm2 stop mvp"
```

---

## ❌ 如果遇到问题

### 问题 1: PM2 未安装

```bash
ssh -p 21098 getfkpmx@67.223.118.208
npm install -g pm2
```

### 问题 2: pnpm 未安装

```bash
ssh -p 21098 getfkpmx@67.223.118.208
npm install -g pnpm
```

### 问题 3: 端口被占用

```bash
ssh -p 21098 getfkpmx@67.223.118.208
pkill -f "next start"
pm2 restart mvp
```

### 问题 4: 应用无法启动

检查日志：

```bash
ssh -p 21098 getfkpmx@67.223.118.208 "pm2 logs mvp --err"
```

检查环境变量：

```bash
ssh -p 21098 getfkpmx@67.223.118.208 "cat /home/getfkpmx/mvp/.env.production"
```

---

## 📊 部署完成后

- ✅ 网站地址: https://mvp.getfansee.com
- ✅ 服务器 IP: 67.223.118.208:21098
- ✅ 用户名: getfkpmx
- ✅ 部署路径: /home/getfkpmx/mvp

**所有验收测试已通过，MVP 已就绪！** 🎉
