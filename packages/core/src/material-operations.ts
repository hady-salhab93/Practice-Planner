import { and, asc, eq, isNull, max, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import {
  materials,
  materialReferences,
  normalizedTitleExpression,
  type Material,
  type MaterialReference,
} from "./schema.js";

type Database = NodePgDatabase<typeof schema>;

export type MaterialTreeNode = Material & {
  children: MaterialTreeNode[];
  references: MaterialReference[];
};

export type MaterialReferenceInput = {
  id?: string;
  label: string | null;
  url: string;
};

export type MaterialMetadata = {
  description: string;
  references: MaterialReferenceInput[];
};

export class InvalidMaterialReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMaterialReferenceError";
  }
}

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
  return createMaterialInGroup(database, title, null);
}

export async function createChildMaterial(
  database: Database,
  parentId: string,
  title: string,
): Promise<Material> {
  return createMaterialInGroup(database, title, parentId);
}

async function createMaterialInGroup(
  database: Database,
  title: string,
  parentId: string | null,
): Promise<Material> {
  const normalizedTitle = normalizeTitle(title);

  try {
    return await database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(1886218352, 0)`,
      );
      if (parentId !== null) {
        const [parent] = await transaction
          .select({ id: materials.id })
          .from(materials)
          .where(eq(materials.id, parentId));
        if (!parent) throw new MaterialNotFoundError();
      }
      const [lastPosition] = await transaction
        .select({ position: max(materials.position) })
        .from(materials)
        .where(
          parentId === null
            ? isNull(materials.parentId)
            : eq(materials.parentId, parentId),
        );
      const [material] = await transaction
        .insert(materials)
        .values({
          title: normalizedTitle,
          parentId,
          position: (lastPosition?.position ?? -1) + 1,
        })
        .returning();

      if (!material) throw new Error("Creating Material returned no row.");
      return material;
    });
  } catch (error) {
    if (!isTitleUniqueViolation(error)) throw error;
    throw await findTitleConflict(database, normalizedTitle, parentId);
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

export async function reorderMaterial(
  database: Database,
  materialId: string,
  direction: "up" | "down",
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(1886218352, 0)`,
    );

    const [material] = await transaction
      .select()
      .from(materials)
      .where(eq(materials.id, materialId));
    if (!material) throw new MaterialNotFoundError();

    const siblings = await transaction
      .select()
      .from(materials)
      .where(
        material.parentId === null
          ? isNull(materials.parentId)
          : eq(materials.parentId, material.parentId),
      )
      .orderBy(asc(materials.position), asc(materials.id));
    const currentIndex = siblings.findIndex(({ id }) => id === materialId);
    const nextIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (currentIndex < 0) throw new MaterialNotFoundError();
    if (nextIndex < 0 || nextIndex >= siblings.length) return;

    const reorderedSiblings = [...siblings];
    const [movedMaterial] = reorderedSiblings.splice(currentIndex, 1);
    if (!movedMaterial) throw new MaterialNotFoundError();
    reorderedSiblings.splice(nextIndex, 0, movedMaterial);

    for (const [position, sibling] of reorderedSiblings.entries()) {
      await transaction
        .update(materials)
        .set({ position })
        .where(eq(materials.id, sibling.id));
    }
  });
}

