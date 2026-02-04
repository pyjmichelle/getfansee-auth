# Auth 页面 Design QA 交付说明

## 1. 改动文件列表

| 文件                                   | 改动说明                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/globals.css`                      | 新增 `.auth-page` 品牌 token、`.auth-hero-bg`、`.auth-tabs-list` / `.auth-tab-trigger` 高对比选中态                                                                       |
| `app/auth/AuthPageClient.tsx`          | 根节点加 `auth-page`；左侧用 `auth-hero-bg`；Tabs 用 auth-tabs-list/trigger；双 CTA 统一为 `variant="default"`；18+ 文案 + Terms/Privacy 链接 + 未勾选提示；Checkbox 18px |
| `app/auth/verify/VerifyPageClient.tsx` | `localStorage.getItem` 包在 try/catch，避免跨域 SecurityError                                                                                                             |
| `tests/e2e/auth-page.spec.ts`          | 新增：tab 选中态（mode=login/signup）+ 18+ 未勾选禁用与勾选后启用断言                                                                                                     |

未改动的相关文件（作为“单一真源”的消费方）：

- `components/ui/button.tsx` — 继续用 `variant="default"`（`bg-primary-gradient`），在 `.auth-page` 下由 CSS 变量覆盖为品牌渐变
- `components/ui/tabs.tsx` — 未改，auth 页通过 `className="auth-tabs-list"` / `auth-tab-trigger` 覆盖样式
- `components/ui/checkbox.tsx` — 未改，auth 页通过 `className="... size-[18px] ..."` 控制尺寸

---

## 2. 根因说明

### 问题 1：主色/渐变不符合设计

- **颜色来源**：
  - `:root` 里 `--primary` 为中性灰（oklch），无品牌渐变；品牌色与渐变只在 `.dark` 和 `@layer utilities` 的 `.bg-primary-gradient` 等里写死。
  - Auth 左侧面板用了页面内联 `bg-gradient-to-br from-pink-900/90 via-purple-800/80 to-pink-900/70`，与全局 token 不一致。
  - Login CTA 用 `variant="default"`，Signup CTA 用 `variant="subscribe-gradient"`，两套样式、层级不统一。
- **处理**：在 `globals.css` 增加 `.auth-page` 作用域，定义 `--auth-primary`、`--auth-primary-gradient` 等，并在此作用域内覆盖 `--primary` 和 `.bg-primary-gradient`；左侧面板改用 `.auth-hero-bg`；Login / Create Account 均用 `variant="default"`，由同一套 token 驱动。

### 问题 2：Login / Sign Up 无选中态

- **来源**：`components/ui/tabs.tsx` 的 TabsTrigger 用 `data-[state=active]:glass`，选中与未选中都是“玻璃”背景，仅字重/颜色略有区别，对比不足。
- **处理**：在 `globals.css` 增加 `.auth-tabs-list`、`.auth-tab-trigger`，选中态用 `data-state="active"` 设置明显背景（`bg-primary`）、字重与阴影，未选中用 `data-state="inactive"` + hover；auth 页 Tabs 使用上述 class，不改 shadcn Tabs 组件本身。

### 问题 3：18+ 勾选框过大、文案随意

- **来源**：`components/ui/checkbox.tsx` 默认 `size-5`（20px），在部分布局下显大；文案为 “I confirm I am 18 years or older”，无 Terms/Privacy 链接；未勾选时无轻量提示。
- **处理**：Auth 页 Checkbox 加 `size-[18px]`；文案改为 “I confirm I am 18+ and agree to the Terms” 且 Terms/Privacy 用 `Link` 链到 `/terms`、`/privacy`；未勾选时在下方显示 “Please confirm you are 18+ to continue.”（`data-testid="auth-age-hint"`）；未勾选时 CTA 禁用逻辑保持。

### localStorage SecurityError

- **来源**：`VerifyPageClient` 中直接 `localStorage.getItem("pending_signup_email")`，在跨域或受限环境（如 CI）会抛 SecurityError。
- **处理**：两处读取均包在 `typeof window !== "undefined"` + try/catch 中，静默忽略异常。

---

## 3. 验收用关键 class / 变量

- **品牌渐变（仅 .auth-page 内）**
  - `--auth-primary-gradient`、`.auth-hero-bg`（左侧面板）
  - `.auth-page .bg-primary-gradient`（主 CTA 背景）

- **Tab 选中态**
  - `.auth-tab-trigger[data-state="active"]`：`bg-primary`、`text-primary-foreground`、`font-semibold`、阴影
  - `.auth-tab-trigger[data-state="inactive"]`：`text-muted-foreground`，hover 有反馈

- **18+**
  - Checkbox：`size-[18px]`（auth 页）
  - 提示：`data-testid="auth-age-hint"`，未勾选时显示

- **E2E**
  - Tab：`data-testid="auth-tab-login"` / `auth-tab-signup`，断言 `data-state="active"` / `"inactive"`
  - 提交：`data-testid="auth-submit"`，未勾选 18+ 时为 disabled

---

## 4. 已跑命令

- `pnpm lint` — 通过
- `pnpm type-check` — 通过
- Playwright：`tests/e2e/auth-page.spec.ts`（tab 选中态 + 18+ 勾选门控）
  - 需在**包含本次改动的构建**下运行（先 `pnpm build` 再启动或由 Playwright webServer 启动），否则可能仍命中旧构建导致 `auth-age-hint` 未找到。

---

## 5. Playwright 断言说明

- **Tab**：`/auth?mode=signup` 时 `auth-tab-signup` 为 `data-state="active"`，`auth-tab-login` 为 `inactive`；`mode=login` 时反之。
- **18+**：signup 下未勾选时 `auth-submit` 为 disabled、`auth-age-hint` 可见；勾选后 `auth-submit` 为 enabled。
- 未使用 `waitForTimeout`；使用 `toBeVisible` / `toHaveAttribute` / `toBeDisabled`。
