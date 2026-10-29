CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_not_blank" CHECK (length(btrim("tags"."name", chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))) > 0)
);
--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_group_id_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tag_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_group_name_unique" ON "tags" USING btree ("group_id",lower(btrim("name", chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))));--> statement-breakpoint
CREATE INDEX "tags_group_id_idx" ON "tags" USING btree ("group_id");