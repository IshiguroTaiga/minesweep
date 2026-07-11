import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getScores, addScore } from "@/lib/db";
import { decryptSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get("difficulty") as "easy" | "medium" | "hard" | null;

    if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json(
        { error: "Invalid difficulty parameter. Must be easy, medium, or hard." },
        { status: 400 }
      );
    }

    const scores = await getScores(difficulty);
    return NextResponse.json({ success: true, scores });
  } catch (error) {
    console.error("Leaderboard GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in to submit scores." },
        { status: 401 }
      );
    }

    const username = decryptSession(sessionToken);
    if (!username) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or expired session." },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const { time, difficulty } = await request.json();

    if (typeof time !== "number" || time <= 0) {
      return NextResponse.json(
        { error: "Invalid time. Must be a positive number." },
        { status: 400 }
      );
    }

    if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
      return NextResponse.json(
        { error: "Invalid difficulty. Must be easy, medium, or hard." },
        { status: 400 }
      );
    }

    // 3. Save score
    const newScore = {
      username,
      time: parseFloat(time.toFixed(2)), // Keep 2 decimal places
      difficulty: difficulty as "easy" | "medium" | "hard",
      date: new Date().toISOString(),
    };

    await addScore(newScore);

    // 4. Return updated leaderboard
    const updatedScores = await getScores(difficulty as "easy" | "medium" | "hard");

    return NextResponse.json({
      success: true,
      message: "Score submitted successfully!",
      scores: updatedScores,
    });
  } catch (error) {
    console.error("Leaderboard POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
