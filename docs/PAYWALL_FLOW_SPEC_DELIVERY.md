# Paywall Flow E2E 可合并交付（最终版）

## 修改文件

- `tests/e2e/paywall-flow.spec.ts`

## 关键 Diff 摘要

### 1) 断言与路径对齐

**路径 A（creator-subscribe-button 直订阅）：**

- 不再断言 `paywall-success-message`（无 modal）。
- 成功标准：订阅后可访问受限内容（步骤 7：post 页面可打开 + `post-media` 可见）。
- 轻量 API 佐证：订阅成功后用 `page.evaluate(fetch(url, { credentials:'include' }))` 调用 `/api/subscription/status?creatorId=...`，确保带页面 cookie；若 `!res.ok` 抛错并带 status/body。

**路径 B（post-unlock-trigger → paywall modal → paywall-subscribe-button）：**

- 仅当 `usedUnlockTrigger === true` 时断言 `paywall-success-message` 可见。
- modal 必须出现：`expect(paywallModal).toBeVisible()` 包在 try/catch 中，失败时立即抛出并输出诊断：`url`、`onAuth`（是否在 /auth）、`body(200)`（body 前 200 字符）。

### 2) 资源释放

- 整段流程已用 `try { ... } finally { ... }` 包裹。
- `finally` 内：若 `creatorPage` 存在且未关闭，则 `creatorPage.close()`。
- 本用例仅新建 `creatorPage`，无其他 page/context，无需额外释放。

### 3) 无 waitForTimeout

- 未新增任何 `waitForTimeout`。
- 仅使用可验证信号：network response（`subscribeRes`、`statusRes`）、URL、visible/enabled、data-testid、API 返回。

### 4) 代码片段（关键变更）

```diff
+    let creatorIdForStatus: string | null = null;
+
     const subscribeRes = page.waitForResponse(...);

     if (await creatorSubscribeBtn.isVisible(...)) {
-      await creatorSubscribeBtn.click();
+      creatorIdForStatus = await creatorSubscribeBtn.getAttribute("data-creator-id");
+      await creatorSubscribeBtn.click();
     } else if (await unlockTrigger.isVisible(...)) {
       usedUnlockTrigger = true;
       await unlockTrigger.click();
       const paywallModal = page.getByTestId("paywall-modal");
-      await expect(paywallModal).toBeVisible({ timeout: 15000 });
+      try {
+        await expect(paywallModal).toBeVisible({ timeout: 15000 });
+      } catch (e) {
+        const url = page.url();
+        const onAuth = url.includes("/auth");
+        const bodyText = (await page.locator("body").textContent().catch(() => "")) ?? "";
+        throw new Error(
+          `paywall-flow: paywall modal not visible. url=${url} onAuth=${onAuth} body(200)=${bodyText.slice(0, 200)}. Original: ${String(e)}`
+        );
+      }
       ...
     }

-    if (usedUnlockTrigger) {
-      const successMsg = page.getByTestId("paywall-success-message");
-      await expect(successMsg).toBeVisible({ timeout: 20000 });
-    }
+    if (usedUnlockTrigger) {
+      await expect(page.getByTestId("paywall-success-message")).toBeVisible({ timeout: 20000 });
+    } else {
+      if (creatorIdForStatus) {
+        const statusRes = await page.request.get(
+          `${getOrigin(page)}/api/subscription/status?creatorId=${encodeURIComponent(creatorIdForStatus)}`
+        );
+        expect(statusRes.ok(), "subscription/status should succeed").toBe(true);
+        const statusBody = (await statusRes.json()) as { isSubscribed?: boolean };
+        expect(statusBody.isSubscribed, "API should report subscribed after path A").toBe(true);
+      }
+    }
+
+    // 7. 成功标准：订阅后可访问受限内容（post 页面可打开 + post-media 可见）
     await page.goto(`${BASE_URL}/posts/${postId}`, ...);
     ...
+    } finally {
+      if (creatorPage && !creatorPage.isClosed()) await creatorPage.close();
+    }
```

### 5) 最后一轮 Hardening

- **subscribeRes**：精确匹配 `method===POST` 且 `pathname==='/api/subscribe'`；await 失败或 `!res.ok()` 时抛出并带 `url/onAuth/body(200)`。
- **creatorIdForStatus**：读取后 `expect(creatorIdForStatus).toBeTruthy()`；若为空则 throw 并带 `url` + `button(200)`（按钮 outerHTML）。
- **路径 A API 佐证**：改为 `page.evaluate(fetch(url, { credentials:'include' }))`，返回 `{ ok, status, body }`；若 `!ok` 则 throw 并带 `status/body`。
- 仍无 waitForTimeout，try/finally 关闭 creatorPage 不变。

## 本地验证命令

```bash
pnpm check-all
pnpm exec playwright test tests/e2e/paywall-flow.spec.ts --project=chromium
```

全部通过后再合并。
