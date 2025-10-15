import { sql } from "drizzle-orm";
import { pgTable, varchar, text, decimal, date, integer, serial } from "drizzle-orm/pg-core";

export const accounts_expense = pgTable("accounts_expense", {
  id: serial("id").primaryKey(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date_incurred: date("date_incurred").defaultNow(),
});