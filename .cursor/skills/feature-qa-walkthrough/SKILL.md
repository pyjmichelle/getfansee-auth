---
name: feature-qa-walkthrough
description: >
  Comprehensive PRD-driven QA walkthrough for any GetFanSee feature.
  Covers dual viewport (PC 1280px + Mobile 375px), all user-role perspectives,
  every button interaction, loading performance, and screenshot evidence at
  every step. Triggers: 'run feature QA', 'do a full walkthrough', 'PRD walkthrough',
  '功能走查', '全量走查', '移动端走查', 'qa walkthrough for [feature]'.
metadata:
  author: getfansee
  version: "1.1.0"
---

# Feature QA Walkthrough Skill

A PRD-driven, dual-viewport, every-button walkthrough protocol.  
Produces a dated report + screenshot evidence directory.

---

## Prerequisites

Before starting, verify:

```bash
# 1. Dev server is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health

# 2. Session files exist (fan + creator + admin)
ls artifacts/agent-browser-full/sessions/

# 3. Warm up all routes to avoid Turbopack first-compile timeouts
for route in /auth /home /me /creator/studio /creator/studio/ambassador /r/TESTCODE; do
  curl -s -o /dev/null "http://localhost:3000$route"
  echo "Warmed: $route"
done
```

If sessions don't exist, refer to `.cursor/skills/agent-browser/SKILL.md` to create them.

---

## Report Output Convention

```
docs/reports/
  feature-qa-<YYYYMMDD>-<feature>.md        ← main report
  screenshots/<YYYYMMDD>-<feature>/
    pc/
      <role>-<step>-<screen>.png
    mb/
      <role>-<step>-<screen>.png
```

Every screenshot filename: `<role>-<sequence>-<what>.png`  
Example: `creator-03-ambassador-enroll-card.png`

---

## Viewport Protocol

Run EVERY test scenario **twice** — once at each viewport:

| Viewport | Width | Height | Usage                            |
| -------- | ----- | ------ | -------------------------------- |
| PC       | 1280  | 900    | Primary desktop                  |
| Mobile   | 375   | 812    | iPhone-sized, most common mobile |

Switch viewport using `cursor-ide-browser`:

```javascript
// PC
await page.setViewportSize({ width: 1280, height: 900 });

// Mobile
await page.setViewportSize({ width: 375, height: 812 });
```

When using `agent-browser` CLI: use two separate named sessions and run each scenario in both.

---

## Role Matrix

Define the user roles needed for this walkthrough and their expected access:

| Role ID     | Description                              | Session File                     |
| ----------- | ---------------------------------------- | -------------------------------- |
| GUEST       | Not logged in                            | none                             |
| FAN         | Logged-in fan, not creator               | sessions/fan.json                |
| CREATOR_NEW | Creator role, not enrolled in Ambassador | sessions/creator.json            |
| CREATOR_AMB | Creator role, enrolled in Ambassador     | sessions/creator-ambassador.json |
| ADMIN       | Platform admin                           | sessions/admin.json              |

---

## Step-by-Step Walkthrough Protocol

### Phase 0 — PRD Coverage Map

Before running the browser, extract every user-facing action from the PRD and create a test checklist.  
For the **Creator Ambassador Program**, the PRD coverage map is:

```
REFERRAL FUNNEL (REFERREE PATH)
  [ ] Guest hits /r/<code> → redirected to /auth with ref cookie
  [ ] Invalid /r/<badcode> → redirected to /auth (no banner)
  [ ] /auth shows InvitedBanner with referrer name
  [ ] InvitedBanner shows on Create Account tab only
  [ ] InvitedBanner: Privacy Policy link navigates to /privacy
  [ ] Signing up completes: session created, cookie consumed

CREATOR AMBASSADOR DASHBOARD (REFERRER PATH)
  [ ] CREATOR_NEW /creator/studio/ambassador → shows enrollment card
  [ ] Enrollment card: 3 value bullets visible
  [ ] Enrollment card: example calculation visible
  [ ] Enrollment card: milestone journey icons visible
  [ ] Enrollment card: disclaimer text visible
  [ ] "Get My Referral Link" button → enrolls, shows dashboard
  [ ] CREATOR_AMB /creator/studio/ambassador → shows dashboard (no enrollment card)

DASHBOARD INTERACTIONS (every button)
  [ ] Copy button (referral link) → copies URL to clipboard, button state changes
  [ ] Share button → opens ShareModal sheet
  [ ] ShareModal: X button → opens twitter.com intent in new tab
  [ ] ShareModal: Telegram button → opens t.me/share in new tab
  [ ] ShareModal: WhatsApp button → opens whatsapp in new tab
  [ ] ShareModal: Facebook button → opens facebook sharer in new tab
  [ ] ShareModal: Instagram button → copies link, shows toast
  [ ] ShareModal: OnlyFans button → copies link, shows toast
  [ ] ShareModal: Fansly button → copies link, shows toast
  [ ] ShareModal: Copy Link row → copies link, shows "Copied!" state
  [ ] ShareModal: drag-down / tap backdrop → closes sheet
  [ ] Milestone journey progress bar → visible, correct tier shown
  [ ] FAQ accordion: every item expands/collapses individually
  [ ] "Back to Studio" link → navigates to /creator/studio

ACCESS CONTROL
  [ ] GUEST /creator/studio/ambassador → redirect to /auth
  [ ] FAN /creator/studio/ambassador → redirect or error (not creator)
  [ ] /api/referral/me without auth → 401
  [ ] /api/referral/me as fan → 403
  [ ] /api/admin/commissions/* without admin auth → 401/403

LOADING STATES
  [ ] Each page: skeleton/loading UI appears before data loads
  [ ] Each page: data replaces skeleton within acceptable time
  [ ] ShareModal: opens without delay
  [ ] Copy actions: toast appears within 300ms
```

