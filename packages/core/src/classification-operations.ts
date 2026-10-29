import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import {
  materialTags,
  tagGroups,
  tags,
  type Tag,
  type TagGroup,
} from "./schema.js";

type Database = NodePgDatabase<typeof schema>;

export class InvalidTagGroupNameError extends Error {
  constructor() {
    super("Enter a name for this Tag group.");
    this.name = "InvalidTagGroupNameError";
  }
}

export class TagGroupNameConflictError extends Error {
  constructor() {
    super("A Tag group with this name already exists.");
    this.name = "TagGroupNameConflictError";
  }
}

export class TagGroupNotFoundError extends Error {
  constructor() {
    super("This Tag group no longer exists.");
    this.name = "TagGroupNotFoundError";
  }
}

export class InvalidTagNameError extends Error {
  constructor() {
    super("Enter a name for this Tag.");
    this.name = "InvalidTagNameError";
  }
}

export class TagNameConflictError extends Error {
  constructor() {
    super("A Tag with this name already exists in this group.");
    this.name = "TagNameConflictError";
  }
}

export class TagNotFoundError extends Error {
  constructor() {
    super("This Tag no longer exists.");
    this.name = "TagNotFoundError";
  }
}

export class ClassificationDeleteImpactChangedError extends Error {
  constructor(readonly affectedMaterialCount: number) {
    super("Classification changed. Review the updated deletion impact.");
    this.name = "ClassificationDeleteImpactChangedError";
  }
}

export async function createTagGroup(
  database: Database,
  name: string,
): Promise<TagGroup> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new InvalidTagGroupNameError();

  try {
    const [group] = await database
      .insert(tagGroups)
      .values({ name: normalizedName })
      .returning();
    if (!group) throw new Error("Creating Tag group returned no row.");
    return group;
  } catch (error) {
    if (isUniqueViolation(error, "tag_groups_name_unique")) {
      throw new TagGroupNameConflictError();
    }
    throw error;
  }
}

export async function renameTagGroup(
  database: Database,
  groupId: string,
  name: string,
): Promise<TagGroup> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new InvalidTagGroupNameError();

  try {
    const [group] = await database
      .update(tagGroups)
      .set({ name: normalizedName })
      .where(eq(tagGroups.id, groupId))
      .returning();
    if (!group) throw new TagGroupNotFoundError();
    return group;
  } catch (error) {
    if (isUniqueViolation(error, "tag_groups_name_unique")) {
      throw new TagGroupNameConflictError();
    }
    throw error;
  }
}

export async function listTagGroups(database: Database): Promise<TagGroup[]> {
  return database.select().from(tagGroups).orderBy(asc(tagGroups.name));
}

export async function createTag(
  database: Database,
  groupId: string,
  name: string,
): Promise<Tag> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new InvalidTagNameError();

  try {
    const [tag] = await database
      .insert(tags)
      .values({ groupId, name: normalizedName })
      .returning();
    if (!tag) throw new Error("Creating Tag returned no row.");
    return tag;
  } catch (error) {
    if (isUniqueViolation(error, "tags_group_name_unique")) {
      throw new TagNameConflictError();
    }
    throw error;
  }
}

export async function renameTag(
  database: Database,
  tagId: string,
  name: string,
): Promise<Tag> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new InvalidTagNameError();

  try {
    const [tag] = await database
      .update(tags)
      .set({ name: normalizedName })
      .where(eq(tags.id, tagId))
      .returning();
    if (!tag) throw new TagNotFoundError();
    return tag;
  } catch (error) {
    if (isUniqueViolation(error, "tags_group_name_unique")) {
      throw new TagNameConflictError();
    }
    throw error;
  }
}

export async function deleteTag(
  database: Database,
  tagId: string,
  expectedAffectedMaterialCount?: number,
): Promise<number> {
  return database.transaction(async (transaction) => {
    const [tag] = await transaction
      .select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .for("update");
    if (!tag) throw new TagNotFoundError();

    const affectedMaterials = await transaction
      .selectDistinct({ materialId: materialTags.materialId })
      .from(materialTags)
      .where(eq(materialTags.tagId, tagId));
    if (
      expectedAffectedMaterialCount !== undefined &&
      expectedAffectedMaterialCount !== affectedMaterials.length
    ) {
      throw new ClassificationDeleteImpactChangedError(
        affectedMaterials.length,
      );
    }
    await transaction.delete(tags).where(eq(tags.id, tagId));

    return affectedMaterials.length;
  });
}

export async function deleteTagGroup(
  database: Database,
  groupId: string,
  expectedAffectedMaterialCount?: number,
): Promise<number> {
  return database.transaction(async (transaction) => {
    const [group] = await transaction
      .select()
      .from(tagGroups)
      .where(eq(tagGroups.id, groupId))
      .for("update");
    if (!group) throw new TagGroupNotFoundError();

    await transaction
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.groupId, groupId))
      .for("update");

    const affectedMaterials = await transaction
      .selectDistinct({ materialId: materialTags.materialId })
      .from(materialTags)
      .innerJoin(tags, eq(materialTags.tagId, tags.id))
      .where(eq(tags.groupId, groupId));
    if (
      expectedAffectedMaterialCount !== undefined &&
      expectedAffectedMaterialCount !== affectedMaterials.length
    ) {
      throw new ClassificationDeleteImpactChangedError(
        affectedMaterials.length,
      );
    }
    await transaction.delete(tagGroups).where(eq(tagGroups.id, groupId));

    return affectedMaterials.length;
  });
}

export async function listTags(database: Database): Promise<Tag[]> {
  return database
    .select()
    .from(tags)
    .orderBy(asc(tags.groupId), asc(tags.name));
}

export async function getTagDeletionImpactCount(
  database: Database,
  tagId: string,
): Promise<number> {
  const [tag] = await database
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, tagId));
  if (!tag) throw new TagNotFoundError();

  const affectedMaterials = await database
    .selectDistinct({ materialId: materialTags.materialId })
    .from(materialTags)
    .where(eq(materialTags.tagId, tagId));
  return affectedMaterials.length;
}

export async function getTagGroupDeletionImpactCount(
  database: Database,
  groupId: string,
): Promise<number> {
  const [group] = await database
    .select({ id: tagGroups.id })
    .from(tagGroups)
    .where(eq(tagGroups.id, groupId));
  if (!group) throw new TagGroupNotFoundError();

  const affectedMaterials = await database
    .selectDistinct({ materialId: materialTags.materialId })
    .from(materialTags)
    .innerJoin(tags, eq(materialTags.tagId, tags.id))
    .where(eq(tags.groupId, groupId));
  return affectedMaterials.length;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? error.cause
      : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  );
}
