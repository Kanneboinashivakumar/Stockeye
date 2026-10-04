"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { ProductRow } from "@/components/ProductRow";
import type { Product } from "@/lib/validation";

interface ReviewScreenProps {
  storeId: string;
  storeName: string;
  initialPublishedAt: string | null;
}

export function ReviewScreen({
  storeId,
  storeName,
  initialPublishedAt,
}: ReviewScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(Boolean(initialPublishedAt));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);

  // Load products from server
  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/tools?storeId=${storeId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      }
    } catch {
      setErrorMsg("Failed to load products. Refresh to retry.");
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    let isCancelled = false;

    async function init() {
      try {
        const res = await fetch(`/api/tools?storeId=${storeId}`);
        if (res.ok && !isCancelled) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.products)) {
            setProducts(data.products);
          }
        }
      } catch {
        if (!isCancelled) {
          setErrorMsg("Failed to load products. Refresh to retry.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      isCancelled = true;
    };
  }, [storeId]);

  // Check if a product is ready to publish
  const isProductReady = (p: Product): boolean => {
    return Boolean(
      p.name?.trim() &&
        p.price !== null &&
        p.stock !== null &&
        (p.status === "confirmed" || p.status === "published"),
    );
  };

  // Sort: products needing attention come first
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aReady = isProductReady(a);
      const bReady = isProductReady(b);
      if (!aReady && bReady) return -1;
      if (aReady && !bReady) return 1;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [products]);

  const totalCount = products.length;
  const readyCount = products.filter(isProductReady).length;
  const notReadyList = products.filter((p) => !isProductReady(p));
  const allReady = totalCount > 0 && notReadyList.length === 0;

  // Build missing reason string for the disabled publish button
  const missingReason = useMemo(() => {
    if (totalCount === 0) return "Add products before publishing.";
    if (notReadyList.length === 0) return null;

    const needsPrice = notReadyList.filter((p) => p.price === null).length;
    const needsStock = notReadyList.filter((p) => p.stock === null).length;
    const needsConfirm = notReadyList.filter(
      (p) => p.price !== null && p.stock !== null && p.status === "detected",
    ).length;

    const reasons: string[] = [];
    if (needsPrice > 0) {
      reasons.push(
        `${needsPrice} ${needsPrice === 1 ? "product needs" : "products need"} a price`,
      );
    }
    if (needsStock > 0) {
      reasons.push(
        `${needsStock} ${needsStock === 1 ? "product needs" : "products need"} stock`,
      );
    }
    if (needsConfirm > 0) {
      reasons.push(
        `${needsConfirm} ${needsConfirm === 1 ? "product needs" : "products need"} confirmation`,
      );
    }

    return reasons.join(", ");
  }, [totalCount, notReadyList]);

  // Confirm single product
  const handleConfirmProduct = async (productId: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          tool: "confirm_product",
          args: { product_ref: productId },
          source: "manual",
        }),
      });
      const data = await res.json();
      if (data.ok && data.product) {
        const updated = data.product as Product;
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        setHighlightedId(updated.id);
        setTimeout(() => setHighlightedId(null), 600);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Confirm all complete products
  const handleConfirmAllComplete = async () => {
    const toConfirm = products.filter(
      (p) =>
        p.name?.trim() &&
        p.price !== null &&
        p.stock !== null &&
        p.status === "detected",
    );

    if (toConfirm.length === 0) return;

    setIsConfirmingAll(true);
    for (const prod of toConfirm) {
      await handleConfirmProduct(prod.id);
    }
    setIsConfirmingAll(false);
  };

  // Save changes to single product
  const handleSaveProduct = async (
    product: Product,
    fields: {
      name?: string;
      size?: string | null;
      category?: string | null;
      price?: number | null;
      stock?: number | null;
    },
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          tool: "update_product",
          args: {
            product_ref: product.id,
            name: fields.name,
            size: fields.size,
            category: fields.category,
            price: fields.price,
            stock: fields.stock,
          },
          source: "manual",
        }),
      });
      const data = await res.json();
      if (data.ok && data.product) {
        const updated = data.product as Product;
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        setHighlightedId(updated.id);
        setTimeout(() => setHighlightedId(null), 600);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          tool: "remove_product",
          args: { product_ref: productId },
          source: "manual",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Publish store
  const handlePublish = async () => {
    if (!allReady || isPublishing) return;
    setErrorMsg(null);
    setIsPublishing(true);

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsPublished(true);
        // Refresh products so status shows published
        void loadProducts();
      } else {
        setErrorMsg(data.message || "Failed to publish store.");
      }
    } catch {
      setErrorMsg("Connection failed. Try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Export CSV for seller app
  const handleExportCsv = () => {
    const readyProducts = products.filter(isProductReady);
    const headers = ["Name", "Brand", "Variant", "Size", "Category", "Price", "Stock"];
    const rows = readyProducts.map((p) => [
      `"${(p.name || "").replace(/"/g, '""')}"`,
      `"${(p.brand || "").replace(/"/g, '""')}"`,
      `"${(p.variant || "").replace(/"/g, '""')}"`,
      `"${(p.size || "").replace(/"/g, '""')}"`,
      `"${(p.category || "").replace(/"/g, '""')}"`,
      p.price !== null ? p.price : "",
      p.stock !== null ? p.stock : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const cleanStoreName = storeName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    link.setAttribute("href", url);
    link.setAttribute("download", `stockeye-${cleanStoreName}-inventory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/store/${storeId}`
    : `/store/${storeId}`;

  // Published Confirmation View
  if (isPublished) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-12 max-w-xl mx-auto">
        <div className="text-center space-y-6">
          <Logo size="sm" asLink href="/" className="mx-auto" />

          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-leaf-tint text-leaf mx-auto">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="font-heading text-[28px] text-ink">Store published</h1>
          <p className="text-[15px] text-ink-muted">
            Your catalogue is live and customer ready. Share the link or QR code below.
          </p>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-surface rounded-[8px] border border-line">
            <QRCodeSVG value={publicUrl} size={180} />
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 text-[14px] font-medium text-leaf underline truncate max-w-full"
            >
              {publicUrl}
            </a>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <Link
              href={`/store/${storeId}`}
              className="flex h-12 w-full items-center justify-center rounded-[8px] bg-leaf text-[15px] font-medium text-white hover:bg-leaf/90"
            >
              Open store
            </Link>

            <Link
              href={`/dashboard/[storeId]`.replace("[storeId]", storeId)}
              className="flex h-12 w-full items-center justify-center rounded-[8px] border border-line bg-surface text-[15px] font-medium text-ink hover:bg-paper"
            >
              Open dashboard
            </Link>

            <Link
              href={`/scan/${storeId}`}
              className="flex h-12 w-full items-center justify-center text-[15px] font-medium text-ink-muted hover:text-ink"
            >
              Keep scanning
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-paper pb-32">
      {/* Top Header */}
      <header className="border-b border-line bg-surface px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo size="sm" asLink href="/" />
            <div className="hidden sm:block h-6 w-px bg-line" />
            <div>
              <span className="text-[13px] text-ink-muted">{storeName}</span>
              <h1 className="font-heading text-[20px] text-ink">
                {totalCount} {totalCount === 1 ? "product" : "products"},{" "}
                {readyCount} ready
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/scan/${storeId}`}
              className="text-[14px] font-medium text-leaf underline hover:text-leaf/80"
            >
              Keep scanning
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 flex items-center justify-between rounded-[8px] bg-brick-tint p-4 text-[14px] text-ink">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="font-medium text-brick underline ml-2 min-h-[44px] px-2 inline-flex items-center"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Toolbar: Confirm all complete and Export CSV */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleConfirmAllComplete}
            disabled={isConfirmingAll || totalCount === 0}
            className="min-h-[44px] rounded-[8px] border border-line bg-surface px-4 text-[13px] font-medium text-ink hover:bg-paper disabled:opacity-50"
          >
            {isConfirmingAll ? "Confirming..." : "Confirm all that are complete"}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={readyCount === 0}
            className="min-h-[44px] rounded-[8px] border border-line bg-surface px-4 text-[13px] font-medium text-ink hover:bg-paper disabled:opacity-50"
          >
            Export for seller app
          </button>
        </div>

        {/* Products List */}
        {isLoading ? (
          <div className="p-12 text-center text-[14px] text-ink-muted">
            Loading catalogue...
          </div>
        ) : totalCount === 0 ? (
          <div className="p-12 text-center bg-surface rounded-[8px] border border-line">
            <h3 className="font-heading text-[18px] text-ink">No products yet</h3>
            <p className="mt-2 text-[14px] text-ink-muted">
              Point your camera at a shelf to start adding products.
            </p>
            <div className="mt-4">
              <Link
                href={`/scan/${storeId}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-leaf px-5 text-[14px] font-medium text-white hover:bg-leaf/90"
              >
                Start scanning
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-[8px] border border-line bg-surface divide-y divide-line overflow-hidden">
            {sortedProducts.map((prod) => (
              <ProductRow
                key={prod.id}
                product={prod}
                isHighlighted={highlightedId === prod.id}
                onSave={(fields) => handleSaveProduct(prod, fields)}
                onDelete={() => handleDeleteProduct(prod.id)}
                onConfirm={() => handleConfirmProduct(prod.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Sticky Bottom Bar */}
      <footer className="fixed bottom-0 inset-x-0 z-20 border-t border-line bg-surface p-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13px] text-ink-muted">
              {allReady
                ? "Every product has price, stock, and confirmation."
                : missingReason}
            </span>
            <Link
              href={`/scan/${storeId}`}
              className="text-[13px] text-leaf underline mt-0.5 inline-block py-1"
            >
              Keep scanning
            </Link>
          </div>

          <button
            type="button"
            onClick={handlePublish}
            disabled={!allReady || isPublishing}
            className="flex min-h-[44px] h-12 items-center justify-center rounded-[8px] bg-leaf px-6 text-[15px] font-medium text-white hover:bg-leaf/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPublishing ? "Publishing store..." : "Publish store"}
          </button>
        </div>
      </footer>
    </div>
  );
}
