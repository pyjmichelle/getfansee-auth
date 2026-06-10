/**
 * Shared types, defaults and validation for the creator tip ("buy me a coffee") feature.
 * Scope: one-off voluntary tipping only. No membership tiers, no promised deliverables.
 */

export interface CreatorTipSettings {
  enabled: boolean;
  unit_label: string;
  unit_emoji: string;
  preset_amounts_cents: number[];
  thank_you_message: string | null;
  goal_enabled: boolean;
  goal_title: string | null;
  goal_target_cents: number | null;
  goal_started_at: string | null;
  show_supporters: boolean;
}

export const DEFAULT_TIP_SETTINGS: CreatorTipSettings = {
  enabled: true,
  unit_label: "coffee",
  unit_emoji: "☕",
  preset_amounts_cents: [100, 500, 1000, 2000],
  thank_you_message: null,
  goal_enabled: false,
  goal_title: null,
  goal_target_cents: null,
  goal_started_at: null,
  show_supporters: true,
};

export const TIP_MIN_CENTS = 100; // $1.00
export const TIP_MAX_CENTS = 50_000; // $500.00
export const TIP_MESSAGE_MAX = 140;
export const THANK_YOU_MAX = 280;
export const UNIT_LABEL_MAX = 24;
export const GOAL_TITLE_MAX = 80;
export const MAX_PRESETS = 4;

export interface TipSupporter {
  display_name: string;
  avatar_url: string | null;
  amount_cents: number;
  message: string | null;
  created_at: string;
}

export interface PublicTipData {
  settings: CreatorTipSettings;
  goal: {
    title: string | null;
    target_cents: number;
    raised_cents: number;
  } | null;
  supporters: TipSupporter[];
}

/**
 * Phrases that turn a voluntary gratuity into a quid-pro-quo "purchase".
 * Used as a soft client/server guardrail when creators edit their thank-you message.
 * This is a best-effort heuristic, not a substitute for moderation.
 */
const QUID_PRO_QUO_PATTERNS: RegExp[] = [
  /\btip\s+\$?\d+\s+(and|to|for)\b/i,
  /\bin\s+exchange\s+for\b/i,
  /\bi'?ll\s+(send|dm|message|show)\b/i,
  /\bpay\s+\$?\d+\s+(and|to|for)\b/i,
  /\bunlock\b/i,
  /\bcustom\s+(content|video|photo|pic)\b/i,
];

/** Returns true if the text looks like it promises something in exchange for a tip. */
export function looksLikeQuidProQuo(text: string | null | undefined): boolean {
  if (!text) return false;
  return QUID_PRO_QUO_PATTERNS.some((re) => re.test(text));
}

/**
 * Validate & normalize a settings payload coming from the creator config form.
 * Returns either { ok: true, value } or { ok: false, error }.
 */
export function validateTipSettingsInput(
  input: unknown
): { ok: true; value: Partial<CreatorTipSettings> } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid body" };
  }
  const b = input as Record<string, unknown>;
  const out: Partial<CreatorTipSettings> = {};

  if (b.enabled !== undefined) {
    if (typeof b.enabled !== "boolean") return { ok: false, error: "enabled must be boolean" };
    out.enabled = b.enabled;
  }

  if (b.unit_label !== undefined) {
    if (
      typeof b.unit_label !== "string" ||
      b.unit_label.trim().length === 0 ||
      b.unit_label.length > UNIT_LABEL_MAX
    ) {
      return { ok: false, error: `unit_label must be 1–${UNIT_LABEL_MAX} chars` };
    }
    out.unit_label = b.unit_label.trim();
  }

  if (b.unit_emoji !== undefined) {
    if (typeof b.unit_emoji !== "string" || b.unit_emoji.length === 0 || b.unit_emoji.length > 8) {
      return { ok: false, error: "unit_emoji must be 1–8 chars" };
    }
    out.unit_emoji = b.unit_emoji;
  }

  if (b.preset_amounts_cents !== undefined) {
    if (
      !Array.isArray(b.preset_amounts_cents) ||
      b.preset_amounts_cents.length === 0 ||
      b.preset_amounts_cents.length > MAX_PRESETS
    ) {
      return { ok: false, error: `preset_amounts_cents must have 1–${MAX_PRESETS} values` };
    }
    const presets: number[] = [];
    for (const v of b.preset_amounts_cents) {
      if (typeof v !== "number" || !Number.isInteger(v) || v < TIP_MIN_CENTS || v > TIP_MAX_CENTS) {
        return {
          ok: false,
          error: `each preset must be an integer ${TIP_MIN_CENTS}–${TIP_MAX_CENTS} cents`,
        };
      }
      presets.push(v);
    }
    out.preset_amounts_cents = presets;
  }

  if (b.thank_you_message !== undefined) {
    if (b.thank_you_message === null) {
      out.thank_you_message = null;
    } else if (
      typeof b.thank_you_message !== "string" ||
      b.thank_you_message.length > THANK_YOU_MAX
    ) {
      return { ok: false, error: `thank_you_message must be ≤${THANK_YOU_MAX} chars` };
    } else {
      out.thank_you_message = b.thank_you_message.trim() || null;
    }
  }

  if (b.goal_enabled !== undefined) {
    if (typeof b.goal_enabled !== "boolean")
      return { ok: false, error: "goal_enabled must be boolean" };
    out.goal_enabled = b.goal_enabled;
  }

  if (b.goal_title !== undefined) {
    if (b.goal_title === null) {
      out.goal_title = null;
    } else if (typeof b.goal_title !== "string" || b.goal_title.length > GOAL_TITLE_MAX) {
      return { ok: false, error: `goal_title must be ≤${GOAL_TITLE_MAX} chars` };
    } else {
      out.goal_title = b.goal_title.trim() || null;
    }
  }

  if (b.goal_target_cents !== undefined) {
    if (b.goal_target_cents === null) {
      out.goal_target_cents = null;
    } else if (
      typeof b.goal_target_cents !== "number" ||
      !Number.isInteger(b.goal_target_cents) ||
      b.goal_target_cents <= 0
    ) {
      return { ok: false, error: "goal_target_cents must be a positive integer" };
    } else {
      out.goal_target_cents = b.goal_target_cents;
    }
  }

  if (b.show_supporters !== undefined) {
    if (typeof b.show_supporters !== "boolean")
      return { ok: false, error: "show_supporters must be boolean" };
    out.show_supporters = b.show_supporters;
  }

  return { ok: true, value: out };
}
