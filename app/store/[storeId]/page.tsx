import type { Metadata } from "next";
import { getStoreById, getSupabaseServer } from "@/lib/supabase/server";
import { PublicStoreView } from "@/components/PublicStoreView";
import { EmptyState } from "@/components/EmptyState";
import type { Product } from "@/lib/validation";

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
        title: `${store.store_name} | Stockeye`,
        description: `Browse in-stock items at ${store.store_name}.`,
      };
    }
  } catch {
    // Fall back to default
  }
  return {
    title: "Store | Stockeye",
  };
}

export default async function PublicStorePage({ params }: PageProps) {
  const { storeId } = await params;

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

  // If not published yet, show honest calm message
  if (!store.published_at) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-16 max-w-md mx-auto text-center">
        <span className="text-[13px] text-ink-muted">{store.store_name}</span>
        <h1 className="mt-2 font-heading text-[28px] text-ink">
          This store isn&apos;t live yet
        </h1>
        <p className="mt-3 text-[15px] text-ink-muted">
          The owner is still setting up their shelf inventory. Check back soon.
        </p>
      </main>
    );
  }

  // Fetch only published products
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "published")
    .order("name", { ascending: true });

  const publishedProducts = (rows || []) as Product[];

  return (
    <PublicStoreView
      storeName={store.store_name}
      vendorName={store.vendor_name}
      city={store.city}
      products={publishedProducts}
    />
  );
}
