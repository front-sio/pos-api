import { pgTable, varchar, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";


export const accounts_customer = pgTable("accounts_customer", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  
});