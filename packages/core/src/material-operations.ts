import { and, asc, eq, isNull, max, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import {
  materials,
  normalizedTitleExpression,
  type Material,
} from "./schema.js";

type Database = NodePgDatabase<typeof schema>;

export class InvalidMaterialTitleError extends Error {
  constructor() {
    super("Enter a title for this Material.");
    this.name = "InvalidMaterialTitleError";
  }
}

export class MaterialTitleConflictError extends Error {
  constructor(readonly conflictingMaterial: Material) {
    super(
      `A Material titled “${conflictingMaterial.title}” already exists in this group.`,
    );
    this.name = "MaterialTitleConflictError";
  }
}

export class MaterialNotFoundError extends Error {
  constructor() {
    super("This Material could not be found.");
    this.name = "MaterialNotFoundError";
  }
}

export async function createStandaloneMaterial(
  database: Database,
  title: string,
): Promise<Material> {
  const normalizedTitle = normalizeTitle(title);

  try {
    return await database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(1886218352, 0)`,
      );
      const [lastPosition] = await transaction
        .select({ position: max(materials.position) })
        .from(materials)
        .where(isNull(materials.parentId));
      const [material] = await transaction
        .insert(materials)
        .values({
          title: normalizedTitle,
          position: (lastPosition?.position ?? -1) + 1,
        })
        .returning();

      if (!material) throw new Error("Creating Material returned no row.");
      return material;
    });
  } catch (error) {
    if (!isTitleUniqueViolation(error)) throw error;
    throw await findTitleConflict(database, normalizedTitle);
  }
}

export async function listLibraryMaterials(
  database: Database,
): Promise<Material[]> {
  return database
    .select()
    .from(materials)
    .where(isNull(materials.parentId))
    .orderBy(asc(materials.position), asc(materials.id));
}

export async function renameMaterial(
  database: Database,
  materialId: string,
  title: string,
): Promise<Material> {
  const normalizedTitle = normalizeTitle(title);

  try {
    const [material] = await database
      .update(materials)
      .set({ title: normalizedTitle })
      .where(and(eq(materials.id, materialId), isNull(materials.parentId)))
      .returning();

    if (!material) throw new MaterialNotFoundError();
    return material;
  } catch (error) {
    if (!isTitleUniqueViolation(error)) throw error;
    throw await findTitleConflict(database, normalizedTitle);
  }
}

function normalizeTitle(title: string): string {
  const normalizedTitle = title.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, "");
  if (normalizedTitle.length === 0) throw new InvalidMaterialTitleError();
  return normalizedTitle;
}

function isTitleUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "materials_sibling_title_unique"
  ) {
    return true;
  }

  return (
    "cause" in error &&
    error.cause !== error &&
    isTitleUniqueViolation(error.cause)
  );
}

async function findTitleConflict(
  database: Database,
  title: string,
): Promise<MaterialTitleConflictError> {
  const [conflictingMaterial] = await database
    .select()
    .from(materials)
    .where(
      and(
        isNull(materials.parentId),
        sql`${normalizedTitleExpression(materials.title)} = lower(${title})`,
      ),
    )
    .limit(1);

  if (!conflictingMaterial)
    throw new Error(
      "The title conflicted, but the existing Material was not found.",
    );
  return new MaterialTitleConflictError(conflictingMaterial);
}
