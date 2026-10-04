import { z } from "zod";

export const languageSchema = z.enum(["en", "hi"]);

export const storeCreateSchema = z.object({
  store_name: z.string().trim().min(1, "Enter a store name"),
  vendor_name: z.string().trim().min(1, "Enter your name"),
  phone: z
    .string()
    .trim()
    .min(8, "Enter a phone number")
    .max(20, "Enter a shorter phone number"),
  city: z
    .string()
    .trim()
    .max(80, "Enter a shorter city name")
    .optional()
    .or(z.literal("")),
  language: languageSchema,
});

export type StoreCreateInput = z.infer<typeof storeCreateSchema>;

export const storeSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid().nullable().optional(),
  store_name: z.string(),
  vendor_name: z.string(),
  phone: z.string(),
  city: z.string().nullable(),
  language: languageSchema,
  owner_token: z.string(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const productStatusSchema = z.enum([
  "detected",
  "confirmed",
  "published",
]);

export const productSourceSchema = z.enum(["camera", "voice", "manual"]);

export const productSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid(),
  name: z.string().min(1),
  name_normalized: z.string().min(1),
  brand: z.string().nullable(),
  variant: z.string().nullable(),
  size: z.string().nullable(),
  category: z.string().nullable(),
  price: z.number().nullable(),
  stock: z.number().int().nullable(),
  confidence: z.number().nullable(),
  source: productSourceSchema,
  status: productStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const addProductArgsSchema = z.object({
  name: z.string().trim().min(1, "Product name cannot be empty"),
  brand: z.string().trim().optional().nullable(),
  variant: z.string().trim().optional().nullable(),
  size: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  price: z
    .number({ invalid_type_error: "Price must be a valid number" })
    .min(0, "Price must be non-negative")
    .optional()
    .nullable(),
  stock: z
    .number({ invalid_type_error: "Stock must be a valid whole number" })
    .int("Stock must be a whole number")
    .min(0, "Stock must be non-negative")
    .optional()
    .nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

export const updateProductArgsSchema = z.object({
  product_ref: z.string().trim().min(1, "Product reference is required"),
  price: z
    .number({ invalid_type_error: "Price must be a valid number" })
    .min(0, "Price must be non-negative")
    .optional()
    .nullable(),
  stock: z
    .number({ invalid_type_error: "Stock must be a valid whole number" })
    .int("Stock must be a whole number")
    .min(0, "Stock must be non-negative")
    .optional()
    .nullable(),
  name: z.string().trim().min(1).optional(),
  brand: z.string().trim().optional().nullable(),
  variant: z.string().trim().optional().nullable(),
  size: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
});

export const confirmProductArgsSchema = z.object({
  product_ref: z.string().trim().min(1, "Product reference is required"),
});

export const removeProductArgsSchema = z.object({
  product_ref: z.string().trim().min(1, "Product reference is required"),
});

export const publishStoreArgsSchema = z
  .object({
    confirm_direct_publish: z.boolean().optional(),
    action: z.enum(["publish", "review"]).optional(),
  })
  .optional();

export const toolTypeSchema = z.enum([
  "add_product",
  "update_product",
  "confirm_product",
  "remove_product",
  "publish_store",
]);

export const toolRequestSchema = z.object({
  storeId: z.string().uuid(),
  tool: toolTypeSchema,
  args: z.record(z.unknown()).default({}),
  source: productSourceSchema.default("camera"),
});

export const inventoryEventTypeSchema = z.enum([
  "product_added",
  "product_confirmed",
  "price_updated",
  "stock_updated",
  "details_updated",
  "product_removed",
  "store_published",
]);

export const inventoryEventSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  product_name: z.string(),
  event_type: inventoryEventTypeSchema,
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  source: productSourceSchema,
  created_at: z.string(),
});

export type Store = z.infer<typeof storeSchema>;
export type Product = z.infer<typeof productSchema>;
export type InventoryEvent = z.infer<typeof inventoryEventSchema>;
export type ToolRequest = z.infer<typeof toolRequestSchema>;
