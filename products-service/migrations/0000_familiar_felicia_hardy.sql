CREATE TABLE "accounts_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"initial_quantity" numeric(10, 2) DEFAULT '0',
	"quantity" numeric(10, 2) DEFAULT '0',
	"price_per_quantity" numeric(10, 2) DEFAULT '0',
	"price" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_purchase" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_added" integer NOT NULL,
	"price_per_quantity" numeric(10, 2) NOT NULL,
	"date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_stocktransaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"user_id" integer,
	"amount_added" integer NOT NULL,
	"price_per_unit" numeric(10, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
