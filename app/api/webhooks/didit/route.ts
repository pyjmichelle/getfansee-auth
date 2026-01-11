/**
 * Didit Webhook 路由
 * 预留 Didit SDK 接入槽位
 */

import { NextRequest, NextResponse } from "next/server";
import { updateKYCStatus, type KYCStatus } from "@/lib/kyc-service";

type DiditWebhookPayload = {
  user_id?: string;
  status?: KYCStatus;
};

export async function POST(request: NextRequest) {
  try {
    // TODO: Connect to Didit SDK once API keys are ready
    // 当前逻辑：接收 webhook 数据并更新 KYC 状态

    const body = (await request.json()) as DiditWebhookPayload;

    // TODO: 验证 Didit webhook 签名
    // TODO: 解析 Didit 回调数据
    // TODO: 根据 Didit 返回的状态更新用户 KYC 状态

    console.warn("[webhook/didit] Received webhook:", body);

    // Mock 处理逻辑（待接入 Didit SDK）
    if (body.user_id && body.status) {
      const success = await updateKYCStatus(body.user_id, body.status);

      if (success) {
        return NextResponse.json({ success: true, message: "KYC status updated" }, { status: 200 });
      }
    }

    return NextResponse.json({ success: false, message: "Invalid webhook data" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[webhook/didit] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 支持 GET 请求用于验证（某些 webhook 服务需要）
export async function GET(_request: NextRequest) {
  return NextResponse.json({ message: "Didit webhook endpoint", status: "ready" }, { status: 200 });
}
