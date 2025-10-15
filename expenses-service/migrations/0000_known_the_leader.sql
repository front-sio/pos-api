CREATE TABLE "accounts_expense" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"date_incurred" date DEFAULT now()
);
