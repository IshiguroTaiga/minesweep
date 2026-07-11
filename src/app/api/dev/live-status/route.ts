import { NextResponse } from "next/server";
import { getLiveStatus } from "@/lib/db";

// Force dynamic fetch to prevent Next.js from caching the response statically
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getLiveStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Live Status GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
