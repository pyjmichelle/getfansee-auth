import { NextResponse } from "next/server";

/**
 * Health check endpoint for testing and monitoring
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "getfansee",
    },
    { status: 200 }
  );
}
