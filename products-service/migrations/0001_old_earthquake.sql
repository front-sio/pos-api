ALTER TABLE "accounts_product" ADD COLUMN "barcode" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "sku" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "unit" varchar(50);--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "category" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "location" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "reorder_level" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "supplier" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "notes" text;