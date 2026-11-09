import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createChildMaterial,
  createStandaloneMaterial,
  InvalidMaterialTagError,
  listLibraryMaterialTree,
  updateMaterialMetadata,
} from "./material-operations.js";
import {
  createTag,
  createTagGroup,
  deleteTagGroup,
  deleteTag,
  getTagDeletionImpactCount,
  getTagGroupDeletionImpactCount,
  renameTag,
  renameTagGroup,
  TagGroupNameConflictError,
  TagNameConflictError,
  listTagGroups,
  listTags,
} from "./classification-operations.js";
import * as schema from "./schema.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("Classification operations", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Set TEST_DATABASE_URL to a disposable PostgreSQL test database.",
      );
    }

    pool = new Pool({ connectionString });
    const { rows } = await pool.query<{ database_name: string }>(
      "select current_database() as database_name",
    );
    if (!rows[0]?.database_name.endsWith("_test")) {
      throw new Error(
        "TEST_DATABASE_URL must point to a database ending in _test.",
      );
    }

    database = drizzle(pool, { schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("persists a user-defined Tag group", async () => {
    const name = `Focus ${crypto.randomUUID()}`;

    const created = await createTagGroup(database, name);
    const groups = await listTagGroups(database);

    expect(groups).toContainEqual(created);
    expect(created.name).toBe(name);
  });

  it("rejects Tag group names that differ only by case and surrounding whitespace", async () => {
    const name = `Focus ${crypto.randomUUID()}`;
    await createTagGroup(database, name);

    await expect(
      createTagGroup(database, `  ${name.toUpperCase()}  `),
    ).rejects.toBeInstanceOf(TagGroupNameConflictError);
  });

  it("renames a Tag group without changing its identity", async () => {
    const group = await createTagGroup(
      database,
      `Old focus ${crypto.randomUUID()}`,
    );
    const name = `New focus ${crypto.randomUUID()}`;

    const renamed = await renameTagGroup(database, group.id, name);
    const groups = await listTagGroups(database);

    expect(renamed).toMatchObject({ id: group.id, name });
    expect(groups).toContainEqual(renamed);
  });

  it("preserves a Tag group when its rename conflicts with another group", async () => {
    const existing = await createTagGroup(
      database,
      `Existing ${crypto.randomUUID()}`,
    );
    const target = await createTagGroup(
      database,
      `Target ${crypto.randomUUID()}`,
    );

    await expect(
      renameTagGroup(database, target.id, ` ${existing.name.toUpperCase()} `),
    ).rejects.toBeInstanceOf(TagGroupNameConflictError);

    const groups = await listTagGroups(database);
    expect(groups).toContainEqual(target);
  });

  it("persists Tags within their groups and allows the same label in another group", async () => {
    const focus = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const style = await createTagGroup(
      database,
      `Style ${crypto.randomUUID()}`,
    );
    const focusTag = await createTag(database, focus.id, "Arpeggios");
    const styleTag = await createTag(database, style.id, "Arpeggios");
    const tags = await listTags(database);

    expect(tags).toEqual(expect.arrayContaining([focusTag, styleTag]));
    expect(focusTag.groupId).toBe(focus.id);
    expect(styleTag.groupId).toBe(style.id);
  });

  it("rejects Tag names that differ only by case and surrounding whitespace in one group", async () => {
    const group = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const tag = await createTag(database, group.id, "Arpeggios");

    await expect(
      createTag(database, group.id, `  ${tag.name.toUpperCase()}  `),
    ).rejects.toBeInstanceOf(TagNameConflictError);
  });

  it("renames a Tag without changing its identity or group", async () => {
    const group = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const tag = await createTag(database, group.id, "Arpeggios");
    const name = `Arpeggio study ${crypto.randomUUID()}`;

    const renamed = await renameTag(database, tag.id, name);
    const tags = await listTags(database);

    expect(renamed).toMatchObject({
      id: tag.id,
      groupId: group.id,
      name,
    });
    expect(tags).toContainEqual(renamed);
  });

  it("persists direct Material Tag assignments without inheriting them", async () => {
    const root = await createStandaloneMaterial(
      database,
      `Tagged root ${crypto.randomUUID()}`,
    );
    const child = await createChildMaterial(
      database,
      root.id,
      `Untagged child ${crypto.randomUUID()}`,
    );
    const group = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const tag = await createTag(database, group.id, "Arpeggios");

    await updateMaterialMetadata(database, root.id, {
      description: "",
      references: [],
      tagIds: [tag.id],
    });
    const library = await listLibraryMaterialTree(database);
    const savedRoot = library.find((material) => material.id === root.id);
    const savedChild = savedRoot?.children.find(
      (material) => material.id === child.id,
    );

    expect(savedRoot).toMatchObject({ tags: [tag] });
    expect(savedChild).toMatchObject({ tags: [] });

    await updateMaterialMetadata(database, root.id, {
      description: "",
      references: [],
      tagIds: [],
    });
    const updatedLibrary = await listLibraryMaterialTree(database);
    expect(
      updatedLibrary.find((material) => material.id === root.id),
    ).toMatchObject({ tags: [] });
  });

  it("rejects deleted Tag IDs without partially updating Material details", async () => {
    const material = await createStandaloneMaterial(
      database,
      `Invalid assignment ${crypto.randomUUID()}`,
    );
    const originalDescription = "Saved description";

    await updateMaterialMetadata(database, material.id, {
      description: originalDescription,
      references: [],
      tagIds: [],
    });

    await expect(
      updateMaterialMetadata(database, material.id, {
        title: `Changed ${crypto.randomUUID()}`,
        description: "Must not be saved",
        references: [],
        tagIds: [crypto.randomUUID()],
      }),
    ).rejects.toBeInstanceOf(InvalidMaterialTagError);

    const library = await listLibraryMaterialTree(database);
    expect(library.find((entry) => entry.id === material.id)).toMatchObject({
      title: material.title,
      description: originalDescription,
      tags: [],
    });
  });

  it("deletes a Tag, reports affected Material, and preserves other assignments", async () => {
    const first = await createStandaloneMaterial(
      database,
      `Tagged first ${crypto.randomUUID()}`,
    );
    const second = await createStandaloneMaterial(
      database,
      `Tagged second ${crypto.randomUUID()}`,
    );
    const group = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const removedTag = await createTag(database, group.id, "Arpeggios");
    const retainedTag = await createTag(database, group.id, "Pentatonic");

    await updateMaterialMetadata(database, first.id, {
      description: "Keep this Material",
      references: [],
      tagIds: [removedTag.id, retainedTag.id],
    });
    await updateMaterialMetadata(database, second.id, {
      description: "Keep this Material too",
      references: [],
      tagIds: [removedTag.id],
    });

    const affectedMaterialCount = await deleteTag(database, removedTag.id);
    const library = await listLibraryMaterialTree(database);

    expect(affectedMaterialCount).toBe(2);
    expect(library.find((material) => material.id === first.id)).toMatchObject({
      description: "Keep this Material",
      tags: [retainedTag],
    });
    expect(library.find((material) => material.id === second.id)).toMatchObject(
      {
        description: "Keep this Material too",
        tags: [],
      },
    );
  });

  it("rejects deletion when the affected-Material count changes after preview", async () => {
    const first = await createStandaloneMaterial(
      database,
      `Impact first ${crypto.randomUUID()}`,
    );
    const second = await createStandaloneMaterial(
      database,
      `Impact second ${crypto.randomUUID()}`,
    );
    const group = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const tag = await createTag(database, group.id, "Arpeggios");

    await updateMaterialMetadata(database, first.id, {
      description: "",
      references: [],
      tagIds: [tag.id],
    });
    const previewCount = await getTagDeletionImpactCount(database, tag.id);
    await updateMaterialMetadata(database, second.id, {
      description: "",
      references: [],
      tagIds: [tag.id],
    });

    await expect(
      deleteTag(database, tag.id, previewCount),
    ).rejects.toMatchObject({
      name: "ClassificationDeleteImpactChangedError",
      affectedMaterialCount: 2,
    });
    await expect(listTags(database)).resolves.toContainEqual(tag);
  });

  it("deletes a Tag group, counts distinct affected Material, and preserves other groups", async () => {
    const first = await createStandaloneMaterial(
      database,
      `Grouped first ${crypto.randomUUID()}`,
    );
    const second = await createStandaloneMaterial(
      database,
      `Grouped second ${crypto.randomUUID()}`,
    );
    const removedGroup = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const retainedGroup = await createTagGroup(
      database,
      `Style ${crypto.randomUUID()}`,
    );
    const firstRemovedTag = await createTag(
      database,
      removedGroup.id,
      "Arpeggios",
    );
    const secondRemovedTag = await createTag(
      database,
      removedGroup.id,
      "Pentatonic",
    );
    const retainedTag = await createTag(database, retainedGroup.id, "Blues");

    await updateMaterialMetadata(database, first.id, {
      description: "Keep this Material",
      references: [],
      tagIds: [firstRemovedTag.id, secondRemovedTag.id, retainedTag.id],
    });
    await updateMaterialMetadata(database, second.id, {
      description: "Keep this Material too",
      references: [],
      tagIds: [firstRemovedTag.id],
    });

    const affectedMaterialCount = await deleteTagGroup(
      database,
      removedGroup.id,
    );
    const library = await listLibraryMaterialTree(database);
    const groups = await listTagGroups(database);
    const tags = await listTags(database);

    expect(affectedMaterialCount).toBe(2);
    expect(groups).not.toContainEqual(removedGroup);
    expect(tags.filter((tag) => tag.groupId === removedGroup.id)).toEqual([]);
    expect(tags.filter((tag) => tag.groupId === retainedGroup.id)).toEqual([
      retainedTag,
    ]);
    expect(library.find((material) => material.id === first.id)).toMatchObject({
      description: "Keep this Material",
      tags: [retainedTag],
    });
    expect(library.find((material) => material.id === second.id)).toMatchObject(
      {
        description: "Keep this Material too",
        tags: [],
      },
    );
  });

  it("rejects group deletion when assignments change after impact preview", async () => {
    const first = await createStandaloneMaterial(
      database,
      `Group impact first ${crypto.randomUUID()}`,
    );
    const second = await createStandaloneMaterial(
      database,
      `Group impact second ${crypto.randomUUID()}`,
    );
    const group = await createTagGroup(
      database,
      `Focus ${crypto.randomUUID()}`,
    );
    const tag = await createTag(database, group.id, "Arpeggios");

    await updateMaterialMetadata(database, first.id, {
      description: "",
      references: [],
      tagIds: [tag.id],
    });
    const previewCount = await getTagGroupDeletionImpactCount(
      database,
      group.id,
    );
    await updateMaterialMetadata(database, second.id, {
      description: "",
      references: [],
      tagIds: [tag.id],
    });

    await expect(
      deleteTagGroup(database, group.id, previewCount),
    ).rejects.toMatchObject({
      name: "ClassificationDeleteImpactChangedError",
      affectedMaterialCount: 2,
    });
    await expect(listTagGroups(database)).resolves.toContainEqual(group);
  });
});
