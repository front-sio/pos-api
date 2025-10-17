ALTER TABLE "auth_user" ALTER COLUMN "last_login" SET DEFAULT null;--> statement-breakpoint
ALTER TABLE "auth_user" ALTER COLUMN "date_joined" DROP NOT NULL;