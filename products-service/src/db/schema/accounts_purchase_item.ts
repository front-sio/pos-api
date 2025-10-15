import { pgTable, integer, decimal, serial } from "drizzle-orm/pg-core";

export const accounts_purchase_item = pgTable("accounts_purchase_item", {
  id: serial("id").primaryKey(),
  purchase_id: integer("purchase_id").notNull(),
  product_id: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price_per_unit: decimal("price_per_unit", { precision: 12, scale: 2 }).notNull(),
  total_cost: decimal("total_cost", { precision: 14, scale: 2 }).notNull(),
});