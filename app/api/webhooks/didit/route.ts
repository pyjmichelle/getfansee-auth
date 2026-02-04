/**
 * Didit Webhook 路由
 * 预留 Didit SDK 接入槽位
 *
 * P0 安全修复：
 * 1. 添加 webhook 签名验证
 * 2. 实现幂等去重（防止重放攻击）
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { updateKYCStatus, type KYCStatus } from "@/lib/kyc-service";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

type DiditWebhookPayload = {
  id?: string; // event ID from Didit (if provided)
  event_id?: string; // alternative event ID field
  user_id?: string;
  status?: KYCStatus;
  timestamp?: string;
};

/**
 * 验证 Didit webhook 签名
 * 使用 HMAC-SHA256 验证请求真实性
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  // 如果没有配置 secret，在开发环境跳过验证，生产环境拒绝
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[webhook/didit] DIDIT_WEBHOOK_SECRET not configured in production");
      return false;
    }
    console.warn(
      "[webhook/didit] DIDIT_WEBHOOK_SECRET not configured, skipping signature verification in development"
    );
    return true;
  }

  if (!signature) {
    console.error("[webhook/didit] Missing X-Didit-Signature header");
    return false;
  }

  try {
    const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");

    // 使用 timing-safe 比较防止时序攻击
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    console.error("[webhook/didit] Signature verification error:", err);
    return false;
  }
}

/**
 * 计算 payload 的 SHA256 哈希
 */
function computePayloadHash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * 生成事件 ID
 * 优先使用 payload 中的 id/event_id，否则使用 payload hash + timestamp
 */
function generateEventId(payload: DiditWebhookPayload, payloadHash: string): string {
  // 优先使用 Didit 提供的事件 ID
  if (payload.id) return payload.id;
  if (payload.event_id) return payload.event_id;

  // 如果没有事件 ID，使用 user_id + status + timestamp 或 hash
  const timestamp = payload.timestamp || new Date().toISOString().slice(0, 13); // 精确到小时
  return `${payload.user_id || "unknown"}-${payload.status || "unknown"}-${timestamp}-${payloadHash.slice(0, 8)}`;
}

/**
 * 检查事件是否已处理（幂等去重）
 * @returns true 如果是重复事件
 */
async function checkAndRecordEvent(
  provider: string,
  eventId: string,
  payloadHash: string
): Promise<{ isDuplicate: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdminClient();

    // 尝试插入事件记录（利用 UNIQUE 约束）
    const { error } = await supabase.from("webhook_events").insert({
      provider,
      event_id: eventId,
      payload_hash: payloadHash,
      status: "processed",
    });

    if (error) {
      // 如果是唯一约束冲突，说明事件已处理过
      if (error.code === "23505") {
        // unique_violation
        logger.info("[webhook/didit] Duplicate event detected", {
          provider,
          eventId,
        });
        return { isDuplicate: true };
      }
      // 其他错误
      logger.error("[webhook/didit] Failed to record event", error, {
        provider,
        eventId,
      });
      return { isDuplicate: false, error: error.message };
    }

    return { isDuplicate: false };
  } catch (err) {
    logger.error("[webhook/didit] Event recording exception", err, {
      provider,
      eventId,
    });
    // 如果记录失败，继续处理（不阻塞业务）
    return { isDuplicate: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function POST(request: NextRequest) {
  try {
    // 读取原始请求体用于签名验证
    const rawBody = await request.text();
    const signature = request.headers.get("X-Didit-Signature");
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

    // P0 安全修复：验证 webhook 签名
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn("[webhook/didit] Invalid webhook signature");
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }

    // 解析 JSON
    let body: DiditWebhookPayload;
    try {
      body = JSON.parse(rawBody) as DiditWebhookPayload;
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    // 计算 payload hash 和 event ID
    const payloadHash = computePayloadHash(rawBody);
    const eventId = generateEventId(body, payloadHash);

    // P0 安全修复：幂等去重检查
    const { isDuplicate } = await checkAndRecordEvent("didit", eventId, payloadHash);
    if (isDuplicate) {
      // 返回 200 表示请求已被接受（幂等）
      return NextResponse.json(
        { success: true, message: "Event already processed", dedup: true },
        { status: 200 }
      );
    }

    // 日志记录（不包含敏感信息）
    logger.info("[webhook/didit] Processing webhook", {
      eventId,
      userId: body.user_id,
      status: body.status,
    });

    // 处理 KYC 状态更新
    if (body.user_id && body.status) {
      const success = await updateKYCStatus(body.user_id, body.status);

      if (success) {
        return NextResponse.json({ success: true, message: "KYC status updated" }, { status: 200 });
      }

      return NextResponse.json(
        { success: false, error: "Failed to update KYC status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: false, message: "Invalid webhook data" }, { status: 400 });
  } catch (err: unknown) {
    logger.error("[webhook/didit] Error", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 支持 GET 请求用于验证（某些 webhook 服务需要）
export async function GET(_request: NextRequest) {
  return NextResponse.json({ message: "Didit webhook endpoint", status: "ready" }, { status: 200 });
}
