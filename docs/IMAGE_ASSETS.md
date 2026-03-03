# 图片资产清单与版权说明

本文档列出 GetFanSee 站点使用的图片资产、存放位置及图源/版权信息，便于合规与后续替换。

## 存放位置

| 路径                                             | 用途                           | PC/MB |
| ------------------------------------------------ | ------------------------------ | ----- |
| `public/images/auth/hero-pc.jpg`                 | 登录页左侧主视觉（横版）       | PC    |
| `public/images/auth/hero-mb.jpg`                 | 登录页移动端主视觉（竖版）     | MB    |
| `public/images/avatars/fan-default.jpg`          | 粉丝/用户默认头像              | 共用  |
| `public/images/avatars/creator-default.jpg`      | 创作者默认头像                 | 共用  |
| `public/images/placeholders/post-media-1-pc.jpg` | 帖子无媒体时占位 / 种子数据    | PC    |
| `public/images/placeholders/post-media-1-mb.jpg` | 帖子占位（竖版）               | MB    |
| `public/apple-icon.png`                          | PWA / Apple 图标               | 共用  |
| `public/fan-user-avatar.jpg`                     | 兼容旧引用，同 fan-default     | 共用  |
| `public/artist-creator-avatar.jpg`               | E2E / 测试用帖子媒体           | 共用  |
| `public/creator-avatar.png`                      | 发布成功页当前用户头像（兼容） | 共用  |
| `public/placeholder.svg`                         | 通用占位（表单等）             | 共用  |

## 引用方式

- 代码中通过 `lib/image-fallbacks.ts` 的常量引用默认头像与帖子占位图，避免硬编码路径。
- 登录 Hero 在 `app/auth/AuthPageClient.tsx` 中通过 `<picture>` 按视口切换 PC/MB 图。

## 图源与版权

- **风格**：暧昧、魅惑、迷幻；与深色 UI、Indigo/Amber/Rose 品牌色协调。
- **来源**：当前站点图片采用 **AI 生成** 与 **精选图库** 混合方案。
  - 登录 Hero、默认头像、帖子占位等为 AI 生成，已确认所用工具 ToS 允许商用。
  - 若后续引入 Unsplash/Pexels 等图库素材，需在本节补充每张图的来源 URL 与许可类型（如 CC0、Unsplash License）。
- **替换**：更新图片时替换上述路径下的文件即可；若新增或更名文件，请同步更新 `lib/image-fallbacks.ts` 与本文档。

最后更新：按「网站图片资产与活人感落地」计划实施。
