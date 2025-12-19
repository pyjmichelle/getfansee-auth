# 推送到 GitHub 指南

## 当前状态

代码已经准备好推送到 GitHub。仓库地址：https://github.com/pyjmichelle/getfansee-auth

## 推送步骤

### 方式 1: 使用 HTTPS（需要输入用户名和密码/Personal Access Token）

```bash
cd "/Users/puyijun/Downloads/authentication-flow-design (1)"
git push -u origin main
```

**注意**：如果使用 HTTPS，GitHub 可能要求使用 Personal Access Token 而不是密码。

### 方式 2: 使用 SSH（推荐）

1. 首先配置 SSH key（如果还没有）：
   ```bash
   # 检查是否已有 SSH key
   ls -al ~/.ssh
   
   # 如果没有，生成新的 SSH key
   ssh-keygen -t ed25519 -C "your_email@example.com"
   
   # 添加 SSH key 到 ssh-agent
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   
   # 复制公钥（添加到 GitHub Settings → SSH and GPG keys）
   cat ~/.ssh/id_ed25519.pub
   ```

2. 更改 remote URL 为 SSH：
   ```bash
   git remote set-url origin git@github.com:pyjmichelle/getfansee-auth.git
   ```

3. 推送代码：
   ```bash
   git push -u origin main
   ```

### 方式 3: 使用 GitHub CLI

```bash
# 安装 GitHub CLI（如果还没有）
# brew install gh

# 登录
gh auth login

# 推送
git push -u origin main
```

## 重要提醒

1. **`.env.local` 文件已被 `.gitignore` 排除**，不会被提交
2. **`node_modules` 已被排除**，不会提交到仓库
3. **确保 GitHub Secrets 已配置**（参考 `CI_SETUP_CHECKLIST.md`）

## 推送后验证

推送成功后：

1. 访问 https://github.com/pyjmichelle/getfansee-auth
2. 确认所有文件都已上传
3. 检查 GitHub Actions 是否自动运行（需要先配置 Secrets）

## 如果推送失败

### 错误：`fatal: could not read Username`

**解决方案**：
- 使用 SSH 方式（方式 2）
- 或使用 Personal Access Token：
  1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. 生成新 token（需要 `repo` 权限）
  3. 推送时使用 token 作为密码

### 错误：`Permission denied`

**解决方案**：
- 确认你有该仓库的写入权限
- 检查 SSH key 是否正确添加到 GitHub

### 错误：`remote: Support for password authentication was removed`

**解决方案**：
- 必须使用 Personal Access Token 或 SSH key
- 不能使用账户密码

