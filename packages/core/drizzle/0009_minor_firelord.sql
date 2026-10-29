CREATE TABLE "material_tags" (
	"material_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "material_tags_pk" PRIMARY KEY("material_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "material_tags" ADD CONSTRAINT "material_tags_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_tags" ADD CONSTRAINT "material_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_tags_tag_id_idx" ON "material_tags" USING btree ("tag_id");