### Phase 1 — Guest Perspective (PC + Mobile)

```bash
# 1a. Direct access to ambassador page without login
agent-browser open http://localhost:3000/creator/studio/ambassador --timeout 30000
agent-browser screenshot docs/reports/screenshots/<date>/pc/guest-01-ambassador-redirect.png
agent-browser get url   # ASSERT: redirected to /auth or /home

# 1b. Valid referral link
agent-browser open http://localhost:3000/r/<valid_code> --timeout 30000
agent-browser wait 2000
agent-browser screenshot docs/reports/screenshots/<date>/pc/guest-02-referral-redirect.png
agent-browser get url   # ASSERT: /auth?invited=1&ref_name=...

# 1c. Verify InvitedBanner appears on signup tab
agent-browser snapshot -i
# Find banner element, verify ref_name is shown
agent-browser screenshot docs/reports/screenshots/<date>/pc/guest-03-invited-banner.png

# 1d. Invalid referral code
agent-browser open http://localhost:3000/r/BADCODE000 --timeout 30000
agent-browser wait 2000
agent-browser get url   # ASSERT: /auth (no invited param)
agent-browser screenshot docs/reports/screenshots/<date>/pc/guest-04-invalid-code-no-banner.png
```

Repeat all steps at mobile viewport (width=375), save to `mb/` subfolder.

### Phase 2 — Creator (Not Enrolled) Perspective (PC + Mobile)

```bash
# Load creator session
agent-browser open http://localhost:3000/creator/studio/ambassador --session sessions/creator.json --timeout 30000
agent-browser wait 3000
agent-browser screenshot docs/reports/screenshots/<date>/pc/creator-01-enrollment-card.png

# Verify enrollment card elements
agent-browser snapshot -i
# CHECK: "Join the Program" heading visible
# CHECK: 3 bullet points visible
# CHECK: Example calculation section visible
# CHECK: Milestone icons visible
# CHECK: disclaimer text visible
# CHECK: "Get My Referral Link" button visible

# Performance: note time-to-interactive
# Time page open to when enrollment card is interactive

# Click enroll button
agent-browser click @<enroll-btn-ref>
agent-browser wait 3000
agent-browser screenshot docs/reports/screenshots/<date>/pc/creator-02-after-enroll.png
agent-browser get url   # ASSERT: still on /creator/studio/ambassador
# CHECK: dashboard now shows referral link, not enrollment card
```

Repeat at mobile viewport.

### Phase 3 — Creator (Enrolled) Dashboard — Every Button (PC + Mobile)

