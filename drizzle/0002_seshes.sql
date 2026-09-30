CREATE TABLE "sesh_drinks" (
	"sesh_id" uuid NOT NULL,
	"drink_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "sesh_drinks_sesh_id_drink_id_pk" PRIMARY KEY("sesh_id","drink_id")
);
--> statement-breakpoint
CREATE TABLE "seshes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sesh_drinks" ADD CONSTRAINT "sesh_drinks_sesh_id_seshes_id_fk" FOREIGN KEY ("sesh_id") REFERENCES "public"."seshes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesh_drinks" ADD CONSTRAINT "sesh_drinks_drink_id_drinks_id_fk" FOREIGN KEY ("drink_id") REFERENCES "public"."drinks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesh_drinks" ADD CONSTRAINT "sesh_drinks_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seshes" ADD CONSTRAINT "seshes_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seshes" ADD CONSTRAINT "seshes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sesh_drinks_group_drink_idx" ON "sesh_drinks" USING btree ("group_id","drink_id");--> statement-breakpoint
CREATE INDEX "seshes_group_started_at_idx" ON "seshes" USING btree ("group_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seshes_one_live_per_group_idx" ON "seshes" USING btree ("group_id") WHERE "seshes"."ended_at" is null;