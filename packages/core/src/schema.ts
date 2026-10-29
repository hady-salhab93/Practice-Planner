import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
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

export const tagGroups = pgTable(
  "tag_groups",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
  },
  (table) => [
    check(
      "tag_groups_name_not_blank",
      sql`length(btrim(${table.name}, ${titleEdgeWhitespace})) > 0`,
    ),
    uniqueIndex("tag_groups_name_unique").on(
      normalizedTitleExpression(table.name),
    ),
  ],
);

export type TagGroup = typeof tagGroups.$inferSelect;
export const tags = pgTable(
  "tags",
  {
    id: uuid().defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => tagGroups.id, { onDelete: "cascade" }),
    name: text().notNull(),
  },
  (table) => [
    check(
      "tags_name_not_blank",
      sql`length(btrim(${table.name}, ${titleEdgeWhitespace})) > 0`,
    ),
    uniqueIndex("tags_group_name_unique").on(
      table.groupId,
      normalizedTitleExpression(table.name),
    ),
    index("tags_group_id_idx").on(table.groupId),
  ],
);

export type Tag = typeof tags.$inferSelect;
export const materialTags = pgTable(
  "material_tags",
  {
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      name: "material_tags_pk",
      columns: [table.materialId, table.tagId],
    }),
    index("material_tags_tag_id_idx").on(table.tagId),
  ],
);

export type MaterialTag = typeof materialTags.$inferSelect;

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

export const sprintMaterials = pgTable(
  "sprint_materials",
  {
    sprintId: uuid("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "restrict" }),
    selectedAt: timestamp("selected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "sprint_materials_pk",
      columns: [table.sprintId, table.materialId],
    }),
    index("sprint_materials_material_id_idx").on(table.materialId),
  ],
);

export type SprintMaterial = typeof sprintMaterials.$inferSelect;
