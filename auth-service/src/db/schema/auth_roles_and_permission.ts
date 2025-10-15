import { pgTable, serial, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";

// Roles table
export const role = pgTable("role", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
});

// Permissions table
export const permission = pgTable("permission", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
});

// Role-Permission many-to-many
export const role_permission = pgTable("role_permission", {
  id: serial("id").primaryKey(),
  role_id: integer("role_id").notNull().references(() => role.id),
  permission_id: integer("permission_id").notNull().references(() => permission.id),
});

// User-Role many-to-many
export const user_role = pgTable("user_role", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  role_id: integer("role_id").notNull().references(() => role.id),
});
