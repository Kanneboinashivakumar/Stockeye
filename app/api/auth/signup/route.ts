import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/auth";

const signupSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long.")
    .max(128, "Password is too long."),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request payload." },
      { status: 400 },
    );
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Invalid input.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try {
    const admin = getSupabaseAdmin();

    // Create user in Supabase Auth with verified email so they are not blocked by email confirmation
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      let friendlyMessage = createError.message;
      if (
        createError.message.toLowerCase().includes("registered") ||
        createError.message.toLowerCase().includes("already") ||
        createError.message.toLowerCase().includes("unique constraint")
      ) {
        friendlyMessage = "An account with this email already exists. Please sign in.";
      }
      return NextResponse.json(
        { ok: false, message: friendlyMessage },
        { status: 400 },
      );
    }

    if (!userData.user) {
      return NextResponse.json(
        { ok: false, message: "Failed to create account. Please try again." },
        { status: 500 },
      );
    }

    // Immediately establish Supabase Auth session
    const { data: sessionData, error: sessionError } =
      await admin.auth.signInWithPassword({
        email,
        password,
      });

    if (sessionError || !sessionData.session) {
      return NextResponse.json(
        { ok: false, message: "Account created, but could not start session. Please sign in." },
        { status: 500 },
      );
    }

    // Set secure HTTP-only session cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, sessionData.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: userData.user.id,
        email: userData.user.email,
      },
      hasStore: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication service error.";
    return NextResponse.json(
      { ok: false, message: msg },
      { status: 500 },
    );
  }
}
