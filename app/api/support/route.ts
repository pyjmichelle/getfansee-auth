import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSupportTicketNotification } from "@/lib/email";

type SupportTicketPayload = {
  userId?: string | null;
  email: string;
  reason: string;
  subject: string;
  message: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SupportTicketPayload;
    const { userId, email, reason, subject, message } = body;

    if (!email || !reason || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
    }

    if (message.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: "Message is too short (minimum 10 characters)" },
        { status: 400 }
      );
    }

    const adminSupabase = getSupabaseAdminClient();

    const { error } = await adminSupabase.from("support_tickets").insert({
      ...(userId ? { user_id: userId } : {}),
      email: email.trim(),
      category: reason,
      subject: subject.trim(),
      message: message.trim(),
    });

    if (error) {
      console.error("[api/support] insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to submit ticket" },
        { status: 500 }
      );
    }

    sendSupportTicketNotification({
      ticketEmail: email.trim(),
      category: reason,
      subject: subject.trim(),
      message: message.trim(),
      userId: userId || null,
    }).catch((err) => {
      console.error("[api/support] email notification error:", err);
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/support] POST error:", err);
    const msg = err instanceof Error ? err.message : "";
    const isSensitive = msg.includes("SERVICE_ROLE_KEY") || msg.includes(".env");
    return NextResponse.json(
      {
        success: false,
        error: isSensitive ? "Service temporarily unavailable" : "Internal server error",
      },
      { status: 500 }
    );
  }
}
