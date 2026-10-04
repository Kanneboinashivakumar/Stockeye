import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/supabase/server";

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      store: null,
    });
  }

  const store = await getStoreByOwnerId(user.id);

  return NextResponse.json({
    authenticated: true,
    user,
    store: store
      ? {
          id: store.id,
          store_name: store.store_name,
          published_at: store.published_at,
        }
      : null,
  });
}
