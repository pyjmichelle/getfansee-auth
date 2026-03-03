# Task: GetFanSee UI 全量重构

## Goal

完整重写 GetFanSee 全平台 UI，采用 Liquid Glass + OLED Dark 风格，以黑金玫瑰配色体系。

## Phases

- [x] Phase 0: 工程准备 (planning files + design-system MASTER.md)
- [ ] Phase 1: globals.css + layout.tsx 字体
- [ ] Phase 2: components/ui/ 基础组件
- [ ] Phase 3: 共享业务组件 (~30个)
- [ ] Phase 4A-H: 页面重写 (42个页面)
- [ ] Phase 5: QA (type-check, lint, build, screenshots)

## Current Status

**Phase:** 1 (Starting)
**Progress:** 0/6 phases complete
**Blockers:** None

## Decisions Made

- Dark-only mode (no light mode)
- Playfair Display (headings) + Inter (body)
- Rose #e11d48 (brand), Gold #CA8A04 (CTA), Purple #7c3aed (accent)
- Liquid Glass glassmorphism as primary visual style
- Mobile-first, 375/768/1024/1440 breakpoints

## Error Log

(empty)

## Notes

- design-system/getfansee/MASTER.md generated
- Page overrides: auth.md, home.md, creator-profile.md, studio.md
