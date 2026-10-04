import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, getStoreByOwnerId } from "@/lib/supabase/server";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Invalid input.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      let friendly = "Incorrect email or password.";
      if (error?.message.toLowerCase().includes("email not confirmed")) {
        friendly = "Email address has not been confirmed yet.";
      }
      return NextResponse.json(
        { ok: false, message: friendly },
        { status: 401 },
      );
    }

    // Set secure HTTP-only session cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, data.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Check if user already owns an existing store
    const store = await getStoreByOwnerId(data.user.id);

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      store: store
        ? {
            id: store.id,
            store_name: store.store_name,
            published_at: store.published_at,
          }
        : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication error.";
    return NextResponse.json(
      { ok: false, message: msg },
      { status: 500 },
    );
  }
}
