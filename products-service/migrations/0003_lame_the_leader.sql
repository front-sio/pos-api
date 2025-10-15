CREATE TABLE "accounts_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "accounts_unit" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_unit_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "unit_id" integer;--> statement-breakpoint
ALTER TABLE "accounts_product" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "accounts_product" ADD CONSTRAINT "accounts_product_unit_id_accounts_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."accounts_unit"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounts_product" ADD CONSTRAINT "accounts_product_category_id_accounts_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."accounts_category"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounts_product" DROP COLUMN "sku";--> statement-breakpoint
ALTER TABLE "accounts_product" DROP COLUMN "unit";--> statement-breakpoint
ALTER TABLE "accounts_product" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "accounts_product" DROP COLUMN "notes";