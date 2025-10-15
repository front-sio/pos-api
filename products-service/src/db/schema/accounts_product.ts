import { pgTable, integer, serial, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { z } from "zod";

// Table
export const accounts_product = pgTable("accounts_product", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  initial_quantity: decimal("initial_quantity", { precision: 12, scale: 2 }),
  quantity: decimal("quantity", { precision: 12, scale: 2 }),
  price_per_quantity: decimal("price_per_quantity", { precision: 12, scale: 2 }),
  price: decimal("price", { precision: 12, scale: 2 }),
  barcode: text("barcode"),
  unit_id: integer("unit_id"),
  category_id: integer("category_id"),
  location: text("location"),
  reorder_level: decimal("reorder_level", { precision: 12, scale: 2 }),
  // Existing text supplier (legacy/free text) retained for compatibility
  supplier: text("supplier"),
  // NEW: canonical supplier id linkage
  supplier_id: integer("supplier_id"),
  created_at: timestamp("created_at", { mode: "date" }).defaultNow(),
  updated_at: timestamp("updated_at", { mode: "date" }),
});

// Zod Schemas
export const insertProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  initial_quantity: z.union([z.string(), z.number()]).optional().nullable(),
  quantity: z.union([z.string(), z.number()]).optional().nullable(),
  price_per_quantity: z.union([z.string(), z.number()]).optional().nullable(),
  price: z.union([z.string(), z.number()]).optional().nullable(),
  barcode: z.string().optional().nullable(),
  unit_id: z.number().optional().nullable(),
  unit_name: z.string().optional().nullable(),
  category_id: z.number().optional().nullable(),
  category_name: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  reorder_level: z.union([z.string(), z.number()]).optional().nullable(),
  supplier: z.string().optional().nullable(),     // legacy text
  supplier_id: z.number().optional().nullable(),  // new canonical reference
});

export const updateProductSchema = insertProductSchema.partial();