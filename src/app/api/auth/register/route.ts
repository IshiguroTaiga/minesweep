import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser, createUser } from "@/lib/db";
import { generateSalt, hashPassword, encryptSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    // Input Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 15) {
      return NextResponse.json(
        { error: "Username must be between 3 and 15 characters" },
        { status: 400 }
      );
    }

    // Alpha-numeric plus underscore validation
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUser(trimmedUsername);
    if (existingUser) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    // Create user
    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    
    await createUser({
      username: trimmedUsername,
      passwordHash,
      salt,
    });

    // Create session token
    const token = encryptSession(trimmedUsername);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({
      success: true,
      user: { username: trimmedUsername },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
