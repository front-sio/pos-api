ALTER TABLE "auth_user" ALTER COLUMN "last_login" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_user" ALTER COLUMN "last_login" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auth_user" ALTER COLUMN "date_joined" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_user" ALTER COLUMN "date_joined" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "auth_user" ALTER COLUMN "date_joined" SET NOT NULL;