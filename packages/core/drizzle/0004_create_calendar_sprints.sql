CREATE TABLE "application_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"time_zone" text NOT NULL,
	CONSTRAINT "application_settings_singleton" CHECK ("application_settings"."id" = 1),
	CONSTRAINT "application_settings_timezone_not_blank" CHECK (length(btrim("application_settings"."time_zone")) > 0)
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprints_name_not_blank" CHECK (length(btrim("sprints"."name", chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))) > 0),
	CONSTRAINT "sprints_date_order" CHECK ("sprints"."end_date" >= "sprints"."start_date")
);
--> statement-breakpoint
CREATE INDEX "sprints_start_date_idx" ON "sprints" USING btree ("start_date");
--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_no_overlapping_dates" EXCLUDE USING gist (daterange("start_date", "end_date", '[]') WITH &&);