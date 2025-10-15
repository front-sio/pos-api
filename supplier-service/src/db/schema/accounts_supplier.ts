import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const accounts_supplier = pgTable('accounts_supplier', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 150 }),
  address: text('address'),
  description: text('description'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const insertSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
});

export const updateSupplierSchema = insertSupplierSchema.partial();

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;