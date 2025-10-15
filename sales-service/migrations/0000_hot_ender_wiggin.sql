CREATE TABLE "accounts_profittracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"gross_profit" numeric(12, 2) DEFAULT '0',
	"net_profit" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "accounts_sale" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"sold_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_saleitem" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_sold" numeric(10, 2) NOT NULL,
	"sale_price_per_quantity" numeric(10, 2) NOT NULL,
	"total_sale_price" numeric(10, 2) NOT NULL,
	CONSTRAINT "unique_sale_product" UNIQUE("sale_id","product_id")
);
