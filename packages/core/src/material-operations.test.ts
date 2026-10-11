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
  listLibraryMaterialTree,
  listLibraryMaterials,
  renameMaterial,
} from "./material-operations.js";
import { materials } from "./schema.js";
import * as schema from "./schema.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("Material operations", () => {
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

  it("persists a new standalone Material at the end of the Library", async () => {
    const first = await createStandaloneMaterial(
      database,
      `First ${crypto.randomUUID()}`,
    );
    const last = await createStandaloneMaterial(
      database,
      `Last ${crypto.randomUUID()}`,
    );

    const library = await listLibraryMaterials(database);

    expect(library.at(-1)?.id).toBe(last.id);
    expect(library.find((material) => material.id === first.id)?.title).toBe(
      first.title,
    );
  });

  it("creates nested Material in order and scopes title uniqueness to siblings", async () => {
    const parent = await createStandaloneMaterial(
      database,
      `Parent ${crypto.randomUUID()}`,
    );
    const otherParent = await createStandaloneMaterial(
      database,
      `Other parent ${crypto.randomUUID()}`,
    );
    const chapter = await createChildMaterial(
      database,
      parent.id,
      `Chapter ${crypto.randomUUID()}`,
    );
    const nextChapter = await createChildMaterial(
      database,
      parent.id,
      `Next chapter ${crypto.randomUUID()}`,
    );
    const exercise = await createChildMaterial(
      database,
      chapter.id,
      `Exercise ${crypto.randomUUID()}`,
    );
    const renamedExercise = await renameMaterial(
      database,
      exercise.id,
      `Renamed exercise ${crypto.randomUUID()}`,
    );
    const sameTitleElsewhere = await createChildMaterial(
      database,
      otherParent.id,
      chapter.title,
    );
    const library = await listLibraryMaterialTree(database);
    const savedParent = library.find((material) => material.id === parent.id);
    const savedChapter = savedParent?.children.find(
      (material) => material.id === chapter.id,
    );

    await expect(
      createChildMaterial(
        database,
        parent.id,
        ` ${chapter.title.toUpperCase()} `,
      ),
    ).rejects.toMatchObject({
      name: "MaterialTitleConflictError",
      conflictingMaterial: { id: chapter.id, title: chapter.title },
    });

    expect(chapter.parentId).toBe(parent.id);
    expect(exercise.parentId).toBe(chapter.id);
    expect(renamedExercise.id).toBe(exercise.id);
    expect(renamedExercise.parentId).toBe(chapter.id);
    expect(sameTitleElsewhere.parentId).toBe(otherParent.id);
    expect(sameTitleElsewhere.title).toBe(chapter.title);
    expect(savedParent?.children.map((material) => material.id)).toContain(
      nextChapter.id,
    );
    expect(savedParent?.children[0]?.id).toBe(chapter.id);
    expect(savedChapter?.children.map((material) => material.id)).toContain(
      renamedExercise.id,
    );
  });

  it("renames a standalone Material without changing its identity", async () => {
    const original = await createStandaloneMaterial(
      database,
      `Original ${crypto.randomUUID()}`,
    );
    const title = `Renamed ${crypto.randomUUID()}`;
    const renamed = await renameMaterial(database, original.id, title);
    const library = await listLibraryMaterials(database);

    expect(renamed.id).toBe(original.id);
    expect(renamed.title).toBe(title);
    expect(library.find((material) => material.id === original.id)?.title).toBe(
      title,
    );
  });

  it("rejects normalized duplicate titles and identifies the existing Material", async () => {
    const original = await createStandaloneMaterial(
      database,
      `Warm-up ${crypto.randomUUID()}`,
    );

    await expect(
      createStandaloneMaterial(database, `\t${original.title.toUpperCase()}\t`),
    ).rejects.toMatchObject({
      name: "MaterialTitleConflictError",
      conflictingMaterial: { id: original.id, title: original.title },
    });

    const library = await listLibraryMaterials(database);
    expect(
      library.filter(
        (material) =>
          material.title.toLowerCase() === original.title.toLowerCase(),
      ),
    ).toEqual([original]);
  });

  it("enforces normalized title uniqueness in PostgreSQL", async () => {
    const original = await createStandaloneMaterial(
      database,
      `Indexed ${crypto.randomUUID()}`,
    );

    await expect(
      database
        .insert(materials)
        .values({ title: `\t${original.title.toUpperCase()}\t` }),
    ).rejects.toMatchObject({
      cause: { code: "23505", constraint: "materials_sibling_title_unique" },
    });

    await expect(
      database.insert(materials).values({ title: " \t\n " }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "materials_title_not_blank" },
    });
  });

  it("preserves the saved title when a rename conflicts", async () => {
    const existing = await createStandaloneMaterial(
      database,
      `Existing ${crypto.randomUUID()}`,
    );
    const original = await createStandaloneMaterial(
      database,
      `Original ${crypto.randomUUID()}`,
    );

    await expect(
      renameMaterial(
        database,
        original.id,
        ` ${existing.title.toUpperCase()} `,
      ),
    ).rejects.toMatchObject({
      name: "MaterialTitleConflictError",
      conflictingMaterial: { id: existing.id, title: existing.title },
    });

    const library = await listLibraryMaterials(database);
    expect(library.find((material) => material.id === original.id)?.title).toBe(
      original.title,
    );
  });

  it("rejects a blank title", async () => {
    await expect(
      createStandaloneMaterial(database, "  \t  "),
    ).rejects.toMatchObject({
      name: "InvalidMaterialTitleError",
    });
  });
});
