CREATE TABLE "sprint_materials" (
	"sprint_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_materials_pk" PRIMARY KEY("sprint_id","material_id")
);
--> statement-breakpoint
ALTER TABLE "sprint_materials" ADD CONSTRAINT "sprint_materials_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_materials" ADD CONSTRAINT "sprint_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_materials_material_id_idx" ON "sprint_materials" USING btree ("material_id");