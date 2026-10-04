import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import {
  addProductArgsSchema,
  updateProductArgsSchema,
  confirmProductArgsSchema,
  removeProductArgsSchema,
  publishStoreArgsSchema,
  type Product,
} from "@/lib/validation";
import { matchProduct, normalizeProductName } from "@/lib/matching";

export type ToolSource = "camera" | "voice" | "manual";

export interface ToolExecutionResult {
  ok: boolean;
  product?: Product;
  removed_id?: string;
  product_name?: string;
  error?: string;
  message?: string;
  candidates?: unknown[];
  note?: string;
  published?: boolean;
  publicUrl?: string;
  action?: string;
  redirectUrl?: string;
}

export async function executeTool(
  storeId: string,
  toolName: string,
  args: Record<string, unknown>,
  source: ToolSource = "camera",
): Promise<ToolExecutionResult> {
  const supabase = getSupabaseServer();

  try {
    switch (toolName) {
      case "add_product": {
        const parsed = addProductArgsSchema.safeParse(args);
        if (!parsed.success) {
          const firstErr = parsed.error.issues[0]?.message || "Invalid arguments";
          return { ok: false, error: "invalid_arguments", message: firstErr };
        }

        // 1. Fetch existing products for duplicate check
        const { data: existingRows, error: fetchErr } = await supabase
          .from("products")
          .select("*")
          .eq("store_id", storeId);

        if (fetchErr) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't load products. Nothing was changed.",
          };
        }

        const existingProducts = (existingRows || []) as Product[];
        const match = matchProduct(parsed.data.name, existingProducts, {
          size: parsed.data.size,
          variant: parsed.data.variant,
        });

        // If a close match already exists, return it without creating a duplicate
        if (match.ok) {
          return {
            ok: true,
            product: match.product,
            note: "already_exists",
            message: `${match.product.name} is already in the list.`,
          };
        }

        // 2. Insert new product
        const norm = normalizeProductName(parsed.data.name);
        const { data: newProd, error: insertErr } = await supabase
          .from("products")
          .insert({
            store_id: storeId,
            name: parsed.data.name,
            name_normalized: norm,
            brand: parsed.data.brand || null,
            variant: parsed.data.variant || null,
            size: parsed.data.size || null,
            category: parsed.data.category || null,
            price: parsed.data.price ?? null,
            stock: parsed.data.stock ?? null,
            confidence: parsed.data.confidence ?? null,
            source,
            status: "detected",
          })
          .select()
          .single();

        if (insertErr || !newProd) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't save that product. Try again.",
          };
        }

        // 3. Write inventory event
        await supabase.from("inventory_events").insert({
          store_id: storeId,
          product_id: newProd.id,
          product_name: newProd.name,
          event_type: "product_added",
          new_value: newProd.name,
          source,
        });

        const missing: string[] = [];
        if (newProd.price === null) missing.push("price");
        if (newProd.stock === null) missing.push("stock");

        const instruction =
          missing.length === 2
            ? `Product "${newProd.name}" added. Ask the owner: "What is the price and how many packets do you have?"`
            : missing.includes("price")
            ? `Product "${newProd.name}" added with stock ${newProd.stock}. Ask the owner: "What is the price?"`
            : missing.includes("stock")
            ? `Product "${newProd.name}" added with price ₹${newProd.price}. Ask the owner: "How many packets do you have?"`
            : `Product "${newProd.name}" added with price ₹${newProd.price} and stock ${newProd.stock}.`;

        return {
          ok: true,
          product: newProd as Product,
          note: missing.length > 0 ? "needs_info" : "complete",
          message: instruction,
        };
      }

      case "update_product": {
        const parsed = updateProductArgsSchema.safeParse(args);
        if (!parsed.success) {
          const firstErr = parsed.error.issues[0]?.message || "Invalid arguments";
          return { ok: false, error: "invalid_arguments", message: firstErr };
        }

        const { data: existingRows, error: fetchErr } = await supabase
          .from("products")
          .select("*")
          .eq("store_id", storeId);

        if (fetchErr) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't load products. Nothing was changed.",
          };
        }

        const existingProducts = (existingRows || []) as Product[];
        const match = matchProduct(
          parsed.data.product_ref,
          existingProducts,
          {
            size: parsed.data.size,
            variant: parsed.data.variant,
          },
        );

        if (!match.ok) {
          if (match.error === "ambiguous") {
            return {
              ok: false,
              error: "ambiguous",
              message: "Multiple products match that name. Which one did you mean?",
              candidates: match.candidates,
            };
          }
          return {
            ok: false,
            error: "not_found",
            message: `Could not find "${parsed.data.product_ref}".`,
          };
        }

        const prod = match.product;
        const updates: Record<string, unknown> = {};
        const eventsToInsert: Array<Record<string, unknown>> = [];

        // Check price update
        if (parsed.data.price !== undefined && parsed.data.price !== prod.price) {
          updates.price = parsed.data.price;
          eventsToInsert.push({
            store_id: storeId,
            product_id: prod.id,
            product_name: prod.name,
            event_type: "price_updated",
            old_value: prod.price !== null ? String(prod.price) : null,
            new_value:
              parsed.data.price !== null ? String(parsed.data.price) : null,
            source,
          });
        }

        // Check stock update
        if (parsed.data.stock !== undefined && parsed.data.stock !== prod.stock) {
          updates.stock = parsed.data.stock;
          eventsToInsert.push({
            store_id: storeId,
            product_id: prod.id,
            product_name: prod.name,
            event_type: "stock_updated",
            old_value: prod.stock !== null ? String(prod.stock) : null,
            new_value:
              parsed.data.stock !== null ? String(parsed.data.stock) : null,
            source,
          });
        }

        // Check details updates (name, brand, variant, size, category)
        let detailsChanged = false;
        let oldDetails = "";
        let newDetails = "";

        if (parsed.data.name && parsed.data.name !== prod.name) {
          updates.name = parsed.data.name;
          updates.name_normalized = normalizeProductName(parsed.data.name);
          detailsChanged = true;
          oldDetails += `name: ${prod.name}; `;
          newDetails += `name: ${parsed.data.name}; `;
        }

        if (parsed.data.brand !== undefined && parsed.data.brand !== prod.brand) {
          updates.brand = parsed.data.brand;
          detailsChanged = true;
          oldDetails += `brand: ${prod.brand ?? ""}; `;
          newDetails += `brand: ${parsed.data.brand ?? ""}; `;
        }

        if (
          parsed.data.variant !== undefined &&
          parsed.data.variant !== prod.variant
        ) {
          updates.variant = parsed.data.variant;
          detailsChanged = true;
          oldDetails += `variant: ${prod.variant ?? ""}; `;
          newDetails += `variant: ${parsed.data.variant ?? ""}; `;
        }

        if (parsed.data.size !== undefined && parsed.data.size !== prod.size) {
          updates.size = parsed.data.size;
          detailsChanged = true;
          oldDetails += `size: ${prod.size ?? ""}; `;
          newDetails += `size: ${parsed.data.size ?? ""}; `;
        }

        if (
          parsed.data.category !== undefined &&
          parsed.data.category !== prod.category
        ) {
          updates.category = parsed.data.category;
          detailsChanged = true;
          oldDetails += `category: ${prod.category ?? ""}; `;
          newDetails += `category: ${parsed.data.category ?? ""}; `;
        }

        if (detailsChanged) {
          eventsToInsert.push({
            store_id: storeId,
            product_id: prod.id,
            product_name: (updates.name as string) || prod.name,
            event_type: "details_updated",
            old_value: oldDetails.trim(),
            new_value: newDetails.trim(),
            source,
          });
        }

        // If nothing changed, return existing product
        if (Object.keys(updates).length === 0) {
          return { ok: true, product: prod, note: "no_changes" };
        }

        updates.updated_at = new Date().toISOString();

        const { data: updatedProd, error: updateErr } = await supabase
          .from("products")
          .update(updates)
          .eq("id", prod.id)
          .select()
          .single();

        if (updateErr || !updatedProd) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't save that update. Nothing was changed.",
          };
        }

        if (eventsToInsert.length > 0) {
          await supabase.from("inventory_events").insert(eventsToInsert);
        }

        return { ok: true, product: updatedProd as Product };
      }

      case "confirm_product": {
        const parsed = confirmProductArgsSchema.safeParse(args);
        if (!parsed.success) {
          return {
            ok: false,
            error: "invalid_arguments",
            message: "Product reference is required.",
          };
        }

        const { data: existingRows, error: fetchErr } = await supabase
          .from("products")
          .select("*")
          .eq("store_id", storeId);

        if (fetchErr) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't load products. Nothing was changed.",
          };
        }

        const existingProducts = (existingRows || []) as Product[];
        const match = matchProduct(parsed.data.product_ref, existingProducts);

        if (!match.ok) {
          if (match.error === "ambiguous") {
            return {
              ok: false,
              error: "ambiguous",
              message: "Multiple products match. Which one did you mean?",
              candidates: match.candidates,
            };
          }
          return {
            ok: false,
            error: "not_found",
            message: `Could not find "${parsed.data.product_ref}".`,
          };
        }

        const prod = match.product;
        if (!prod.name || prod.name.trim() === "") {
          return {
            ok: false,
            error: "invalid",
            message: "Product must have a name before confirming.",
          };
        }

        if (prod.status === "confirmed") {
          return { ok: true, product: prod, note: "already_confirmed" };
        }

        const { data: confirmedProd, error: updateErr } = await supabase
          .from("products")
          .update({
            status: "confirmed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", prod.id)
          .select()
          .single();

        if (updateErr || !confirmedProd) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't confirm product. Try again.",
          };
        }

        await supabase.from("inventory_events").insert({
          store_id: storeId,
          product_id: prod.id,
          product_name: prod.name,
          event_type: "product_confirmed",
          old_value: prod.status,
          new_value: "confirmed",
          source,
        });

        return { ok: true, product: confirmedProd as Product };
      }

      case "remove_product": {
        const parsed = removeProductArgsSchema.safeParse(args);
        if (!parsed.success) {
          return {
            ok: false,
            error: "invalid_arguments",
            message: "Product reference is required.",
          };
        }

        const { data: existingRows, error: fetchErr } = await supabase
          .from("products")
          .select("*")
          .eq("store_id", storeId);

        if (fetchErr) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't load products. Nothing was changed.",
          };
        }

        const existingProducts = (existingRows || []) as Product[];
        const match = matchProduct(parsed.data.product_ref, existingProducts);

        if (!match.ok) {
          if (match.error === "ambiguous") {
            return {
              ok: false,
              error: "ambiguous",
              message: "Multiple products match. Which one did you mean to remove?",
              candidates: match.candidates,
            };
          }
          return {
            ok: false,
            error: "not_found",
            message: `Could not find "${parsed.data.product_ref}".`,
          };
        }

        const prod = match.product;

        const { error: delErr } = await supabase
          .from("products")
          .delete()
          .eq("id", prod.id);

        if (delErr) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't remove product. Try again.",
          };
        }

        await supabase.from("inventory_events").insert({
          store_id: storeId,
          product_id: prod.id,
          product_name: prod.name,
          event_type: "product_removed",
          old_value: prod.name,
          source,
        });

        return {
          ok: true,
          removed_id: prod.id,
          product_name: prod.name,
        };
      }

      case "publish_store": {
        const parsed = publishStoreArgsSchema.safeParse(args);
        const argsData = parsed.success ? parsed.data : undefined;
        const action = argsData?.action;
        const isDirect = Boolean(argsData?.confirm_direct_publish);

        if (action === "review") {
          return {
            ok: true,
            action: "review",
            redirectUrl: `/review/${storeId}`,
            message: "Opening catalogue review.",
          };
        }

        if (!isDirect) {
          return {
            ok: false,
            error: "review_required",
            message:
              "Ask the owner: 'Do you want to review the catalogue first, or should I publish directly?'",
          };
        }

        // Direct publish requested by owner after confirmation
        const { data: rows, error: fetchErr } = await supabase
          .from("products")
          .select("*")
          .eq("store_id", storeId);

        if (fetchErr) {
          return {
            ok: false,
            error: "db_error",
            message: "Couldn't load products. Nothing was published.",
          };
        }

        const products = (rows || []) as Product[];
        if (products.length === 0) {
          return {
            ok: false,
            error: "no_products",
            message: "Scan and add at least one product before publishing.",
          };
        }

        const notReady = products.filter(
          (p) =>
            !p.name ||
            p.name.trim() === "" ||
            p.price === null ||
            p.stock === null,
        );

        if (notReady.length > 0) {
          return {
            ok: false,
            error: "not_ready",
            message: `${notReady.length} products still need a price or stock count before publishing.`,
          };
        }

        const now = new Date().toISOString();
        await supabase
          .from("products")
          .update({ status: "published", updated_at: now })
          .eq("store_id", storeId);

        await supabase
          .from("stores")
          .update({ published_at: now, updated_at: now })
          .eq("id", storeId);

        await supabase.from("inventory_events").insert({
          store_id: storeId,
          product_name: "Store published",
          event_type: "store_published",
          new_value: now,
          source,
        });

        return {
          ok: true,
          published: true,
          publicUrl: `/store/${storeId}`,
          message: "Store published successfully!",
        };
      }

      default:
        return {
          ok: false,
          error: "unknown_tool",
          message: `Unknown tool "${toolName}".`,
        };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return {
      ok: false,
      error: "server_error",
      message: `Action failed: ${msg}`,
    };
  }
}