```bash
# Load enrolled creator session
agent-browser open http://localhost:3000/creator/studio/ambassador --session sessions/creator-ambassador.json --timeout 30000
agent-browser wait 3000
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-01-dashboard-loaded.png

# ── Copy button ────────────────────────────────────────────
agent-browser snapshot -i
agent-browser click @<copy-btn-ref>
agent-browser wait 500
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-02-copy-btn-clicked.png
# CHECK: button shows checkmark / "Copied!" state

# ── Share button → opens ShareModal ────────────────────────
agent-browser snapshot -i
agent-browser click @<share-btn-ref>
agent-browser wait 800
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-03-share-modal-open.png
# CHECK: sheet slides up from bottom
# CHECK: 7 platform icons visible (X, Telegram, WhatsApp, Facebook, Instagram, OnlyFans, Fansly)
# CHECK: Copy Link row visible

# Test each platform button
for platform in x telegram whatsapp facebook; do
  # Open platforms that trigger window.open — note new tab would open
  agent-browser snapshot -i
  agent-browser click @<platform-btn>
  agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-04-share-<platform>.png
  # CHECK: new tab opened OR console shows window.open call
done

for platform in instagram onlyfans fansly; do
  agent-browser snapshot -i
  agent-browser click @<platform-btn>
  agent-browser wait 300
  agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-04-share-<platform>-copied.png
  # CHECK: toast appears ("Link copied!")
  # CHECK: platform icon shows checkmark
done

# Copy Link row
agent-browser click @<copy-link-row-ref>
agent-browser wait 300
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-05-copy-link-row.png
# CHECK: "Copied!" text appears

# Close modal
agent-browser press Escape
agent-browser wait 300
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-06-share-modal-closed.png

# ── FAQ accordion ───────────────────────────────────────────
agent-browser snapshot -i
# Click every FAQ item and verify it expands
# Count FAQ items: should be 9+
# For each:
agent-browser click @<faq-item-ref>
agent-browser wait 200
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-07-faq-<n>-open.png
# CHECK: answer text visible, chevron rotated
agent-browser click @<faq-item-ref>   # collapse
agent-browser wait 200
# CHECK: answer hidden

# ── Milestone track ─────────────────────────────────────────
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-08-milestone-track.png
# CHECK: current tier highlighted
# CHECK: progress bar width matches qualified count

# ── Back to Studio link ─────────────────────────────────────
agent-browser snapshot -i
agent-browser click @<back-link-ref>
agent-browser wait 1000
agent-browser get url   # ASSERT: /creator/studio
agent-browser screenshot docs/reports/screenshots/<date>/pc/amb-09-back-to-studio.png
```

Repeat all steps at mobile viewport (375px) — scroll to reveal below-fold elements.

### Phase 4 — Fan Perspective (Access Control)

```bash
agent-browser open http://localhost:3000/creator/studio/ambassador --session sessions/fan.json --timeout 30000
agent-browser wait 2000
agent-browser get url
agent-browser screenshot docs/reports/screenshots/<date>/pc/fan-01-ambassador-blocked.png
# ASSERT: redirected away or shows error (fan cannot access creator studio)
```

### Phase 5 — Loading Performance Measurement

For each key page, record:

| Page                                    | Viewport | Time to skeleton (ms) | Time to interactive (ms) | Screenshot |
| --------------------------------------- | -------- | --------------------- | ------------------------ | ---------- |
| /creator/studio/ambassador (enrollment) | PC       |                       |                          |            |
| /creator/studio/ambassador (enrollment) | MB       |                       |                          |            |
| /creator/studio/ambassador (dashboard)  | PC       |                       |                          |            |
| /creator/studio/ambassador (dashboard)  | MB       |                       |                          |            |
| /r/<code> → /auth                       | PC       |                       |                          |            |
| /r/<code> → /auth                       | MB       |                       |                          |            |

Record timing manually:

```bash
# t0 = timestamp before navigation
# t1 = timestamp when skeleton/spinner appears
# t2 = timestamp when content is interactive
agent-browser open <url> --timeout 30000
# Note: agent-browser open blocks until page is ready, use that as t2
```

Flag any page where t2 > 3000ms as a **performance issue**.

### Phase 6 — Fake Button Detection Protocol

A button is considered **FAKE** (non-functional) if ALL of the following are true after clicking:

- No visual state change (color, icon, text)
- No navigation (URL unchanged)
- No toast / notification
- No console network request
- No modal/sheet opens

For every button encountered, record:

| Button Label | Route | Viewport | Expected Behaviour | Actual Behaviour | PASS/FAKE |
| ------------ | ----- | -------- | ------------------ | ---------------- | --------- |

Any FAKE buttons → log as **F-xxx P0 issue**.

---

## Issue Severity Rubric

| Severity | Definition                          | Examples                                                                          |
| -------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| **P0**   | Blocks core user task or money flow | Copy button copies wrong URL; Share modal doesn't open; Enrollment fails silently |
| **P1**   | Degraded UX, not a hard blocker     | Mobile layout broken; FAQ doesn't collapse; Loading state missing                 |
| **P2**   | Cosmetic / polish                   | Text truncation; icon misaligned; minor color off                                 |

---

## Mobile-Specific Checklist

For every screen at 375px, additionally verify:

- [ ] No horizontal scroll (overflow-x hidden)
- [ ] Text not clipped / overflowing cards
- [ ] Buttons minimum 44×44px tap target
- [ ] ShareModal sheet renders correctly (bottom sheet, not centered dialog)
- [ ] Milestone journey icons fit in single row without overlap
- [ ] Stats grid wraps to 2×2 on mobile (not 1 column)
- [ ] Referral link URL truncates with ellipsis, not breaks layout
- [ ] FAQ accordion items have enough vertical padding for thumb tapping
- [ ] "Back to Studio" arrow link is tappable

