import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser, createUser } from "@/lib/db";
import { hashPassword, generateSalt, encryptSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const normUsername = trimmedUsername.toLowerCase();

    // Auto-seed developer account if it doesn't exist
    if (normUsername === "ishi") {
      const ishiUser = await getUser("ishi");
      if (!ishiUser) {
        const salt = generateSalt();
        const passwordHash = hashPassword("Ishi123", salt);
        await createUser({
          username: "Ishi",
          passwordHash,
          salt,
        });
      }
    }

    // Check if user exists
    const user = await getUser(trimmedUsername);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password
    const computedHash = hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Create session token
    const token = encryptSession(user.username);

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
      user: { username: user.username },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
