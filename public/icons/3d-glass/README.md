# 3D Glass Icons

This folder holds hero/feature PNG/WebP icons with a 3D Glass aesthetic.

## Source

Figma Community: "100 Glass Icons" by PavelGnezdilov
URL: https://www.figma.com/community/file/1352533967417354878/100-glass-icons

## Required files (export from Figma at 2x as WebP)

- heart.webp — subscriptions / likes
- lock.webp — premium content / paywall
- home.webp — home / feed
- search.webp — discover / search
- bell.webp — notifications
- user.webp — profile
- star.webp — featured / top rated
- camera.webp — media upload
- dollar.webp — earnings / wallet
- crown.webp — creator / premium
- shield.webp — security / KYC
- check-circle.webp — success / published
- sparkle.webp — new post / exclusive
- fire.webp — trending
- gift.webp — tips / gifting

## Usage

```tsx
import Image from "next/image";

<Image src="/icons/3d-glass/heart.webp" width={64} height={64} alt="heart" />;
```

## Color scheme

Use the "Pink" color option from the Figma file to match GetFanSee's rose brand color.
