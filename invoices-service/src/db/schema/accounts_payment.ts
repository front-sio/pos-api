import { pgTable, integer, decimal, serial, timestamp } from "drizzle-orm/pg-core";

export const accounts_payment = pgTable("accounts_payment", {
  id: serial("id").primaryKey(),
  invoice_id: integer("invoice_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paid_at: timestamp("paid_at", { mode: "date" }).defaultNow(),
});