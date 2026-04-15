/**
 * Didit v3 API Client
 *
 * Server-side only. Handles session creation and decision retrieval.
 * API key is read from environment and never exposed to the client.
 */

import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { DiditCreateSessionResponse } from "./didit-mapper";

const DIDIT_VERIFICATION_BASE = "https://verification.didit.me";

function getApiKey(): string {
  const key = env.DIDIT_API_KEY;
  if (!key) {
    throw new Error(
      "[didit-client] DIDIT_API_KEY is not configured. " +
        "Set it in .env.local from Didit Console → Settings → API Keys."
    );
  }
  return key;
}

function getWorkflowId(): string {
  const id = env.DIDIT_WORKFLOW_ID;
  if (!id) {
    throw new Error(
      "[didit-client] DIDIT_WORKFLOW_ID is not configured. " +
        "Set it in .env.local from Didit Console → Workflows."
    );
  }
  return id;
}

export interface CreateSessionParams {
  /** Internal user ID, stored as vendor_data for webhook correlation */
  vendorData: string;
  /** URL to redirect user after verification completes */
  callbackUrl: string;
  /** Optional metadata to attach to the session */
  metadata?: Record<string, unknown>;
  /** Pre-fill user contact details */
  contactDetails?: {
    email?: string;
    phone?: string;
  };
}

/**
 * Create a new Didit verification session via the v3 API.
 *
 * POST https://verification.didit.me/v3/session/
 */
export async function createDiditSession(
  params: CreateSessionParams
): Promise<DiditCreateSessionResponse> {
  const apiKey = getApiKey();
  const workflowId = getWorkflowId();

  const body: Record<string, unknown> = {
    workflow_id: workflowId,
    callback: params.callbackUrl,
    vendor_data: params.vendorData,
  };

  if (params.metadata) {
    body.metadata = params.metadata;
  }

  if (params.contactDetails) {
    body.contact_details = {
      ...(params.contactDetails.email && { email: params.contactDetails.email }),
      ...(params.contactDetails.phone && { phone: params.contactDetails.phone }),
    };
  }

  const url = `${DIDIT_VERIFICATION_BASE}/v3/session/`;

  logger.info("[didit-client] Creating verification session", {
    workflowId,
    vendorData: params.vendorData,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    logger.error("[didit-client] Failed to create session", new Error(errorText), {
      status: response.status.toString(),
      vendorData: params.vendorData,
    });
    throw new Error(`Didit API error (${response.status}): Failed to create verification session`);
  }

  const data = (await response.json()) as DiditCreateSessionResponse;

  logger.info("[didit-client] Session created successfully", {
    sessionId: data.session_id,
    vendorData: params.vendorData,
  });

  return data;
}

/**
 * Retrieve the decision/result for a completed session.
 *
 * GET https://verification.didit.me/v3/session/{session_id}/decision/
 */
export async function getDiditSessionDecision(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const apiKey = getApiKey();
  const url = `${DIDIT_VERIFICATION_BASE}/v3/session/${sessionId}/decision/`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const errorText = await response.text().catch(() => "Unknown error");
    logger.error("[didit-client] Failed to get session decision", new Error(errorText), {
      sessionId,
      status: response.status.toString(),
    });
    throw new Error(`Didit API error (${response.status}): Failed to retrieve session decision`);
  }

  return (await response.json()) as Record<string, unknown>;
}
