import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStoreById, getSupabaseAdmin } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardView } from "@/components/DashboardView";
import { EmptyState } from "@/components/EmptyState";
import type { Product, InventoryEvent } from "@/lib/validation";

interface PageProps {
  params: Promise<{ storeId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { storeId } = await params;
  try {
    const store = await getStoreById(storeId);
    if (store) {
      return {
        title: `${store.store_name} Dashboard | Stockeye`,
        description: `Inventory and activity dashboard for ${store.store_name}.`,
      };
    }
  } catch {
    // Fall back to default
  }
  return {
    title: "Dashboard | Stockeye",
  };
}

export default async function DashboardPage({ params }: PageProps) {
  const { storeId } = await params;

  // 1. Require authenticated Supabase user
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/");
  }

  let store = null;
  let loadError = false;

  try {
    store = await getStoreById(storeId);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-16">
        <EmptyState message="Couldn't load this store. Check the connection and try again." />
      </main>
    );
  }

  if (!store) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-16">
        <h1 className="font-heading text-[28px] text-ink">Store not found</h1>
        <p className="mt-3 max-w-[40ch] text-ink-muted">
          That link does not match a store.
        </p>
      </main>
    );
  }

  // 2. Validate store ownership
  if (store.owner_id && store.owner_id !== user.id) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-16">
        <h1 className="font-heading text-[28px] text-ink">Access denied</h1>
        <p className="mt-3 max-w-[40ch] text-ink-muted">
          You do not have permission to access this store&apos;s private dashboard.
        </p>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();

  // Load products
  const { data: prodRows } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  // Load events
  const { data: eventRows } = await supabase
    .from("inventory_events")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(200);

  const products = (prodRows || []) as Product[];
  const events = (eventRows || []) as InventoryEvent[];
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD) || 5;

  return (
    <DashboardView
      storeId={store.id}
      storeName={store.store_name}
      products={products}
      events={events}
      lowStockThreshold={threshold}
    />
  );
}
