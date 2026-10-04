import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin, getStoreById } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import type { Product } from "@/lib/validation";

export async function POST(request: Request) {
  let body: { storeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Send the request as JSON." },
      { status: 400 },
    );
  }

  const { storeId } = body;
  if (!storeId || typeof storeId !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid_store_id", message: "Store ID is required." },
      { status: 400 },
    );
  }

  // 1. Authenticate user
  const user = await getAuthenticatedUser();
  const cookieStore = await cookies();
  const ownerCookie = cookieStore.get(`owner_${storeId}`)?.value;

  if (!user && !ownerCookie) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Please sign in to publish this store.",
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
            message: "You are not authorized to publish this store.",
          },
          { status: 403 },
        );
      }
      if (store.owner_id && !user) {
        return NextResponse.json(
          {
            ok: false,
            error: "unauthorized",
            message: "Authentication required to publish this store.",
          },
          { status: 401 },
        );
      }
    }
  } catch {
    // Continue if transient
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch all products for the store
    const { data: rows, error: fetchErr } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId);

    if (fetchErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_error",
          message: "Couldn't load store products. Try again.",
        },
        { status: 500 },
      );
    }

    const products = (rows || []) as Product[];

    if (products.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_products",
          message: "Scan and add at least one product before publishing.",
        },
        { status: 400 },
      );
    }

    // 2. Validate that every product is ready
    const notReady = products.filter(
      (p) =>
        !p.name ||
        p.name.trim() === "" ||
        p.price === null ||
        p.stock === null ||
        (p.status !== "confirmed" && p.status !== "published"),
    );

    if (notReady.length > 0) {
      const needsPriceCount = notReady.filter((p) => p.price === null).length;
      const needsStockCount = notReady.filter((p) => p.stock === null).length;
      const needsConfirmCount = notReady.filter(
        (p) => p.price !== null && p.stock !== null && p.status === "detected",
      ).length;

      const reasons: string[] = [];
      if (needsPriceCount > 0) {
        reasons.push(
          `${needsPriceCount} ${needsPriceCount === 1 ? "product needs" : "products need"} a price`,
        );
      }
      if (needsStockCount > 0) {
        reasons.push(
          `${needsStockCount} ${needsStockCount === 1 ? "product needs" : "products need"} stock`,
        );
      }
      if (needsConfirmCount > 0) {
        reasons.push(
          `${needsConfirmCount} ${needsConfirmCount === 1 ? "product needs" : "products need"} confirmation`,
        );
      }

      const reasonSentence = reasons.join(", ");

      return NextResponse.json(
        {
          ok: false,
          error: "not_ready",
          message: `${reasonSentence} before publishing.`,
          notReady: notReady.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            status: p.status,
          })),
        },
        { status: 400 },
      );
    }

    // 3. Mark all products published
    const now = new Date().toISOString();

    const { error: prodUpdateErr } = await supabase
      .from("products")
      .update({
        status: "published",
        updated_at: now,
      })
      .eq("store_id", storeId);

    if (prodUpdateErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_error",
          message: "Couldn't update products. Nothing was published.",
        },
        { status: 500 },
      );
    }

    // 4. Update store published_at
    const { error: storeUpdateErr } = await supabase
      .from("stores")
      .update({
        published_at: now,
        updated_at: now,
      })
      .eq("id", storeId);

    if (storeUpdateErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "db_error",
          message: "Couldn't set store publish time.",
        },
        { status: 500 },
      );
    }

    // 5. Write inventory event
    await supabase.from("inventory_events").insert({
      store_id: storeId,
      product_name: "Store published",
      event_type: "store_published",
      new_value: now,
      source: "manual",
    });

    return NextResponse.json({
      ok: true,
      published_at: now,
      publicUrl: `/store/${storeId}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Publishing failed";
    return NextResponse.json(
      { ok: false, error: "server_error", message: msg },
      { status: 500 },
    );
  }
}
