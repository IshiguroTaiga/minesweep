import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateLiveStatus } from "@/lib/db";
import { decryptSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in." },
        { status: 401 }
      );
    }

    const username = decryptSession(sessionToken);
    if (!username || username.toLowerCase() !== "ishi") {
      return NextResponse.json(
        { error: "Forbidden. Only the developer account can trigger broadcasts." },
        { status: 403 }
      );
    }

    // 2. Parse trigger details
    const { type, value } = await request.json();

    if (!type || !["sound", "announcement", "clear"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid trigger type. Must be sound, announcement, or clear." },
        { status: 400 }
      );
    }

    // 3. Update database
    if (type === "sound") {
      await updateLiveStatus({
        soundToPlay: value,
        soundTimestamp: Date.now(),
      });
    } else if (type === "announcement") {
      await updateLiveStatus({
        announcement: value,
        announcementTimestamp: Date.now(),
      });
    } else if (type === "clear") {
      await updateLiveStatus({
        announcement: null,
        announcementTimestamp: Date.now(),
      });
    }

    return NextResponse.json({ success: true, message: `${type} updated successfully.` });
  } catch (error) {
    console.error("Developer Trigger POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