export async function listLibraryMaterialTree(
  database: Database,
): Promise<MaterialTreeNode[]> {
  const [rows, references] = await Promise.all([
    database
      .select()
      .from(materials)
      .orderBy(asc(materials.position), asc(materials.id)),
    database
      .select()
      .from(materialReferences)
      .orderBy(asc(materialReferences.position), asc(materialReferences.id)),
  ]);
  const nodes = new Map<string, MaterialTreeNode>();
  const roots: MaterialTreeNode[] = [];

  for (const material of rows) {
    nodes.set(material.id, {
      ...material,
      children: [],
      references: references.filter(
        (reference) => reference.materialId === material.id,
      ),
    });
  }

  for (const material of rows) {
    const node = nodes.get(material.id);
    if (!node) continue;

    if (material.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(material.parentId);
    if (parent) parent.children.push(node);
  }

  return roots;
}

export async function updateMaterialMetadata(
  database: Database,
  materialId: string,
  metadata: MaterialMetadata,
): Promise<Material & { references: MaterialReference[] }> {
  const normalizedReferences = metadata.references.map((reference) => ({
    ...reference,
    label: reference.label?.trim() || null,
    url: normalizeReferenceUrl(reference.url),
  }));
  const referenceIds = normalizedReferences.flatMap((reference) =>
    reference.id ? [reference.id] : [],
  );
  if (new Set(referenceIds).size !== referenceIds.length) {
    throw new InvalidMaterialReferenceError(
      "A reference cannot be included more than once.",
    );
  }

  return database.transaction(async (transaction) => {
    const [existingMaterial] = await transaction
      .select()
      .from(materials)
      .where(eq(materials.id, materialId));
    if (!existingMaterial) throw new MaterialNotFoundError();

    const existingReferences = await transaction
      .select()
      .from(materialReferences)
      .where(eq(materialReferences.materialId, materialId));
    const existingIds = new Set(existingReferences.map(({ id }) => id));
    if (referenceIds.some((id) => !existingIds.has(id))) {
      throw new InvalidMaterialReferenceError(
        "One of these references no longer belongs to this Material. Reload and try again.",
      );
    }

    const [updatedMaterial] = await transaction
      .update(materials)
      .set({ description: metadata.description || null })
      .where(eq(materials.id, materialId))
      .returning();
    if (!updatedMaterial) throw new MaterialNotFoundError();

    const retainedIds = new Set(referenceIds);
    const removedIds = existingReferences
      .filter(({ id }) => !retainedIds.has(id))
      .map(({ id }) => id);
    if (removedIds.length > 0) {
      await transaction
        .delete(materialReferences)
        .where(
          and(
            eq(materialReferences.materialId, materialId),
            notInArray(materialReferences.id, referenceIds),
          ),
        );
    }

    for (const [position, reference] of normalizedReferences.entries()) {
      const values = {
        label: reference.label,
        url: reference.url,
        position,
      };
      if (reference.id) {
        await transaction
          .update(materialReferences)
          .set(values)
          .where(
            and(
              eq(materialReferences.id, reference.id),
              eq(materialReferences.materialId, materialId),
            ),
          );
      } else {
        await transaction.insert(materialReferences).values({
          ...values,
          materialId,
        });
      }
    }

    const savedReferences = await transaction
      .select()
      .from(materialReferences)
      .where(eq(materialReferences.materialId, materialId))
      .orderBy(asc(materialReferences.position), asc(materialReferences.id));
    return { ...updatedMaterial, references: savedReferences };
  });
}

function normalizeReferenceUrl(url: string): string {
  const normalizedUrl = url.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new InvalidMaterialReferenceError(
      "Enter a valid web address for each reference.",
    );
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new InvalidMaterialReferenceError(
      "Reference links must use HTTP or HTTPS.",
    );
  }
  return normalizedUrl;
}

export async function renameMaterial(
  database: Database,
  materialId: string,
  title: string,
): Promise<Material> {
  const normalizedTitle = normalizeTitle(title);
  const [existing] = await database
    .select({ parentId: materials.parentId })
    .from(materials)
    .where(eq(materials.id, materialId));

  if (!existing) throw new MaterialNotFoundError();

  try {
    const [material] = await database
      .update(materials)
      .set({ title: normalizedTitle })
      .where(eq(materials.id, materialId))
      .returning();

    if (!material) throw new MaterialNotFoundError();
    return material;
  } catch (error) {
    if (!isTitleUniqueViolation(error)) throw error;
    throw await findTitleConflict(database, normalizedTitle, existing.parentId);
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
  parentId: string | null,
): Promise<MaterialTitleConflictError> {
  const [conflictingMaterial] = await database
    .select()
    .from(materials)
    .where(
      and(
        parentId === null
          ? isNull(materials.parentId)
          : eq(materials.parentId, parentId),
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
