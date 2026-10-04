"use client";

import { useState } from "react";
import { StatusChip } from "@/components/StatusChip";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/validation";

interface ProductRowProps {
  product: Product;
  isHighlighted?: boolean;
  onSave: (fields: {
    name?: string;
    size?: string | null;
    category?: string | null;
    price?: number | null;
    stock?: number | null;
  }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onConfirm?: () => Promise<boolean>;
}

export function ProductRow({
  product,
  isHighlighted = false,
  onSave,
  onDelete,
  onConfirm,
}: ProductRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [size, setSize] = useState(product.size ?? "");
  const [category, setCategory] = useState(product.category ?? "");
  const [price, setPrice] = useState(
    product.price !== null ? String(product.price) : "",
  );
  const [stock, setStock] = useState(
    product.stock !== null ? String(product.stock) : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getStatusChipProps = () => {
    if (product.price === null) {
      return { kind: "needs-price" as const, label: "Needs price" };
    }
    if (product.stock === null) {
      return { kind: "needs-stock" as const, label: "Needs stock" };
    }
    if (product.status === "confirmed" || product.status === "published") {
      return { kind: "confirmed" as const, label: "Confirmed" };
    }
    return { kind: "needs-price" as const, label: "Needs confirmation" };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    const parsedPrice = price.trim() === "" ? null : Number(price);
    const parsedStock = stock.trim() === "" ? null : parseInt(stock, 10);

    if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) {
      setErrorMsg("Price must be a positive number.");
      setIsSaving(false);
      return;
    }

    if (parsedStock !== null && (isNaN(parsedStock) || parsedStock < 0)) {
      setErrorMsg("Stock must be a positive whole number.");
      setIsSaving(false);
      return;
    }

    const success = await onSave({
      name: name.trim() || product.name,
      size: size.trim() || null,
      category: category.trim() || null,
      price: parsedPrice,
      stock: parsedStock,
    });

    setIsSaving(false);
    if (success) {
      setIsEditing(false);
    } else {
      setErrorMsg("Couldn't save that. Nothing was changed.");
    }
  };

  const handleDelete = async () => {
    setErrorMsg(null);
    setIsDeleting(true);
    const success = await onDelete();
    setIsDeleting(false);
    if (!success) {
      setErrorMsg("Couldn't remove product. Try again.");
    }
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onConfirm || isConfirming) return;
    setErrorMsg(null);
    setIsConfirming(true);
    const success = await onConfirm();
    setIsConfirming(false);
    if (!success) {
      setErrorMsg("Couldn't confirm product. Try again.");
    }
  };

  const chipProps = getStatusChipProps();

  return (
    <div
      className={`border-b border-line transition-colors duration-600 ${
        isHighlighted ? "bg-leaf-tint" : "bg-surface"
      }`}
    >
      {/* Display View */}
      {!isEditing ? (
        <div
          onClick={() => setIsEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-paper/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf"
          aria-label={`Edit ${product.name}`}
        >
          <div className="flex items-center gap-3 min-w-0 pr-4">
            {/* Product image thumbnail at side */}
            <img
              src={`/api/product-image?name=${encodeURIComponent(product.name)}`}
              alt={product.name}
              className="h-11 w-11 rounded-[6px] object-cover shrink-0 border border-line bg-surface"
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88' viewBox='0 0 88 88'%3E%3Crect width='88' height='88' rx='8' fill='%231E5B43' fill-opacity='0.10'/%3E%3Ctext x='44' y='48' font-size='28' text-anchor='middle'%3E📦%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-medium text-ink truncate text-[16px]">
                {product.name}
                {product.size && (
                  <span className="ml-2 font-normal text-ink-muted text-[14px]">
                    {product.size}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <StatusChip kind={chipProps.kind} label={chipProps.label} />
                {product.category && (
                  <span className="text-[12px] text-ink-muted">
                    {product.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end tabular text-right">
              <span className="font-semibold text-ink text-[16px]">
                {product.price !== null
                  ? formatCurrency(product.price)
                  : "Needs price"}
              </span>
              <span className="text-[13px] text-ink-muted">
                {product.stock !== null
                  ? `${product.stock} in stock`
                  : "Needs stock"}
              </span>
            </div>

            {onConfirm && product.status === "detected" && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="min-h-[44px] rounded-[8px] border border-line bg-surface px-3.5 text-[14px] font-medium text-ink hover:bg-leaf-tint hover:border-leaf hover:text-leaf disabled:opacity-50 inline-flex items-center"
                aria-label={`Confirm ${product.name}`}
              >
                {isConfirming ? "..." : "Confirm"}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Inline Editor */
        <form onSubmit={handleSave} className="p-4 bg-paper/60 space-y-3">
          {errorMsg && (
            <div className="flex items-center justify-between rounded-[8px] bg-brick-tint p-3 text-[13px] text-ink">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={handleSave}
                className="ml-2 min-h-[44px] font-medium underline text-brick inline-flex items-center px-1"
              >
                Retry
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[13px] font-medium text-ink mb-1">
                Product name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 w-full rounded-[8px] border border-line bg-surface px-3 text-[15px] text-ink focus:border-leaf focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">
                Pack size
              </label>
              <input
                type="text"
                value={size}
                placeholder="e.g. 70g"
                onChange={(e) => setSize(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-line bg-surface px-3 text-[15px] text-ink focus:border-leaf focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                placeholder="e.g. Groceries"
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-line bg-surface px-3 text-[15px] text-ink focus:border-leaf focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">
                Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={price}
                placeholder="Amount in ₹"
                onChange={(e) => setPrice(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-line bg-surface px-3 text-[15px] text-ink tabular focus:border-leaf focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">
                Stock
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={stock}
                placeholder="Packet count"
                onChange={(e) => setStock(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-line bg-surface px-3 text-[15px] text-ink tabular focus:border-leaf focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="min-h-[44px] text-[14px] font-medium text-brick hover:underline disabled:opacity-50 inline-flex items-center"
            >
              {isDeleting ? "Deleting..." : "Delete product"}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setErrorMsg(null);
                }}
                className="min-h-[44px] rounded-[8px] border border-line bg-surface px-4 text-[14px] font-medium text-ink hover:bg-paper inline-flex items-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[44px] rounded-[8px] bg-leaf px-4 text-[14px] font-medium text-white hover:bg-leaf/90 disabled:opacity-50 inline-flex items-center"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
