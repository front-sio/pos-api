import { pgTable, serial, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const auth_user = pgTable("auth_user", {
  id: serial("id").primaryKey(),
  password: varchar("password", { length: 128 }).notNull(),

  // Nullable last_login
  last_login: timestamp("last_login", { withTimezone: true }).$type<Date | null>(),

  is_superuser: boolean("is_superuser").notNull().default(false),
  username: varchar("username", { length: 150 }).notNull().unique(),
  first_name: varchar("first_name", { length: 150 }).notNull(),
  last_name: varchar("last_name", { length: 150 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  is_staff: boolean("is_staff").notNull().default(false),
  is_active: boolean("is_active").notNull().default(true),

  // date_joined: defaultNow is enough, remove mode
  date_joined: timestamp("date_joined", { withTimezone: true }).defaultNow().notNull(),
});
