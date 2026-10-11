ALTER TABLE "materials" DROP CONSTRAINT "materials_title_not_blank";--> statement-breakpoint
DROP INDEX "materials_sibling_title_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "materials_sibling_title_unique" ON "materials" USING btree (coalesce("parent_id"::text, ''),lower(btrim("title", chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))));--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_title_not_blank" CHECK (length(btrim("materials"."title", chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))) > 0);