// sales-gateway/src/db/schema/accounts_saleitem.ts
import { sql } from "drizzle-orm";
import { pgTable, integer, serial, decimal, unique } from "drizzle-orm/pg-core";


export const accounts_saleitem = pgTable("accounts_saleitem", {
  id: serial("id").primaryKey(),
  sale_id: integer("sale_id").notNull(),
  product_id: integer("product_id").notNull(),
  quantity_sold: decimal("quantity_sold", { precision: 10, scale: 2 }).notNull(),
  sale_price_per_quantity: decimal("sale_price_per_quantity", { precision: 10, scale: 2 }).notNull(),
  total_sale_price: decimal("total_sale_price", { precision: 10, scale: 2 }).notNull(),
},
(table) => ({
  unique_sale_product: unique("unique_sale_product").on(table.sale_id, table.product_id),
}));