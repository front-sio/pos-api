import { pgTable, serial, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { accounts_sale } from "./accounts_sale";

export const accounts_profittracker = pgTable("accounts_profittracker", {
  id: serial("id").primaryKey(),
  sale_id: integer("sale_id").notNull().references(() => accounts_sale.id),
  gross_profit: decimal("gross_profit", { precision: 12, scale: 2 }).default("0"),
  net_profit: decimal("net_profit", { precision: 12, scale: 2 }).default("0"),
  created_at: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});