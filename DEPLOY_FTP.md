# 部署指南：FTP 静态导出

本项目使用 **Next.js App Router + Supabase**，通过 **静态导出** 生成 `out/` 目录，然后使用 **FileZilla** 等 FTP 工具上传。

## 1. 环境准备

- Node.js 18+
- pnpm（推荐，符合项目约定）
- Supabase 项目（已配置好 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）

## 2. 安装依赖

```bash
pnpm install
```

## 3. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
```

注意：静态导出时，这些变量会被「烘焙」进前端 bundle 中。

## 4. 构建 + 静态导出

```bash
pnpm build
pnpm export
```

执行成功后，会在项目根目录生成 `out/` 目录：

- `out/` 即为所有静态文件（HTML、JS、CSS、图片等）

## 5. 使用 FileZilla 上传

1. 打开 **FileZilla**
2. 连接到你的 FTP 服务器（主机 / 用户名 / 密码 / 端口由你的托管商提供）
3. 在本地窗口中：
   - 导航到项目目录下的 `out/`
4. 在远程窗口中：
   - 打开你网站对应的根目录（例如 `/public_html` 或 `/www`）
5. 将 `out/` 中的所有文件和文件夹 **整体拖拽** 到远程目录

> 建议：如果远程目录中已有旧版本文件，先备份或清空旧文件，再上传新的 `out/` 内容。

## 6. 部署验证

上传完成后：

1. 在浏览器中访问你的域名，例如 `https://www.getfansee.com`
2. 验证以下关键路径：
   - `/auth`：登录/注册页
   - `/home`：Feed 页面 + paywall
   - `/creator/...`：Creator 相关页面（根据审批状态）

## 7. 常见问题

### 7.1 访问页面时 404

- 确认 `pnpm export` 是否成功
- 确认上传的是 `out/` 目录内部的文件，而不是整个 `out/` 目录本身（有些主机根目录需要直接看到 `index.html`）

### 7.2 Supabase 请求失败

- 检查浏览器控制台是否有 `Supabase URL` 或 `anon key` 相关的警告
- 确认 `.env.local` 中的变量在构建前已经正确设置

### 7.3 样式错乱或图片不显示

- 确认 `next.config.mjs` 中已配置：

```js
export default {
  output: "export",
  images: { unoptimized: true },
}
```

- 确认上传时保留了 `/_next/` 等静态资源目录结构

---

当你完成以上步骤后，一个可通过 FTP 部署的静态站点就准备好了。下一步请根据 `TEST_CHECKLIST.md` 运行完整桌面 + 移动端测试。

