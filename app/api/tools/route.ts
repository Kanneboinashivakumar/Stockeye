import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin, getStoreById } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { toolRequestSchema, type Product } from "@/lib/validation";
import { executeTool } from "@/lib/tools";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Send the request as JSON." },
      { status: 400 },
    );
  }

  const parsed = toolRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Invalid request payload";
    return NextResponse.json(
      { ok: false, error: "invalid_payload", message: firstIssue },
      { status: 400 },
    );
  }

  const { storeId, tool, args, source } = parsed.data;

  // 1. Authenticate user via Supabase Auth
  const user = await getAuthenticatedUser();
  const cookieStore = await cookies();
  const ownerCookie = cookieStore.get(`owner_${storeId}`)?.value;

  // Reject unauthenticated requests
  if (!user && !ownerCookie) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "You must be signed in to modify store inventory.",
      },
      { status: 401 },
    );
  }

  // 2. Validate store ownership against Supabase
  try {
    const store = await getStoreById(storeId);
    if (store) {
      if (store.owner_id && user && store.owner_id !== user.id) {
        return NextResponse.json(
          {
            ok: false,
            error: "forbidden",
            message: "You are not authorized to update this store.",
          },
          { status: 403 },
        );
      }
      if (store.owner_id && !user) {
        return NextResponse.json(
          {
            ok: false,
            error: "unauthorized",
            message: "Authentication required to update this store.",
          },
          { status: 401 },
        );
      }
    }
  } catch {
    // Continue if transient
  }

  const result = await executeTool(storeId, tool, args, source);

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid_arguments" || result.error === "invalid"
        ? 400
        : result.error === "ambiguous" || result.error === "review_required"
        ? 200 // Model receives ambiguous or review_required as a valid tool response to handle
        : 500;

    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json(
      { ok: false, error: "missing_store_id", message: "storeId is required." },
      { status: 400 },
    );
  }

  // 1. Authenticate user via Supabase Auth
  const user = await getAuthenticatedUser();
  const cookieStore = await cookies();
  const ownerCookie = cookieStore.get(`owner_${storeId}`)?.value;

  if (!user && !ownerCookie) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Please sign in to view store inventory.",
      },
      { status: 401 },
    );
  }

  // 2. Validate store ownership
  try {
    const store = await getStoreById(storeId);
    if (store) {
      if (store.owner_id && user && store.owner_id !== user.id) {
        return NextResponse.json(
          {
            ok: false,
            error: "forbidden",
            message: "You are not authorized to view this store.",
          },
          { status: 403 },
        );
      }
    }
  } catch {
    // Continue if transient
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "db_error", message: "Failed to load products." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      products: (data || []) as Product[],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database unavailable";
    return NextResponse.json(
      { ok: false, error: "db_error", message: msg },
      { status: 500 },
    );
  }
}
