CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_title_not_blank" CHECK (length(btrim("materials"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_parent_id_materials_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "materials_sibling_title_unique" ON "materials" USING btree (coalesce("parent_id"::text, ''),lower(btrim("title")));