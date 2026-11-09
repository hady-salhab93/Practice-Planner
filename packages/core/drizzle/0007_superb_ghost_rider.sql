CREATE TABLE "tag_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tag_groups_name_not_blank" CHECK (length(btrim("tag_groups"."name", chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tag_groups_name_unique" ON "tag_groups" USING btree (lower(btrim("name", chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))));