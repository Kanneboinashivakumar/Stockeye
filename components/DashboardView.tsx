"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { StatusChip } from "@/components/StatusChip";
import type { Product, InventoryEvent } from "@/lib/validation";

interface DashboardViewProps {
  storeId: string;
  storeName: string;
  products: Product[];
  events: InventoryEvent[];
  lowStockThreshold: number;
}

type TabKey = "overview" | "inventory" | "activity";
type SortField = "name" | "category" | "price" | "stock" | "value" | "status" | "updated_at";
type SortDirection = "asc" | "desc";

export function formatEventSentence(event: InventoryEvent): string {
  switch (event.event_type) {
    case "product_added":
      return `${event.product_name} added`;
    case "product_confirmed":
      return `${event.product_name} confirmed`;
    case "price_updated":
      return `${event.product_name}: price ${event.old_value ? "₹" + event.old_value : "unset"} to ₹${event.new_value}`;
    case "stock_updated":
      return `${event.product_name}: stock ${event.old_value ?? "unset"} to ${event.new_value}`;
    case "details_updated":
      return `${event.product_name}: details updated`;
    case "product_removed":
      return `${event.product_name} removed`;
    case "store_published":
      return "Store published";
    default:
      return `${event.product_name}: updated`;
  }
}

export function DashboardView({
  storeId,
  storeName,
  products,
  events,
  lowStockThreshold,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Inventory filters & sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Activity pagination state
  const [activityLimit, setActivityLimit] = useState(50);

  // Overview calculations
  const totalProducts = products.length;

  const inventoryValue = useMemo(() => {
    return products.reduce((acc, p) => {
      if (p.price !== null && p.stock !== null) {
        return acc + p.price * p.stock;
      }
      return acc;
    }, 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.stock !== null &&
        p.stock > 0 &&
        p.stock <= lowStockThreshold,
    );
  }, [products, lowStockThreshold]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.stock === 0).length;
  }, [products]);

  const categoriesCount = useMemo(() => {
    const cats = new Set(
      products.map((p) => p.category?.trim()).filter(Boolean),
    );
    return cats.size;
  }, [products]);

  const categoryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const cat = p.category?.trim() || "Uncategorized";
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  const maxCategoryCount = useMemo(() => {
    return categoryDistribution.reduce((m, c) => Math.max(m, c.count), 1);
  }, [categoryDistribution]);

  const newestEvent = events[0] || null;

  // Filtered & sorted products for Inventory view
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.category?.toLowerCase().includes(q)) {
        return false;
      }
      if (categoryFilter !== "all" && (p.category?.trim() || "Uncategorized") !== categoryFilter) {
        return false;
      }
      if (lowStockOnly) {
        if (p.stock === null || p.stock > lowStockThreshold) {
          return false;
        }
      }
      return true;
    });
  }, [products, searchQuery, categoryFilter, lowStockOnly, lowStockThreshold]);

  const sortedInventory = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "name":
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case "category":
          valA = (a.category || "").toLowerCase();
          valB = (b.category || "").toLowerCase();
          break;
        case "price":
          valA = a.price ?? -1;
          valB = b.price ?? -1;
          break;
        case "stock":
          valA = a.stock ?? -1;
          valB = b.stock ?? -1;
          break;
        case "value":
          valA = a.price !== null && a.stock !== null ? a.price * a.stock : -1;
          valB = b.price !== null && b.stock !== null ? b.price * b.stock : -1;
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        case "updated_at":
          valA = new Date(a.updated_at).getTime();
          valB = new Date(b.updated_at).getTime();
          break;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const allCategoriesList = useMemo(() => {
    const cats = new Set(
      products.map((p) => p.category?.trim() || "Uncategorized"),
    );
    return Array.from(cats).sort();
  }, [products]);

  // Empty state if 0 products in store
  if (totalProducts === 0) {
    return (
      <div className="min-h-dvh bg-paper flex flex-col md:flex-row">
        {/* Left rail */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-line bg-surface p-6 flex flex-col justify-between">
          <div className="flex flex-col items-start gap-2.5">
            <Logo size="sm" asLink href="/" />
            <div>
              <span className="text-[13px] text-ink-muted block">
                Dashboard
              </span>
              <h2 className="mt-0.5 font-heading text-[20px] text-ink truncate">
                {storeName}
              </h2>
            </div>
          </div>
          <div className="pt-6 border-t border-line space-y-2">
            <Link
              href={`/scan/${storeId}`}
              className="block text-[14px] text-leaf hover:underline"
            >
              Start scanning
            </Link>
          </div>
        </aside>

        {/* Empty state content */}
        <main className="flex-1 p-8 sm:p-16 flex items-center justify-center">
          <div className="text-center max-w-md">
            <h3 className="font-heading text-[24px] text-ink">
              No products added yet
            </h3>
            <p className="mt-2 text-[15px] text-ink-muted">
              Start digitizing your shelves by pointing your phone camera and speaking.
            </p>
            <div className="mt-6">
              <Link
                href={`/scan/${storeId}`}
                className="inline-flex h-12 items-center justify-center rounded-[8px] bg-leaf px-6 text-[15px] font-medium text-white hover:bg-leaf/90"
              >
                Start scanning
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper flex flex-col md:flex-row text-ink">
      {/* Left Rail (Desktop) / Top Bar (Mobile) */}
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-line bg-surface p-4 md:p-6 flex flex-col justify-between">
        <div>
          <div className="mb-6 flex flex-col items-start gap-2.5">
            <Logo size="sm" asLink href="/" />
            <div>
              <span className="text-[13px] text-ink-muted block">
                Dashboard
              </span>
              <h1 className="mt-0.5 font-heading text-[22px] text-ink truncate">
                {storeName}
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`min-h-[44px] h-11 rounded-[8px] px-3.5 text-left text-[14px] font-medium transition-colors shrink-0 inline-flex items-center ${
                activeTab === "overview"
                  ? "bg-leaf-tint text-leaf"
                  : "text-ink-muted hover:bg-paper hover:text-ink"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inventory")}
              className={`min-h-[44px] h-11 rounded-[8px] px-3.5 text-left text-[14px] font-medium transition-colors shrink-0 inline-flex items-center ${
                activeTab === "inventory"
                  ? "bg-leaf-tint text-leaf"
                  : "text-ink-muted hover:bg-paper hover:text-ink"
              }`}
            >
              Inventory ({totalProducts})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`min-h-[44px] h-11 rounded-[8px] px-3.5 text-left text-[14px] font-medium transition-colors shrink-0 inline-flex items-center ${
                activeTab === "activity"
                  ? "bg-leaf-tint text-leaf"
                  : "text-ink-muted hover:bg-paper hover:text-ink"
              }`}
            >
              Activity ({events.length})
            </button>
          </nav>
        </div>

        {/* Bottom Rail Links */}
        <div className="hidden md:block pt-6 border-t border-line space-y-2">
          <Link
            href={`/scan/${storeId}`}
            className="block text-[14px] text-leaf hover:underline"
          >
            Keep scanning
          </Link>
          <Link
            href={`/store/${storeId}`}
            className="block text-[14px] text-ink-muted hover:text-ink"
          >
            Open public store
          </Link>
          <Link
            href={`/review/${storeId}`}
            className="block text-[14px] text-ink-muted hover:text-ink"
          >
            Review catalogue
          </Link>
          <div className="pt-2 border-t border-line mt-2">
            <LogoutButton className="text-[13px] text-ink-muted hover:text-ink py-1 block w-full text-left" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl overflow-y-auto">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              {/* Four Plain Figures Divided by Hairlines */}
              <div className="grid grid-cols-2 md:grid-cols-4 border-y border-line divide-y md:divide-y-0 md:divide-x divide-line bg-surface">
                <div className="p-5 sm:p-6">
                  <span className="text-[13px] text-ink-muted">Products</span>
                  <div className="mt-2 text-[28px] font-semibold text-ink tabular">
                    {totalProducts}
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <span className="text-[13px] text-ink-muted">
                    Inventory value
                  </span>
                  <div className="mt-2 text-[28px] font-semibold text-ink tabular">
                    {formatCurrency(inventoryValue)}
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <span className="text-[13px] text-ink-muted">Low stock</span>
                  <div className="mt-2 text-[28px] font-semibold text-ink tabular">
                    {lowStockProducts.length}
                  </div>
                  <span className="text-[12px] text-ink-muted mt-1 block">
                    {outOfStockCount} out of stock
                  </span>
                </div>

                <div className="p-5 sm:p-6">
                  <span className="text-[13px] text-ink-muted">Categories</span>
                  <div className="mt-2 text-[28px] font-semibold text-ink tabular">
                    {categoriesCount}
                  </div>
                </div>
              </div>

              {/* Last Updated line under figures */}
              <div className="mt-3 text-[13px] text-ink-muted">
                {newestEvent
                  ? `Last updated ${formatRelativeTime(newestEvent.created_at)}`
                  : "No inventory updates yet"}
              </div>
            </div>

            {/* Products by Category Bar Chart */}
            <section className="bg-surface rounded-[8px] border border-line p-6">
              <h3 className="font-heading text-[18px] text-ink">
                Products by category
              </h3>

              {categoryDistribution.length < 2 ? (
                <p className="mt-3 text-[14px] text-ink-muted">
                  Not enough activity yet.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {categoryDistribution.map(({ category, count }) => (
                    <div
                      key={category}
                      className="flex items-center gap-4 text-[14px]"
                    >
                      <span className="w-36 truncate text-ink-muted text-[13px]">
                        {category}
                      </span>
                      <div className="flex-1 h-3 rounded-full bg-paper overflow-hidden">
                        <div
                          className="h-full bg-leaf rounded-full transition-all"
                          style={{
                            width: `${Math.max(
                              4,
                              (count / maxCategoryCount) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right font-medium text-ink tabular text-[13px]">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Activity (top 5) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-[18px] text-ink">
                  Recent activity
                </h3>
                {events.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className="text-[13px] text-leaf underline"
                  >
                    View all ({events.length})
                  </button>
                )}
              </div>

              {events.length === 0 ? (
                <div className="p-6 text-center text-ink-muted text-[14px] bg-surface rounded-[8px] border border-line">
                  No activity recorded yet.
                </div>
              ) : (
                <div className="rounded-[8px] border border-line bg-surface divide-y divide-line overflow-hidden">
                  {events.slice(0, 5).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-4 text-[14px]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-4">
                        <span className="text-ink truncate">
                          {formatEventSentence(ev)}
                        </span>
                        <span className="shrink-0 rounded bg-paper px-2 py-0.5 text-[11px] text-ink-muted">
                          {ev.source}
                        </span>
                      </div>
                      <span className="shrink-0 text-[13px] text-ink-muted tabular">
                        {formatRelativeTime(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-[8px] border border-line">
              <div className="flex-1 max-w-sm">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="h-11 w-full rounded-[8px] border border-line bg-surface px-3 text-[14px] text-ink focus:border-leaf focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                  className="h-11 rounded-[8px] border border-line bg-surface px-3 text-[14px] text-ink focus:border-leaf focus:outline-none"
                >
                  <option value="all">All categories</option>
                  {allCategoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <label className="flex min-h-[44px] items-center gap-2 text-[14px] text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lowStockOnly}
                    onChange={(e) => setLowStockOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-leaf focus:ring-leaf"
                  />
                  <span>Low stock only</span>
                </label>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="rounded-[8px] border border-line bg-surface overflow-x-auto">
              <table className="w-full text-left border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-line bg-paper/60 text-[13px] text-ink-muted font-medium">
                    <th
                      className="p-3.5 cursor-pointer hover:text-ink"
                      onClick={() => handleSort("name")}
                    >
                      Product {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="p-3.5 cursor-pointer hover:text-ink"
                      onClick={() => handleSort("category")}
                    >
                      Category {sortField === "category" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="p-3.5 text-right cursor-pointer hover:text-ink"
                      onClick={() => handleSort("price")}
                    >
                      Price {sortField === "price" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="p-3.5 text-right cursor-pointer hover:text-ink"
                      onClick={() => handleSort("stock")}
                    >
                      Stock {sortField === "stock" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="p-3.5 text-right cursor-pointer hover:text-ink"
                      onClick={() => handleSort("value")}
                    >
                      Value {sortField === "value" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="p-3.5 cursor-pointer hover:text-ink"
                      onClick={() => handleSort("status")}
                    >
                      Status {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="p-3.5 text-right cursor-pointer hover:text-ink"
                      onClick={() => handleSort("updated_at")}
                    >
                      Updated {sortField === "updated_at" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-ink-muted text-[14px]">
                        No matching products found.
                      </td>
                    </tr>
                  ) : (
                    sortedInventory.map((item) => {
                      const itemVal =
                        item.price !== null && item.stock !== null
                          ? item.price * item.stock
                          : null;

                      const statusKind =
                        item.price === null
                          ? "needs-price"
                          : item.stock === null
                          ? "needs-stock"
                          : item.status === "confirmed" || item.status === "published"
                          ? "confirmed"
                          : "needs-price";

                      return (
                        <tr key={item.id} className="hover:bg-paper/30">
                          <td className="p-3.5 font-medium text-ink">
                            <div>{item.name}</div>
                            {item.size && (
                              <div className="text-[12px] text-ink-muted">
                                {item.size}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-ink-muted text-[14px]">
                            {item.category || "—"}
                          </td>
                          <td className="p-3.5 text-right tabular">
                            {item.price !== null ? (
                              formatCurrency(item.price)
                            ) : (
                              <span className="text-[12px] text-turmeric font-medium">
                                Needs price
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right tabular">
                            {item.stock !== null ? (
                              item.stock
                            ) : (
                              <span className="text-[12px] text-turmeric font-medium">
                                Needs stock
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right tabular">
                            {itemVal !== null ? (
                              formatCurrency(itemVal)
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3.5">
                            <StatusChip kind={statusKind} label={item.status} />
                          </td>
                          <td className="p-3.5 text-right text-[13px] text-ink-muted tabular">
                            {formatRelativeTime(item.updated_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-[18px] text-ink">
                Audit Trail ({events.length} events)
              </h3>
            </div>

            {events.length === 0 ? (
              <div className="p-12 text-center text-ink-muted text-[15px] bg-surface rounded-[8px] border border-line">
                No activity recorded yet.
              </div>
            ) : (
              <div className="rounded-[8px] border border-line bg-surface divide-y divide-line overflow-hidden">
                {events.slice(0, activityLimit).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-4 text-[14px]"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <span className="text-ink">
                        {formatEventSentence(ev)}
                      </span>
                      <span className="rounded bg-paper px-2 py-0.5 text-[11px] text-ink-muted shrink-0">
                        {ev.source}
                      </span>
                    </div>
                    <span className="text-[13px] text-ink-muted tabular shrink-0">
                      {formatRelativeTime(ev.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {events.length > activityLimit && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActivityLimit((prev) => prev + 50)}
                  className="min-h-[44px] h-11 rounded-[8px] border border-line bg-surface px-5 text-[14px] font-medium text-ink hover:bg-paper inline-flex items-center justify-center"
                >
                  Load more activity
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
