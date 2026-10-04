import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { storeSchema, type Store } from "@/lib/validation";

/**
 * Privileged Supabase Admin Client using SUPABASE_SERVICE_ROLE_KEY.
 * Never exposes credentials to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Backward compatibility alias for server-side database access.
 */
export const getSupabaseServer = getSupabaseAdmin;

/**
 * Official Supabase SSR Client for server components & routes.
 * Reads & writes cookies for Supabase Auth session tracking.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Can be safely ignored if invoked from a read-only Server Component
        }
      },
    },
  });
}

/**
 * Retrieves a store by its unique UUID.
 */
export async function getStoreById(id: string): Promise<Store | null> {
  if (!z.string().uuid().safeParse(id).success) {
    return null;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the store");
  }
  if (!data) {
    return null;
  }

  const parsed = storeSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Could not load the store");
  }
  return parsed.data;
}

/**
 * Retrieves the store owned by an authenticated Supabase user.
 */
export async function getStoreByOwnerId(ownerId: string): Promise<Store | null> {
  if (!z.string().uuid().safeParse(ownerId).success) {
    return null;
  }
  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const parsed = storeSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
