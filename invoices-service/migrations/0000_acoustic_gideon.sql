CREATE TABLE "accounts_invoice" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"status" varchar(10) DEFAULT 'unpaid' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts_invoice_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"sale_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts_payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" timestamp DEFAULT now()
);
