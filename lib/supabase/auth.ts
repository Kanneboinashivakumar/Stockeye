import "server-only";

import { cookies, headers } from "next/headers";
import { getSupabaseAdmin, getSupabaseServerClient } from "./server";

export const AUTH_COOKIE_NAME = "sb_auth_token";

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Validates the current session against Supabase Auth.
 * Returns the authenticated Supabase user or null.
 * Never trusts unauthenticated or spoofed client data.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  // 1. Check direct token cookie or Authorization header
  let accessToken = token;
  if (!accessToken) {
    try {
      const headerList = await headers();
      const authHeader = headerList.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        accessToken = authHeader.slice(7).trim();
      }
    } catch {
      // In non-request context
    }
  }

  const admin = getSupabaseAdmin();

  if (accessToken) {
    try {
      const { data, error } = await admin.auth.getUser(accessToken);
      if (!error && data?.user) {
        return {
          id: data.user.id,
          email: data.user.email ?? undefined,
        };
      }
    } catch {
      // Token invalid or expired
    }
  }

  // 2. Check official @supabase/ssr cookie session if configured
  try {
    const ssrClient = await getSupabaseServerClient();
    if (ssrClient) {
      const { data, error } = await ssrClient.auth.getUser();
      if (!error && data?.user) {
        return {
          id: data.user.id,
          email: data.user.email ?? undefined,
        };
      }
    }
  } catch {
    // SSR client unconfigured or cookies invalid
  }

  return null;
}
