# 部署指南 - mvp.getfansee.com

## 🎯 三种部署方式

---

## 方式 1: Vercel 部署 (推荐 - 最简单)

### 步骤:

1. **登录 Vercel**
   - 访问 https://vercel.com
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择 `pyjmichelle/getfansee-auth` 仓库
   - 点击 "Import"

3. **配置环境变量**
   在 Vercel 项目设置中添加:

   ```
   NEXT_PUBLIC_SUPABASE_URL=你的_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
   SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
   ```

4. **部署**
   - 点击 "Deploy"
   - 等待构建完成

5. **配置自定义域名**
   - 进入项目 Settings → Domains
   - 添加域名: `mvp.getfansee.com`
   - 在你的 DNS 提供商添加 CNAME 记录:
     ```
     Type: CNAME
     Name: mvp
     Value: cname.vercel-dns.com
     ```

6. **完成！**
   - 访问 https://mvp.getfansee.com

---

## 方式 2: Docker 部署 (适合自托管服务器)

### 前提条件:

- 服务器已安装 Docker 和 Docker Compose
- 有 SSH 访问权限

### 步骤:

1. **在服务器上克隆代码**

   ```bash
   ssh user@your-server
   cd /var/www
   git clone git@github.com:pyjmichelle/getfansee-auth.git
   cd getfansee-auth
   ```

2. **配置环境变量**

   ```bash
   cp .env.production .env
   nano .env  # 填写实际的 Supabase 配置
   ```

3. **构建并启动**

   ```bash
   docker-compose up -d --build
   ```

4. **配置 Nginx 反向代理** (如果需要)
   创建 `/etc/nginx/sites-available/mvp.getfansee.com`:

   ```nginx
   server {
       listen 80;
       server_name mvp.getfansee.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   启用配置:

   ```bash
   sudo ln -s /etc/nginx/sites-available/mvp.getfansee.com /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **配置 SSL (推荐)**
   ```bash
   sudo certbot --nginx -d mvp.getfansee.com
   ```

---

## 方式 3: PM2 部署 (Node.js 进程管理)

### 前提条件:

- 服务器已安装 Node.js 18+ 和 pnpm
- 已安装 PM2: `npm install -g pm2`

### 步骤:

1. **在服务器上克隆代码**

   ```bash
   ssh user@your-server
   cd /var/www
   git clone git@github.com:pyjmichelle/getfansee-auth.git
   cd getfansee-auth
   ```

2. **安装依赖并构建**

   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   ```

3. **配置环境变量**

   ```bash
   cp .env.production .env.local
   nano .env.local  # 填写实际配置
   ```

4. **启动应用**

   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # 设置开机自启
   ```

5. **配置 Nginx** (同方式 2 的步骤 4-5)

### 后续更新部署:

```bash
cd /var/www/getfansee-auth
./deploy.sh
```

---

## 🔍 验证部署

部署完成后,访问以下 URL 验证:

1. **首页**: https://mvp.getfansee.com
2. **登录页**: https://mvp.getfansee.com/login
3. **注册页**: https://mvp.getfansee.com/signup

---

## 🐛 常见问题

### 1. 构建失败 - TypeScript 错误

**解决**: 项目配置了开发环境忽略类型错误,生产环境需要修复所有类型错误

```bash
pnpm type-check  # 检查类型错误
```

### 2. 环境变量未生效

**解决**: 确保环境变量正确配置

- Vercel: 在 Dashboard 设置
- Docker: 检查 `.env` 文件
- PM2: 检查 `.env.local` 文件

### 3. Supabase 连接失败

**解决**:

- 检查 Supabase URL 和 API Key 是否正确
- 确认 Supabase 项目未暂停
- 检查服务器防火墙设置

### 4. 域名无法访问

**解决**:

- 检查 DNS 记录是否正确配置
- 等待 DNS 传播 (最多 48 小时)
- 使用 `dig mvp.getfansee.com` 检查 DNS 解析

---

## 📞 需要帮助?

如果遇到问题,请提供:

1. 使用的部署方式
2. 错误日志
3. 服务器环境信息

---

## ✅ 部署检查清单

- [ ] 代码已推送到 GitHub
- [ ] 环境变量已配置
- [ ] Supabase 迁移已执行 (见 `DEPLOY_INSTRUCTIONS.md`)
- [ ] 构建成功
- [ ] 域名 DNS 已配置
- [ ] SSL 证书已配置 (生产环境必须)
- [ ] 首页可以访问
- [ ] 登录/注册功能正常
- [ ] 测试账号可以登录

**部署完成后运行测试**:

```bash
pnpm test:auth
pnpm test:mvp
```
