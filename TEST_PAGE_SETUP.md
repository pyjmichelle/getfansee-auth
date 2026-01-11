# Test Page Setup

## Overview

A test entry page is available at `/test` for development and QA purposes. This page is only accessible when `NEXT_PUBLIC_TEST_MODE` is set to `"true"`.

## Vercel Environment Variables

Add the following environment variable in Vercel (Production & Preview):

- **Name**: `NEXT_PUBLIC_TEST_MODE`
- **Value**: `true`

### How to Add in Vercel:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add:
   - Variable: `NEXT_PUBLIC_TEST_MODE`
   - Value: `true`
   - Environments: Production, Preview
4. Redeploy your application

## Local Testing

To test locally:

```bash
NEXT_PUBLIC_TEST_MODE=true pnpm dev
```

Then open: http://localhost:3000/test

**Note**: If `NEXT_PUBLIC_TEST_MODE` is not set to `"true"`, accessing `/test` will return a 404.

## Features

- Quick navigation links to:
  - `/auth`
  - `/home`
  - `/me`
  - `/subscriptions`
  - `/purchases`
- Test flow checklist for QA verification

## Security

This page is isolated and does not affect existing product routing logic. It only provides navigation and testing guidance.



