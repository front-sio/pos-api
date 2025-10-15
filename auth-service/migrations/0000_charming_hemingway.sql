CREATE TABLE "auth_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"password" varchar(128) NOT NULL,
	"last_login" timestamp,
	"is_superuser" boolean DEFAULT false NOT NULL,
	"username" varchar(150) NOT NULL,
	"first_name" varchar(150) NOT NULL,
	"last_name" varchar(150) NOT NULL,
	"email" varchar(254) NOT NULL,
	"is_staff" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"date_joined" timestamp NOT NULL,
	CONSTRAINT "auth_user_username_unique" UNIQUE("username")
);
