# tab-stability Posts/About flake — 2026-09-20

## Class

P1 — CI flake, no product money path.

## Symptom

Main CI `tab-stability` failed on
`switching Posts/About does not move the tab bar itself (PC)`:
tablist `y` 764 → 584 (−180px).

## Root cause

1. Guest first paint mounts `NewsletterSignup` (~180px) above the tablist.
   Session hydrate unmounts it. A viewport or document `y` taken too early
   records that collapse as “the tab bar jumped”.
2. Playwright `boundingBox().y` is viewport-relative. Clicking About/Posts
   scroll-into-views the control, so `y` moves even when document position
   is unchanged.
3. Waiting on `follow-button` is wrong for mobile: that control is
   `hidden md:flex` and never becomes visible at 390px.

Scoped CLS on Posts↔About was also flaky (0.028–0.056). That metric
measures content swap below the fold, not whether the tab strip itself
moved. It is not the merge-blocking signal.

## Fix

`tests/e2e/tab-stability.spec.ts`:

- `gotoMockCreator` waits until `/Get notified when/i` has count 0
  (newsletter gone). Does not wait on follow-button.
- PC jump test: `stabilizeChrome` then `documentBox` x/y only.
- CLS assertion removed from this one test.

## Proof

```
PLAYWRIGHT_SKIP_SERVER=true PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001
NEXT_PUBLIC_TEST_MODE=true PLAYWRIGHT_TEST_MODE=true E2E=1
pnpm exec playwright test tests/e2e/tab-stability.spec.ts --project=chromium
```

7 passed / 1.9m / local isolated production server on :3001 / 2026-09-20.

Main stays red until this spec is on `main`.
