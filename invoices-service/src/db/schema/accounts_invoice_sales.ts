import { pgTable, integer, serial } from "drizzle-orm/pg-core";

export const accounts_invoice_sales = pgTable("accounts_invoice_sales", {
  id: serial("id").primaryKey(),
  invoice_id: integer("invoice_id").notNull(),
  sale_id: integer("sale_id").notNull(),
});