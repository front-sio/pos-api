import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const accounts_unit = pgTable("accounts_unit", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  created_at: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const insertUnitSchema = z.object({
  name: z.string().min(1, "Unit name is required"),
  description: z.string().optional(),
});

export const updateUnitSchema = insertUnitSchema.partial();

export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type UpdateUnit = z.infer<typeof updateUnitSchema>;