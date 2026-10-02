CREATE TABLE "group_drinks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"label" text NOT NULL,
	"emoji" text NOT NULL,
	"units" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_drinks_units_range" CHECK ("group_drinks"."units" > 0 and "group_drinks"."units" <= 20)
);
--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "emoji" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "logged_by" uuid;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "hidden_drinks" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "group_drinks" ADD CONSTRAINT "group_drinks_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_drinks_group_idx" ON "group_drinks" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "drinks" ADD CONSTRAINT "drinks_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;