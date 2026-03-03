# Findings: GetFanSee UI Redesign

## Research Summary

- Design system: Liquid Glass + OLED Dark
- Font: Playfair Display (headings) + Inter (body)
- Colors: Rose #e11d48, Gold #CA8A04, Purple #7c3aed

## Code Analysis

- Project: Next.js 16 + Tailwind CSS v4 + shadcn/ui
- 42 pages, 103 components (57 UI + 46 business)
- Current: Inter font, Indigo #6366f1 brand color
- globals.css: ~914 lines to be completely replaced
- Tailwind v4: CSS-first config via @theme inline {}

## Technical Notes

- Tailwind v4 uses CSS variables in @theme inline block
- shadcn components use data-slot attributes
- Glass effects need @supports fallback for no-backdrop-filter browsers
- z-index system: nav(40), dropdown(50), sheet(60), modal(70), toast(80), age-gate(90)
