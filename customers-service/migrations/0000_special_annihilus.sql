CREATE TABLE "accounts_customer" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	CONSTRAINT "accounts_customer_name_unique" UNIQUE("name")
);
