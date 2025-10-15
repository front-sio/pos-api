import { pgTable, integer, decimal, serial, timestamp } from "drizzle-orm/pg-core";

export const accounts_stocktransaction = pgTable("accounts_stocktransaction", {
  id: serial("id").primaryKey(),
  product_id: integer("product_id").notNull(),
  user_id: integer("user_id"),
  amount_added: integer("amount_added").notNull(),
  price_per_unit: decimal("price_per_unit", { precision: 10, scale: 2 }).notNull(),
  total_cost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  supplier_id: integer("supplier_id"),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
});