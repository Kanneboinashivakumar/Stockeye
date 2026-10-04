import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { storeCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  // 1. Require Supabase authenticated user
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "You must be signed in to create a store.",
      },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Send the form as JSON." },
      { status: 400 },
    );
  }

  const parsed = storeCreateSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return NextResponse.json(
      {
        ok: false,
        error: "invalid",
        message: "Check the highlighted fields.",
        fieldErrors,
      },
      { status: 400 },
    );
  }

  const city = parsed.data.city ? parsed.data.city : null;

  try {
    const supabase = getSupabaseAdmin();

    // Insert store explicitly owned by the authenticated Supabase user
    let insertResult = await supabase
      .from("stores")
      .insert({
        owner_id: user.id,
        store_name: parsed.data.store_name,
        vendor_name: parsed.data.vendor_name,
        phone: parsed.data.phone,
        city,
        language: parsed.data.language,
      })
      .select("id, owner_token")
      .single();

    // If owner_id column is not yet migrated in Supabase, fallback gracefully
    if (insertResult.error && insertResult.error.message.includes("owner_id")) {
      insertResult = await supabase
        .from("stores")
        .insert({
          store_name: parsed.data.store_name,
          vendor_name: parsed.data.vendor_name,
          phone: parsed.data.phone,
          city,
          language: parsed.data.language,
        })
        .select("id, owner_token")
        .single();
    }

    const { data, error } = insertResult;

    if (error || !data) {
      return NextResponse.json(
        {
          ok: false,
          error: "save_failed",
          message: error?.message || "Couldn't save the store. Try again.",
        },
        { status: 500 },
      );
    }

    // Set legacy cookie as fallback compatibility
    const cookieStore = await cookies();
    cookieStore.set(`owner_${data.id}`, data.owner_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ id: data.id });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "save_failed",
        message: "Couldn't save the store. Try again.",
      },
      { status: 500 },
    );
  }
}
