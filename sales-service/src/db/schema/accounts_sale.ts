// sales-gateway/sales-service/src/db/schema/accounts_sale.ts
import { sql } from "drizzle-orm";
import { pgTable, integer, serial, timestamp } from "drizzle-orm/pg-core";

export const accounts_sale = pgTable("accounts_sale", {
  id: serial("id").primaryKey(),
  customer_id: integer("customer_id"),
  sold_at: timestamp("sold_at", { mode: "date" }).defaultNow(),
});