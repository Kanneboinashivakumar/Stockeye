import { EmptyState } from "@/components/EmptyState";
import { getStoreById } from "@/lib/supabase/server";

export async function StorePlaceholder({
  storeId,
  title,
}: {
  storeId: string;
  title: string;
}) {
  let storeName: string | null = null;
  let loadError = false;

  try {
    const store = await getStoreById(storeId);
    storeName = store?.store_name ?? null;
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

  if (!storeName) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-16">
        <h1 className="font-heading text-[28px] text-ink">Store not found</h1>
        <p className="mt-3 max-w-[40ch] text-ink-muted">
          That link does not match a store.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper px-6 py-16">
      <p className="text-[14px] text-ink-muted">{title}</p>
      <h1 className="mt-2 font-heading text-[28px] text-ink">{storeName}</h1>
    </main>
  );
}
