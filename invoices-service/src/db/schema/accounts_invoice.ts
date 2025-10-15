import { pgTable, serial, integer, decimal, varchar, timestamp } from "drizzle-orm/pg-core";

export const accounts_invoice = pgTable("accounts_invoice", {
  id: serial("id").primaryKey(),
  customer_id: integer("customer_id").notNull(),
  created_at: timestamp("created_at", { mode: "date" }).defaultNow(),
  status: varchar("status", { length: 10 }).notNull().default("unpaid"),
  total_amount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
});