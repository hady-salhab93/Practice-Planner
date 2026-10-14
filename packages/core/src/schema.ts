import { sql } from "drizzle-orm";
import {
  check,
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
