import { pgTable, integer, decimal, serial, text, timestamp } from "drizzle-orm/pg-core";


export const accounts_purchase = pgTable("accounts_purchase", {
  id: serial("id").primaryKey(),


  supplier_id: integer("supplier_id"),

  // Status of the purchase order: 'paid' | 'unpaid' | 'credited'
  status: text("status"),

  // Monetary fields
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }),
  total: decimal("total", { precision: 14, scale: 2 }),
  paid_amount: decimal("paid_amount", { precision: 14, scale: 2 }),

  // Optional notes
  notes: text("notes"),

  
  product_id: integer("product_id"),
  quantity_added: integer("quantity_added"),
  price_per_quantity: decimal("price_per_quantity", { precision: 10, scale: 2 }),

  // Timestamp
  date: timestamp("date", { mode: "date" }).defaultNow(),
});