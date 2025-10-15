ALTER TABLE "accounts_product" DROP CONSTRAINT "accounts_product_unit_id_accounts_unit_id_fk";
--> statement-breakpoint
ALTER TABLE "accounts_product" DROP CONSTRAINT "accounts_product_category_id_accounts_category_id_fk";
--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "initial_quantity" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "initial_quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "price_per_quantity" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "price_per_quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "price" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "barcode" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "location" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "reorder_level" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "reorder_level" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "supplier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "accounts_product" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "supplier_id" integer;