# Money & Access MVP - Demo Flow Guide

This guide explains how to run the Money & Access MVP demo flow locally.

## Prerequisites

1. **Supabase Project**: You need a Supabase project with the database migrations applied
2. **Environment Variables**: Configure `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## Setup Steps

### 1. Run Database Migration

Execute the migration SQL in Supabase Dashboard SQL Editor:

```bash
# File: migrations/013_money_access_mvp.sql
```

This creates:
- `creators` table
- Updates `posts` table with `price_cents` field
- Updates `subscriptions` table with `plan` field
- Creates `purchases` table
- Sets up RLS policies

### 2. Seed Demo Data (Optional)

You can seed demo data in two ways:

**Option A: Using the seed script (requires SERVICE_ROLE_KEY)**
```bash
# Add to .env.local:
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run seed script:
pnpm tsx scripts/seed-demo.ts
```

**Option B: Using the UI**
1. Log in to the app
2. Visit `/me`
3. Click "Create my creator profile" (if you're a fan)
4. Click "Seed demo posts" (if you're a creator)

### 3. Start the Development Server

```bash
pnpm install
pnpm dev
```

## Demo Flow

### Step 1: View Creators
1. Log in to the app
2. Visit `/home`
3. You should see a list of creators (cards)
4. Click on a creator card to view their profile

### Step 2: Subscribe to a Creator
1. Visit `/creator/[id]` (replace `[id]` with a creator ID)
2. Click "Subscribe" button at the top
3. This creates a fake subscription (30 days)
4. Subscriber-only posts (price_cents=0) should now be visible

### Step 3: Unlock PPV Content
1. On the creator profile page, find a PPV post (price_cents > 0)
2. Click "Unlock for $X.XX" button
3. This creates a fake purchase record
4. The PPV post content should now be visible

### Step 4: View Subscriptions
1. Visit `/subscriptions`
2. You should see your active subscriptions
3. You can cancel a subscription (sets status to 'canceled')

### Step 5: View Purchases
1. Visit `/purchases`
2. You should see all your PPV purchases
3. Total spent is displayed at the top

## Database Schema

### creators
- `id` (uuid, PK, FK to auth.users)
- `display_name` (text)
- `avatar_url` (text, nullable)
- `bio` (text, nullable)
- `created_at` (timestamptz)

### posts
- `id` (uuid, PK)
- `creator_id` (uuid, FK to creators)
- `title` (text, nullable)
- `content` (text, NOT NULL)
- `cover_url` (text, nullable)
- `price_cents` (int, NOT NULL, default 0)
  - `0` = subscriber-only
  - `> 0` = PPV (price in cents)
- `created_at` (timestamptz)

### subscriptions
- `id` (uuid, PK)
- `fan_id` (uuid, FK to auth.users)
- `creator_id` (uuid, FK to creators)
- `plan` (text, default 'monthly') - 'monthly' or 'yearly'
- `status` (text, default 'active') - 'active', 'canceled', 'expired'
- `current_period_end` (timestamptz, NOT NULL)
- `created_at` (timestamptz)
- UNIQUE(fan_id, creator_id)

### purchases
- `id` (uuid, PK)
- `fan_id` (uuid, FK to auth.users)
- `post_id` (uuid, FK to posts)
- `paid_amount_cents` (int, NOT NULL)
- `created_at` (timestamptz)
- UNIQUE(fan_id, post_id)

## Access Control Logic

### isActiveSubscriber(fanId, creatorId)
- Checks if fan has an active subscription to creator
- Returns `true` if subscription exists with:
  - `status = 'active'`
  - `current_period_end > now()`

### hasPurchasedPost(fanId, postId)
- Checks if fan has purchased a specific PPV post
- Returns `true` if purchase record exists

### Post Visibility Rules
- **Creator**: Always sees all their own posts
- **Subscriber-only (price_cents=0)**: Visible if fan has active subscription
- **PPV (price_cents>0)**: Visible if fan has purchased the post (subscription does NOT unlock PPV)

## Notes

- All payments are **fake** (no real payment gateway)
- Subscriptions are created with `current_period_end = now + 30 days`
- PPV purchases are created with `paid_amount_cents` from the post
- RLS policies ensure users can only see their own subscriptions/purchases
- Creator profile is synced from `profiles` table when role='creator'

## Troubleshooting

### No creators showing on /home
- Ensure you've run the migration
- Create a creator profile via `/me` page
- Or run the seed script

### Posts not unlocking after subscribe/unlock
- Check browser console for errors
- Verify RLS policies are correct
- Ensure you're logged in with a valid session

### Subscription/Purchase not showing
- Check that records were created in database
- Verify RLS policies allow SELECT for authenticated users
- Check that `fan_id` matches `auth.uid()`

