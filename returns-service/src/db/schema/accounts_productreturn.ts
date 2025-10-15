import { pgTable, integer, text, serial, timestamp } from "drizzle-orm/pg-core";

export const accounts_productreturn = pgTable("accounts_productreturn", {
  id: serial("id").primaryKey(),
  saleitem_id: integer("saleitem_id").notNull(),
  quantity_returned: integer("quantity_returned").notNull(),
  reason: text("reason"),
  returned_at: timestamp("returned_at", { mode: "date" }).defaultNow(),
});