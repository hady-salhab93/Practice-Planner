import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { SQLWrapper } from "drizzle-orm";

const titleEdgeWhitespace = sql`chr(32) || chr(9) || chr(10) || chr(13) || chr(12) || chr(11)`;

export function normalizedTitleExpression(title: SQLWrapper) {
  return sql`lower(btrim(${title}, ${titleEdgeWhitespace}))`;
}

export const materials = pgTable(
  "materials",
  {
    id: uuid().defaultRandom().primaryKey(),
    title: text().notNull(),
    description: text(),
    parentId: uuid("parent_id").references((): AnyPgColumn => materials.id, {
      onDelete: "cascade",
    }),
    position: integer().notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "materials_archive_root_only",
      sql`${table.archivedAt} is null or ${table.parentId} is null`,
    ),
    check(
      "materials_title_not_blank",
      sql`length(btrim(${table.title}, ${titleEdgeWhitespace})) > 0`,
    ),
    uniqueIndex("materials_sibling_title_unique").on(
      sql`coalesce(${table.parentId}::text, '')`,
      normalizedTitleExpression(table.title),
    ),
  ],
);

export type Material = typeof materials.$inferSelect;

export const materialReferences = pgTable("material_references", {
  id: uuid().defaultRandom().primaryKey(),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materials.id, { onDelete: "cascade" }),
  label: text(),
  url: text().notNull(),
  position: integer().notNull().default(0),
});

export type MaterialReference = typeof materialReferences.$inferSelect;

export const applicationSettings = pgTable(
  "application_settings",
  {
    id: integer().primaryKey().default(1),
    timeZone: text("time_zone").notNull(),
  },
  (table) => [
    check("application_settings_singleton", sql`${table.id} = 1`),
    check(
      "application_settings_timezone_not_blank",
      sql`length(btrim(${table.timeZone})) > 0`,
    ),
  ],
);

export const sprints = pgTable(
  "sprints",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    goal: text(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer().notNull().default(1),
  },
  (table) => [
    check(
      "sprints_name_not_blank",
      sql`length(btrim(${table.name}, ${titleEdgeWhitespace})) > 0`,
    ),
    check("sprints_date_order", sql`${table.endDate} >= ${table.startDate}`),
    index("sprints_start_date_idx").on(table.startDate),
  ],
);

export type Sprint = typeof sprints.$inferSelect;
