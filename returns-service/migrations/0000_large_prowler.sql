CREATE TABLE "accounts_productreturn" (
	"id" serial PRIMARY KEY NOT NULL,
	"saleitem_id" integer NOT NULL,
	"quantity_returned" integer NOT NULL,
	"reason" text,
	"returned_at" timestamp DEFAULT now()
);
