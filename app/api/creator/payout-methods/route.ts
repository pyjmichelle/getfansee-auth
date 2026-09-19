import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCreator } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { arePaymentsLive } from "@/lib/payments-live";
import { MINIMUM_PAYOUT_CENTS } from "@/lib/constants/fees";
import {
  addPayoutMethod,
  getCreatorWalletBalances,
  isValidPayoutRail,
  isVerifiedCreatorProfile,
  listPayoutMethods,
} from "@/lib/payouts";

export async function GET() {
  try {
    const { user } = await requireVerifiedCreator();
    const [methods, wallet] = await Promise.all([
      listPayoutMethods(user.id),
      getCreatorWalletBalances(user.id),
    ]);

    return NextResponse.json({
      success: true,
      paymentsLive: arePaymentsLive(),
      minimumCents: MINIMUM_PAYOUT_CENTS,
      methods,
      availableCents: wallet.availableCents,
      pendingCents: wallet.pendingCents,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!arePaymentsLive()) {
      return NextResponse.json(
        { success: false, error: "Payouts are not available yet." },
        { status: 403 }
      );
    }

    const { user } = await requireVerifiedCreator();
    if (!(await isVerifiedCreatorProfile(user.id))) {
      return NextResponse.json(
        {
          success: false,
          error: "Identity verification is required before adding a payout method.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      rail?: unknown;
      destination?: unknown;
      label?: unknown;
      isDefault?: unknown;
    } | null;

    if (!isValidPayoutRail(body?.rail)) {
      return NextResponse.json(
        { success: false, error: "rail must be payram_crypto or paxum" },
        { status: 400 }
      );
    }
    if (typeof body?.destination !== "string" || body.destination.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "destination is required" },
        { status: 400 }
      );
    }

    const result = await addPayoutMethod({
      creatorId: user.id,
      rail: body.rail,
      destination: body.destination,
      label: typeof body.label === "string" ? body.label : null,
      isDefault: body.isDefault !== false,
    });

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, method: result.method });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