---

## Report Template

Save to `docs/reports/feature-qa-<YYYYMMDD>-<feature>.md`:

```markdown
# Feature QA Walkthrough — <Date> — <Feature Name>

## Summary

- Viewports tested: PC (1280px) ✅ / Mobile (375px) ✅
- Roles tested: Guest ✅ / Fan ✅ / Creator (unenrolled) ✅ / Creator (enrolled) ✅
- Buttons tested: <N> total / <N> PASS / <N> FAKE
- Screenshots taken: <N>
- P0 issues: <N>
- P1 issues: <N>
- Release decision: PASS / PASS WITH CONDITIONS / BLOCK

## PRD Coverage Matrix

| PRD Item                              | Tested | PC  | MB  | Status |
| ------------------------------------- | ------ | --- | --- | ------ |
| Guest: /r/<code> sets referral cookie | ✅     | ✅  | ✅  | PASS   |
| ...                                   |        |     |     |        |

## Issue Log

| ID    | Severity | Viewport | Route                      | Description                        | Evidence          |
| ----- | -------- | -------- | -------------------------- | ---------------------------------- | ----------------- |
| F-001 | P0       | MB       | /creator/studio/ambassador | Share button not visible on mobile | mb/creator-03.png |

## Button Interaction Log

| Button            | Route                      | PC  | MB  | Result        |
| ----------------- | -------------------------- | --- | --- | ------------- |
| Copy              | /creator/studio/ambassador | ✅  | ✅  | PASS          |
| Share             | /creator/studio/ambassador | ✅  | ✅  | PASS          |
| X (in ShareModal) | /creator/studio/ambassador | ✅  | ✅  | Opens new tab |
| ...               |                            |     |     |               |

## Loading Performance

| Page                       | Viewport | Time to interactive | Status |
| -------------------------- | -------- | ------------------- | ------ |
| /creator/studio/ambassador | PC       | 1800ms              | ✅     |
| /creator/studio/ambassador | MB       | 2100ms              | ✅     |

## Mobile-Specific Issues

(List any layout / tap-target / scroll issues found at 375px)

## Screenshots Index

### PC

- [guest-01] Redirect from ambassador to /auth
- [creator-01] Enrollment card
- ...

### Mobile (375px)

- [mb-guest-01] Redirect from ambassador to /auth
- [mb-creator-01] Enrollment card
- ...
```

---

## What Was Missing in Prior Walkthroughs

The previous Ambassador QA walkthroughs (2026-06-07) had these gaps:

| Gap                                                 | Impact                                    | Now covered by this skill                        |
| --------------------------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| No mobile (375px) viewport tested                   | Mobile layout bugs invisible              | ✅ Phase 3 + Phase 5 both require MB screenshots |
| ShareModal not tested (not implemented at time)     | Share flow completely untested            | ✅ Phase 3 tests every ShareModal button         |
| Buttons not individually logged                     | Fake buttons could slip through           | ✅ Phase 6 Fake Button Detection protocol        |
| No loading performance measurement                  | Skeleton states and slow pages undetected | ✅ Phase 5 records TTI for all key pages         |
| FAQ items not individually clicked                  | Some FAQ items could be broken            | ✅ Phase 3 requires every FAQ item tested        |
| InvitedBanner tested at PC only                     | Mobile banner layout unknown              | ✅ Phase 1 requires MB screenshot of banner      |
| Referral cookie attribution not verified end-to-end | Attribution could silently break          | ✅ Phase 1 checks URL params after redirect      |

---

## Running the Full Walkthrough

```bash
# 1. Start dev server
pnpm dev &

# 2. Warm routes
for route in /auth /home /creator/studio /creator/studio/ambassador; do
  curl -s -o /dev/null "http://localhost:3000$route"
done

# 3. Create screenshot directories
mkdir -p docs/reports/screenshots/$(date +%Y-%m-%d)-ambassador-qa/{pc,mb}

# 4. Run walkthrough phases in order
# Phase 0: Build PRD coverage checklist (manual review of PRD doc)
# Phase 1: Guest paths (PC then MB)
# Phase 2: Creator unenrolled (PC then MB)
# Phase 3: Creator enrolled — all buttons (PC then MB)
# Phase 4: Fan access control
# Phase 5: Performance timing
# Phase 6: Fake button audit

# 5. Write report
# Save to docs/reports/feature-qa-<date>-ambassador.md
```
