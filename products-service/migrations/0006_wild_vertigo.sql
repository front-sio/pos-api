CREATE TABLE "accounts_purchase_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_unit" numeric(12, 2) NOT NULL,
	"total_cost" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts_purchase" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts_purchase" ALTER COLUMN "quantity_added" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts_purchase" ALTER COLUMN "price_per_quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts_purchase" ADD COLUMN "supplier_id" integer;--> statement-breakpoint
ALTER TABLE "accounts_purchase" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "accounts_purchase" ADD COLUMN "subtotal" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "accounts_purchase" ADD COLUMN "total" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "accounts_purchase" ADD COLUMN "paid_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "accounts_purchase" ADD COLUMN "notes" text;