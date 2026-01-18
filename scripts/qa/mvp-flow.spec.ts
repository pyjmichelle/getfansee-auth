/**
 * MVP Flow Specification
 *
 * Defines critical user journeys and expected behaviors
 */

export interface TestCase {
  id: string;
  name: string;
  route: string;
  authState: "anonymous" | "fan" | "creator";
  requiredSelectors?: string[];
  interactions?: Interaction[];
  expectations: Expectation[];
}

export interface Interaction {
  type: "click" | "fill" | "select" | "wait";
  selector: string;
  value?: string;
  waitFor?: string; // selector to wait for after interaction
}

export interface Expectation {
  type: "selector" | "url" | "network" | "modal" | "toast" | "disabled" | "enabled" | "value";
  target: string;
  expected: string | boolean | number;
  description: string;
}

export const MVP_TEST_CASES: TestCase[] = [
  // A) Search Modal Test
  {
    id: "search-modal",
    name: "Search opens modal (not page navigation)",
    route: "/home",
    authState: "fan",
    requiredSelectors: [
      'button:has-text("Search"), [aria-label*="search" i], [data-testid="search-button"]',
    ],
    interactions: [
      {
        type: "click",
        selector:
          'button:has-text("Search"), [aria-label*="search" i], [data-testid="search-button"]',
        waitFor: '[role="dialog"], [role="search"], input[type="search"]',
      },
    ],
    expectations: [
      {
        type: "url",
        target: "current",
        expected: "/home",
        description: "URL should stay on /home (not navigate to /search)",
      },
      {
        type: "modal",
        target: '[role="dialog"], [role="search"]',
        expected: true,
        description: "Search modal/dialog should be visible",
      },
      {
        type: "selector",
        target: 'input[type="search"], input[placeholder*="search" i]',
        expected: true,
        description: "Search input should be visible",
      },
    ],
  },

  // B) Post Creation - Upload Area
  {
    id: "post-creation-upload",
    name: "Creator can see upload area on new post page",
    route: "/creator/new-post",
    authState: "creator",
    requiredSelectors: [
      'input[type="file"], [data-testid="file-upload"], button:has-text("Upload")',
      'input[name="title"], input[placeholder*="title" i]',
      'textarea, [contenteditable="true"]',
    ],
    expectations: [
      {
        type: "selector",
        target:
          'input[type="file"], [data-testid="file-upload"], button:has-text("Upload"), label:has-text("Upload")',
        expected: true,
        description: "Upload area/button should be visible",
      },
      {
        type: "selector",
        target: 'input[name="title"], input[placeholder*="title" i]',
        expected: true,
        description: "Title input should be visible",
      },
      {
        type: "selector",
        target: 'textarea, [contenteditable="true"]',
        expected: true,
        description: "Content input area should be visible",
      },
    ],
  },

  // C) Paywall Price UI - Free Post
  {
    id: "paywall-price-free",
    name: "Price input disabled when visibility=free",
    route: "/creator/new-post",
    authState: "creator",
    requiredSelectors: [
      'select[name="visibility"], [data-testid="visibility-select"]',
      'input[name="price"], input[type="number"]',
    ],
    interactions: [
      {
        type: "select",
        selector: 'select[name="visibility"], [data-testid="visibility-select"]',
        value: "free",
      },
    ],
    expectations: [
      {
        type: "disabled",
        target: 'input[name="price"], input[type="number"]',
        expected: true,
        description: "Price input should be disabled when visibility=free",
      },
      {
        type: "value",
        target: 'input[name="price"], input[type="number"]',
        expected: 0,
        description: "Price value should be 0 when visibility=free",
      },
    ],
  },

  // C) Paywall Price UI - Paid Post
  {
    id: "paywall-price-paid",
    name: "Price input enabled when visibility=paid",
    route: "/creator/new-post",
    authState: "creator",
    interactions: [
      {
        type: "select",
        selector: 'select[name="visibility"], [data-testid="visibility-select"]',
        value: "ppv",
      },
    ],
    expectations: [
      {
        type: "enabled",
        target: 'input[name="price"], input[type="number"]',
        expected: true,
        description: "Price input should be enabled when visibility=paid",
      },
    ],
  },

  // D) Wallet - No Unauthorized Requests
  {
    id: "wallet-no-unauthorized",
    name: "Fan wallet page should not trigger unauthorized requests",
    route: "/me/wallet",
    authState: "fan",
    requiredSelectors: ['[data-testid="wallet-balance"], .balance, h1:has-text("Wallet")'],
    expectations: [
      {
        type: "selector",
        target:
          '[data-testid="wallet-balance"], .balance, h2:has-text("Balance"), h3:has-text("Balance")',
        expected: true,
        description: "Wallet balance section should be visible",
      },
      {
        type: "network",
        target: "401|403",
        expected: 0,
        description: "Should have 0 unauthorized (401/403) requests",
      },
    ],
  },

  // Additional Critical Tests
  {
    id: "home-feed-loads",
    name: "Home feed loads posts for fan",
    route: "/home",
    authState: "fan",
    requiredSelectors: ['[data-testid="post"], article, .post-card'],
    expectations: [
      {
        type: "selector",
        target: '[data-testid="post"], article, .post-card',
        expected: true,
        description: "At least one post should be visible",
      },
    ],
  },

  {
    id: "creator-studio-dashboard",
    name: "Creator can access studio dashboard",
    route: "/creator/studio",
    authState: "creator",
    requiredSelectors: [
      'h1:has-text("Studio"), h1:has-text("Dashboard")',
      '[data-testid="stats"], .stats, .analytics',
    ],
    expectations: [
      {
        type: "selector",
        target: 'h1:has-text("Studio"), h1:has-text("Dashboard"), h2:has-text("Studio")',
        expected: true,
        description: "Studio heading should be visible",
      },
    ],
  },

  {
    id: "creator-earnings",
    name: "Creator can view earnings",
    route: "/creator/studio/earnings",
    authState: "creator",
    requiredSelectors: ['[data-testid="earnings"], .earnings, h1:has-text("Earnings")'],
    expectations: [
      {
        type: "selector",
        target:
          '[data-testid="earnings"], .earnings, h2:has-text("Earnings"), h3:has-text("Earnings")',
        expected: true,
        description: "Earnings section should be visible",
      },
      {
        type: "network",
        target: "401|403",
        expected: 0,
        description: "Should have 0 unauthorized requests",
      },
    ],
  },
];

export const DEAD_CLICK_ROUTES = [
  { route: "/home", authState: "fan" as const },
  { route: "/creator/new-post", authState: "creator" as const },
  { route: "/creator/studio", authState: "creator" as const },
  { route: "/me/wallet", authState: "fan" as const },
];
