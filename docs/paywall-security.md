# Paywall Security Strategy

## Overview

GetFanSee implements a multi-layer security approach to protect paid content from unauthorized access. This document outlines the security measures in place for the paywall system.

## Storage Security

### Supabase Storage Buckets

| Bucket    | Access Level | Purpose                          |
| --------- | ------------ | -------------------------------- |
| `media`   | **Private**  | Creator content (images, videos) |
| `avatars` | Public       | User profile pictures            |

### Private Bucket Configuration

The `media` bucket is configured as **private**, meaning:

- No direct public URL access
- All access requires signed URLs
- RLS (Row Level Security) policies control access

## Signed URL Strategy

### URL Generation

```typescript
// lib/storage.ts
const { data: urlData } = await supabase.storage.from("media").createSignedUrl(filePath, 3600); // 1 hour expiration
```

### Expiration Policy

| Content Type | Expiration Time | Rationale                       |
| ------------ | --------------- | ------------------------------- |
| Images       | 1 hour          | Balance between UX and security |
| Videos       | 1 hour          | Same as images for consistency  |

**Why 1 hour?**

- Short enough to prevent URL sharing/leaking
- Long enough for users to view content without issues
- Refresh mechanism can regenerate URLs as needed

## Access Control Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Access Control Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User requests content                                   │
│     │                                                       │
│     ▼                                                       │
│  2. API checks authentication                               │
│     │                                                       │
│     ├─── Not authenticated ──► 401 Unauthorized             │
│     │                                                       │
│     ▼                                                       │
│  3. API checks entitlement                                  │
│     │                                                       │
│     ├─── Free content ──► Generate signed URL               │
│     │                                                       │
│     ├─── Subscriber content                                 │
│     │    └─── Has subscription? ──► Generate signed URL     │
│     │    └─── No subscription ──► 403 Forbidden             │
│     │                                                       │
│     └─── PPV content                                        │
│          └─── Has purchased? ──► Generate signed URL        │
│          └─── Not purchased ──► 403 Forbidden               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Entitlement Verification

### Database Tables

```sql
-- Subscription entitlements
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  fan_id UUID REFERENCES profiles(id),
  creator_id UUID REFERENCES profiles(id),
  status TEXT, -- 'active', 'cancelled', 'expired'
  created_at TIMESTAMPTZ
);

-- PPV purchase entitlements
CREATE TABLE purchases (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  post_id UUID REFERENCES posts(id),
  amount_cents INTEGER,
  created_at TIMESTAMPTZ
);
```

### Verification Logic

```typescript
// lib/paywall.ts
export async function canViewPost(userId: string, postId: string): Promise<boolean> {
  const post = await getPost(postId);

  // Free content - always accessible
  if (post.visibility === "free") return true;

  // Creator can always view their own content
  if (post.creator_id === userId) return true;

  // Subscriber content
  if (post.visibility === "subscribers") {
    return await hasActiveSubscription(userId, post.creator_id);
  }

  // PPV content
  if (post.visibility === "ppv") {
    return await hasPurchased(userId, postId);
  }

  return false;
}
```

## API Endpoints Security

### Protected Routes

| Endpoint                    | Auth Required | Entitlement Check    |
| --------------------------- | ------------- | -------------------- |
| `GET /api/posts/[id]`       | Yes           | Yes (for media URLs) |
| `GET /api/posts/[id]/media` | Yes           | Yes                  |
| `POST /api/unlock`          | Yes           | Creates entitlement  |

### Example: Media URL Generation

```typescript
// app/api/posts/[id]/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const post = await getPost(params.id);
  const canView = await canViewPost(user.id, params.id);

  if (!canView) {
    // Return post metadata but not media URLs
    return NextResponse.json({
      ...post,
      media_url: null,
      mediaFiles: [],
      locked: true,
    });
  }

  // Generate fresh signed URLs
  const mediaFiles = await generateSignedUrls(post.mediaFiles);

  return NextResponse.json({
    ...post,
    mediaFiles,
    locked: false,
  });
}
```

## Security Best Practices

### DO

1. **Always verify entitlements server-side** - Never trust client-side checks
2. **Use short-lived signed URLs** - 1 hour maximum
3. **Regenerate URLs on each request** - Don't cache signed URLs
4. **Log access attempts** - For audit and abuse detection
5. **Rate limit URL generation** - Prevent abuse

### DON'T

1. **Don't expose raw storage paths** - Always use signed URLs
2. **Don't cache signed URLs client-side** - They should be fresh
3. **Don't rely on frontend hiding** - Backend must enforce access
4. **Don't use public buckets for paid content** - Always private

## Threat Model

### Protected Against

| Threat              | Mitigation                    |
| ------------------- | ----------------------------- |
| Direct URL access   | Private bucket + signed URLs  |
| URL sharing         | Short expiration (1 hour)     |
| Subscription bypass | Server-side entitlement check |
| Credential stuffing | Rate limiting + 2FA (future)  |

### Known Limitations

1. **Screen recording** - Cannot prevent users from recording their screen
2. **URL sharing within expiration** - URLs valid for 1 hour can be shared
3. **Download & re-upload** - Cannot prevent content re-distribution

## Monitoring & Alerts

### Metrics to Track

- Signed URL generation rate per user
- Failed access attempts
- Unusual download patterns

### Recommended Alerts

- Multiple failed access attempts from same user
- Abnormally high URL generation rate
- Access attempts for content user doesn't own

## Future Enhancements

1. **DRM for videos** - Encrypted video streams
2. **Watermarking** - User-specific watermarks (partially implemented)
3. **Geographic restrictions** - IP-based access control
4. **Device fingerprinting** - Limit concurrent devices

## References

- [Supabase Storage Security](https://supabase.com/docs/guides/storage/security)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Signed URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
