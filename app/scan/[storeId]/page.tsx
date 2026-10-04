import { redirect } from "next/navigation";
import { getStoreById } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { ScanScreen } from "@/components/ScanScreen";
import { EmptyState } from "@/components/EmptyState";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;

  // 1. Require authenticated Supabase user
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/");
  }

  let store = null;
  let hasError = false;

  try {
    store = await getStoreById(storeId);
  } catch {
    hasError = true;
  }

  if (hasError) {
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
          You do not have permission to manage this store.
        </p>
      </main>
    );
  }

  return <ScanScreen storeId={store.id} storeName={store.store_name} />;
}
