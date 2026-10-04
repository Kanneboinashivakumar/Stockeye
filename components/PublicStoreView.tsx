"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { Logo } from "@/components/Logo";
import type { Product } from "@/lib/validation";

interface PublicStoreViewProps {
  storeName: string;
  vendorName: string;
  city: string | null;
  products: Product[];
}

export function PublicStoreView({
  storeName,
  vendorName,
  city,
  products,
}: PublicStoreViewProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchCategory = p.category?.toLowerCase().includes(q);
      const matchBrand = p.brand?.toLowerCase().includes(q);
      const matchSize = p.size?.toLowerCase().includes(q);
      return matchName || matchCategory || matchBrand || matchSize;
    });
  }, [products, query]);

  // Group by category
  const categories = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const prod of filtered) {
      const cat = prod.category?.trim() || "All items";
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(prod);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="min-h-dvh bg-paper text-ink pb-20">
      {/* Header */}
      <header className="border-b border-line bg-surface px-4 py-8 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <span className="text-[13px] text-ink-muted">
            {vendorName}
            {city ? ` • ${city}` : ""}
          </span>
          <h1 className="mt-1 font-heading text-[28px] text-ink">
            {storeName}
          </h1>

          {/* Search Box */}
          <div className="mt-5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items by name or category..."
              aria-label="Search items by name or category"
              className="h-12 w-full rounded-[8px] border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-muted focus:border-leaf focus:outline-none"
            />
          </div>
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {products.length === 0 ? (
          <div className="p-12 text-center text-ink-muted text-[15px]">
            This store doesn&apos;t have any items in stock yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-ink-muted text-[15px]">
            No products found matching &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(([categoryName, items]) => (
              <section key={categoryName}>
                <h2 className="mb-2 text-[14px] font-semibold text-ink-muted">
                  {categoryName}
                </h2>
                <div className="rounded-[8px] border border-line bg-surface divide-y divide-line overflow-hidden">
                  {items.map((item) => {
                    const inStock = item.stock !== null && item.stock > 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <img
                            src={`/api/product-image?name=${encodeURIComponent(item.name)}`}
                            alt={item.name}
                            className="h-11 w-11 rounded-[6px] object-cover shrink-0 border border-line bg-surface"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.onerror = null;
                              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88' viewBox='0 0 88 88'%3E%3Crect width='88' height='88' rx='8' fill='%231E5B43' fill-opacity='0.10'/%3E%3Ctext x='44' y='48' font-size='28' text-anchor='middle'%3E📦%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-ink text-[16px] truncate">
                              {item.name}
                            </span>
                            {item.size && (
                              <span className="text-[13px] text-ink-muted">
                                {item.size}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 tabular text-right">
                          <span className="font-semibold text-ink text-[16px]">
                            {formatCurrency(item.price)}
                          </span>
                          <span
                            className={`text-[12px] font-medium ${
                              inStock ? "text-leaf" : "text-ink-muted"
                            }`}
                          >
                            {inStock ? "In stock" : "Out of stock"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-12 pt-8 border-t border-line flex flex-col items-center justify-center gap-1">
          <Logo size="sm" asLink href="/" />
          <span className="text-[12px] text-ink-muted">Catalog digitized with Stockeye</span>
        </footer>
      </main>
    </div>
  );
}
