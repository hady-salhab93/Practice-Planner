import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
  notInArray,
  sql,
} from "drizzle-orm";
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

export const LIBRARY_PAGE_SIZE = 20;

export type LibraryMaterialPage = {
  materials: MaterialTreeNode[];
  page: number;
  pageCount: number;
  standaloneTotal: number;
  materialTotal: number;
};

export type LibraryMaterialSearchResult = {
  id: string;
  title: string;
  ancestorPath: Array<{ id: string; title: string }>;
};

export type MaterialReferenceInput = {
  id?: string;
  label: string | null;
  url: string;
};

export type MaterialMetadata = {
  title?: string;
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

export class MaterialArchiveRootOnlyError extends Error {
  constructor() {
    super("Only standalone Material can be archived or restored.");
    this.name = "MaterialArchiveRootOnlyError";
  }
}

export class ArchivedMaterialParentError extends Error {
  constructor() {
    super("Restore the standalone Material before adding children.");
    this.name = "ArchivedMaterialParentError";
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
      if (parentId !== null) await ensureAvailableParent(transaction, parentId);
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
    .where(and(isNull(materials.parentId), isNull(materials.archivedAt)))
    .orderBy(asc(materials.position), asc(materials.id));
}

export async function listLibraryMaterialTree(
  database: Database,
): Promise<MaterialTreeNode[]> {
  return loadMaterialTree(database, false);
}

export async function listLibraryMaterialPage(
  database: Database,
  requestedPage: number,
): Promise<LibraryMaterialPage> {
  const [rootCountRows, materialTotal] = await Promise.all([
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(materials)
      .where(and(isNull(materials.parentId), isNull(materials.archivedAt))),
    countLibraryMaterials(database),
  ]);
  const standaloneTotal = rootCountRows[0]?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(standaloneTotal / LIBRARY_PAGE_SIZE));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, pageCount)
      : 1;
  const roots = await database
    .select()
    .from(materials)
    .where(and(isNull(materials.parentId), isNull(materials.archivedAt)))
    .orderBy(asc(materials.position), asc(materials.id))
    .limit(LIBRARY_PAGE_SIZE)
    .offset((page - 1) * LIBRARY_PAGE_SIZE);

  return {
    materials: await loadMaterialTreeFromRoots(database, roots),
    page,
    pageCount,
    standaloneTotal,
    materialTotal,
  };
}

export async function listArchivedMaterialTree(
  database: Database,
): Promise<MaterialTreeNode[]> {
  return loadMaterialTree(database, true);
}

async function loadMaterialTree(
  database: Database,
  archivedRoots: boolean,
): Promise<MaterialTreeNode[]> {
  const roots = await database
    .select()
    .from(materials)
    .where(
      and(
        isNull(materials.parentId),
        archivedRoots
          ? isNotNull(materials.archivedAt)
          : isNull(materials.archivedAt),
      ),
    )
    .orderBy(asc(materials.position), asc(materials.id));
  return loadMaterialTreeFromRoots(database, roots);
}

