import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getStoreById } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

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
        message: "Please sign in to scan this store.",
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
            message: "You are not authorized to scan this store.",
          },
          { status: 403 },
        );
      }
      if (store.owner_id && !user) {
        return NextResponse.json(
          {
            ok: false,
            error: "unauthorized",
            message: "Authentication required to scan this store.",
          },
          { status: 401 },
        );
      }
    }
  } catch {
    // Continue if transient
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "config_error",
        message: "Gemini API key is not configured on the server.",
      },
      { status: 500 },
    );
  }

  const liveModel = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const now = Date.now();
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 2 * 60 * 1000).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
      },
    });

    if (!token?.name) {
      throw new Error("Failed to mint ephemeral token");
    }

    return NextResponse.json({
      ok: true,
      token: token.name,
      model: liveModel,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to obtain ephemeral token";
    return NextResponse.json(
      {
        ok: false,
        error: "token_mint_failed",
        message: `Could not start live session: ${message}`,
      },
      { status: 500 },
    );
  }
}