async function loadMaterialTreeFromRoots(
  database: Database,
  roots: Material[],
): Promise<MaterialTreeNode[]> {
  if (roots.length === 0) return [];

  const rootIds = roots.map((root) => root.id);
  const subtreeIds = sql`(
    with recursive selected_materials(id) as (
      select id
      from materials
      where ${inArray(materials.id, rootIds)}
      union all
      select child.id
      from materials as child
      inner join selected_materials as parent on child.parent_id = parent.id
    )
    select id from selected_materials
  )`;
  const rows = await database
    .select()
    .from(materials)
    .where(inArray(materials.id, subtreeIds))
    .orderBy(asc(materials.position), asc(materials.id));
  const references = await database
    .select()
    .from(materialReferences)
    .where(
      inArray(
        materialReferences.materialId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(materialReferences.position), asc(materialReferences.id));
  const nodes = new Map<string, MaterialTreeNode>();
  const referencesByMaterial = new Map<string, MaterialReference[]>();

  for (const reference of references) {
    const existing = referencesByMaterial.get(reference.materialId) ?? [];
    existing.push(reference);
    referencesByMaterial.set(reference.materialId, existing);
  }

  for (const material of rows) {
    nodes.set(material.id, {
      ...material,
      children: [],
      references: referencesByMaterial.get(material.id) ?? [],
    });
  }

  for (const material of rows) {
    const node = nodes.get(material.id);
    if (!node) continue;

    if (material.parentId === null) continue;

    const parent = nodes.get(material.parentId);
    if (parent) parent.children.push(node);
  }

  return rootIds.flatMap((rootId) => {
    const root = nodes.get(rootId);
    return root ? [root] : [];
  });
}

async function countLibraryMaterials(database: Database): Promise<number> {
  const result = await database.execute(sql<{ count: number }>`
    with recursive visible_materials(id) as (
      select id
      from materials
      where parent_id is null and archived_at is null
      union all
      select child.id
      from materials as child
      inner join visible_materials as parent on child.parent_id = parent.id
    )
    select count(*)::int as count from visible_materials
  `);
  const count = result.rows[0]?.count;
  if (typeof count !== "number") {
    throw new Error("Counting Library Material returned no numeric result.");
  }
  return count;
}

export async function searchLibraryMaterials(
  database: Database,
  query: string,
): Promise<LibraryMaterialSearchResult[]> {
  return searchMaterials(database, query, false);
}

export async function searchArchivedMaterials(
  database: Database,
  query: string,
): Promise<LibraryMaterialSearchResult[]> {
  return searchMaterials(database, query, true);
}

async function searchMaterials(
  database: Database,
  query: string,
  archivedRoots: boolean,
): Promise<LibraryMaterialSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const rows = await database
    .select()
    .from(materials)
    .orderBy(asc(materials.position), asc(materials.id));
  type SearchNode = Material & { children: SearchNode[] };
  const nodes = new Map<string, SearchNode>();
  const roots: SearchNode[] = [];

  for (const material of rows) {
    nodes.set(material.id, { ...material, children: [] });
  }

  for (const material of rows) {
    const node = nodes.get(material.id);
    if (!node) continue;

    if (material.parentId === null) {
      if ((material.archivedAt !== null) === archivedRoots) roots.push(node);
      continue;
    }

    const parent = nodes.get(material.parentId);
    if (parent) parent.children.push(node);
  }

  const results: LibraryMaterialSearchResult[] = [];
  function visit(
    node: SearchNode,
    ancestorPath: LibraryMaterialSearchResult["ancestorPath"],
  ) {
    if (node.title.toLowerCase().includes(normalizedQuery)) {
      results.push({ id: node.id, title: node.title, ancestorPath });
    }

    const childPath = [...ancestorPath, { id: node.id, title: node.title }];
    for (const child of node.children) visit(child, childPath);
  }

  for (const root of roots) visit(root, []);
  return results;
}

export async function archiveMaterial(
  database: Database,
  materialId: string,
): Promise<Material> {
  return updateRootArchiveState(database, materialId, true);
}

export async function restoreMaterial(
  database: Database,
  materialId: string,
): Promise<Material> {
  return updateRootArchiveState(database, materialId, false);
}

async function updateRootArchiveState(
  database: Database,
  materialId: string,
  archived: boolean,
): Promise<Material> {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(1886218352, 0)`);
    const [existing] = await transaction
      .select()
      .from(materials)
      .where(eq(materials.id, materialId));
    if (!existing) throw new MaterialNotFoundError();
    if (existing.parentId !== null) throw new MaterialArchiveRootOnlyError();
    if ((existing.archivedAt !== null) === archived) return existing;

    const [updated] = await transaction
      .update(materials)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(materials.id, materialId))
      .returning();
    if (!updated) throw new MaterialNotFoundError();
    return updated;
  });
}

async function ensureAvailableParent(
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
  parentId: string,
): Promise<void> {
  let ancestorId: string | null = parentId;
  while (ancestorId !== null) {
    const [ancestor] = await transaction
      .select({
        id: materials.id,
        parentId: materials.parentId,
        archivedAt: materials.archivedAt,
      })
      .from(materials)
      .where(eq(materials.id, ancestorId));
    if (!ancestor) throw new MaterialNotFoundError();
    if (ancestor.archivedAt !== null) throw new ArchivedMaterialParentError();
    ancestorId = ancestor.parentId;
  }
}

export async function updateMaterialMetadata(
  database: Database,
  materialId: string,
  metadata: MaterialMetadata,
): Promise<Material & { references: MaterialReference[] }> {
  const normalizedTitle =
    metadata.title === undefined ? undefined : normalizeTitle(metadata.title);
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

  return database
    .transaction(async (transaction) => {
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
        .set({
          ...(normalizedTitle === undefined ? {} : { title: normalizedTitle }),
          description: metadata.description || null,
        })
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
    })
    .catch(async (error: unknown) => {
      if (normalizedTitle === undefined || !isTitleUniqueViolation(error))
        throw error;
      const [existing] = await database
        .select({ parentId: materials.parentId })
        .from(materials)
        .where(eq(materials.id, materialId));
      if (!existing) throw new MaterialNotFoundError();
      throw await findTitleConflict(
        database,
        normalizedTitle,
        existing.parentId,
      );
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
