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
  archiveMaterial,
  listLibraryMaterialTree,
} from "./material-operations.js";
import { createSprint, listSprints } from "./sprint-operations.js";
import {
  ArchivedSprintMaterialError,
  listSprintMaterialCollection,
  listSprintMaterialPlan,
  hasSprintMaterialMembership,
  SprintMaterialLockedError,
  updateSprintMaterialSelection,
} from "./sprint-material-operations.js";
import * as schema from "./schema.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("Sprint Material operations", () => {
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

  it("saves a selected Material subtree without changing the Library hierarchy", async () => {
    const now = new Date("2200-01-01T12:00:00.000Z");
    const { startDate, endDate } = await getSprintDates(database);
    const parent = await createStandaloneMaterial(
      database,
      `Selected parent ${crypto.randomUUID()}`,
    );
    const child = await createChildMaterial(
      database,
      parent.id,
      `Selected child ${crypto.randomUUID()}`,
    );
    const grandchild = await createChildMaterial(
      database,
      child.id,
      `Selected grandchild ${crypto.randomUUID()}`,
    );
    const sprint = await createSprint(
      database,
      {
        name: `Selection ${crypto.randomUUID()}`,
        startDate,
        endDate,
        deviceTimeZone: "UTC",
      },
      { now },
    );

    await updateSprintMaterialSelection(
      database,
      sprint.id,
      [{ type: "select", materialId: parent.id }],
      { now },
    );
    const plan = await listSprintMaterialPlan(database, sprint.id, { now });
    const library = await listLibraryMaterialTree(database);

    expect(plan.selectedMaterialIds).toEqual(
      expect.arrayContaining([parent.id, child.id, grandchild.id]),
    );
    expect(plan.selectedMaterialIds).toHaveLength(3);
    expect(library.find((material) => material.id === parent.id)).toMatchObject(
      {
        parentId: null,
        children: [
          expect.objectContaining({
            id: child.id,
            parentId: parent.id,
            children: [expect.objectContaining({ id: grandchild.id })],
          }),
        ],
      },
    );
  });

  it("selects nested Material without ancestors and does not absorb later children", async () => {
    const now = new Date("2200-01-01T12:00:00.000Z");
    const { startDate, endDate } = await getSprintDates(database);
    const root = await createStandaloneMaterial(
      database,
      `Nested root ${crypto.randomUUID()}`,
    );
    const selected = await createChildMaterial(
      database,
      root.id,
      `Nested selection ${crypto.randomUUID()}`,
    );
    await createChildMaterial(
      database,
      root.id,
      `Unselected sibling ${crypto.randomUUID()}`,
    );
    const sprint = await createSprint(
      database,
      {
        name: `Nested selection ${crypto.randomUUID()}`,
        startDate,
        endDate,
        deviceTimeZone: "UTC",
      },
      { now },
    );

    await updateSprintMaterialSelection(
      database,
      sprint.id,
      [{ type: "select", materialId: selected.id }],
      { now },
    );
    const laterChild = await createChildMaterial(
      database,
      selected.id,
      `Later child ${crypto.randomUUID()}`,
    );
    const firstPlan = await listSprintMaterialPlan(database, sprint.id, {
      now,
    });

    expect(firstPlan.selectedMaterialIds).toEqual([selected.id]);
    expect(firstPlan.selectedMaterials).toMatchObject([
      { id: selected.id, isSelected: true, children: [] },
    ]);
    expect(firstPlan.selectedMaterials).toHaveLength(1);
    const collection = await listSprintMaterialCollection(database, { now });
    expect(collection.plans[sprint.id]?.selectedMaterials).toMatchObject([
      { id: selected.id, isSelected: true, children: [] },
    ]);

    await updateSprintMaterialSelection(
      database,
      sprint.id,
      [{ type: "select", materialId: laterChild.id }],
      { now },
    );
    const updatedPlan = await listSprintMaterialPlan(database, sprint.id, {
      now,
    });
    expect(updatedPlan.selectedMaterialIds).toEqual(
      expect.arrayContaining([selected.id, laterChild.id]),
    );
    expect(updatedPlan.selectedMaterialIds).toHaveLength(2);
    expect(updatedPlan.selectedMaterials).toMatchObject([
      {
        id: selected.id,
        children: [{ id: laterChild.id, isSelected: true, children: [] }],
      },
    ]);
    await updateSprintMaterialSelection(
      database,
      sprint.id,
      [{ type: "remove", materialId: laterChild.id }],
      { now },
    );
    const refined = await listSprintMaterialPlan(database, sprint.id, { now });
    expect(refined.selectedMaterials).toMatchObject([
      { id: selected.id, isSelected: true, children: [] },
    ]);
  });

  it("removes a selected subtree only from the chosen Sprint", async () => {
    const now = new Date("2200-01-01T12:00:00.000Z");
    const first = await getSprintDates(database);
    const root = await createStandaloneMaterial(
      database,
      `Removal root ${crypto.randomUUID()}`,
    );
    const child = await createChildMaterial(
      database,
      root.id,
      `Removal child ${crypto.randomUUID()}`,
    );
    const other = await createStandaloneMaterial(
      database,
      `Other selected Material ${crypto.randomUUID()}`,
    );
    const source = await createSprint(
      database,
      {
        name: `Source ${crypto.randomUUID()}`,
        startDate: first.startDate,
        endDate: first.endDate,
        deviceTimeZone: "UTC",
      },
      { now },
    );
    const destination = await createSprint(
      database,
      {
        name: `Other ${crypto.randomUUID()}`,
        startDate: addDays(first.endDate, 1),
        endDate: addDays(first.endDate, 7),
        deviceTimeZone: "UTC",
      },
      { now },
    );

    await updateSprintMaterialSelection(
      database,
      source.id,
      [
        { type: "select", materialId: root.id },
        { type: "select", materialId: other.id },
      ],
      { now },
    );
    await updateSprintMaterialSelection(
      database,
      destination.id,
      [{ type: "select", materialId: child.id }],
      { now },
    );
    await updateSprintMaterialSelection(
      database,
      source.id,
      [{ type: "remove", materialId: root.id }],
      { now },
    );

    const sourcePlan = await listSprintMaterialPlan(database, source.id, {
      now,
    });
    const otherPlan = await listSprintMaterialPlan(database, destination.id, {
      now,
    });
    expect(sourcePlan.selectedMaterialIds).toEqual([other.id]);
    expect(otherPlan.selectedMaterialIds).toEqual([child.id]);
    expect(await hasSprintMaterialMembership(database, root.id)).toBe(false);
    expect(await hasSprintMaterialMembership(database, child.id)).toBe(true);

    await updateSprintMaterialSelection(
      database,
      destination.id,
      [{ type: "remove", materialId: child.id }],
      { now },
    );
    expect(await hasSprintMaterialMembership(database, child.id)).toBe(false);
  });

  it("requires restoring an archived root for new selection and preserves existing membership", async () => {
    const now = new Date("2200-01-01T12:00:00.000Z");
    const { startDate, endDate } = await getSprintDates(database);
    const root = await createStandaloneMaterial(
      database,
      `Archived selection ${crypto.randomUUID()}`,
    );
    const child = await createChildMaterial(
      database,
      root.id,
      `Archived child ${crypto.randomUUID()}`,
    );
    const sprint = await createSprint(
      database,
      {
        name: `Archive membership ${crypto.randomUUID()}`,
        startDate,
        endDate,
        deviceTimeZone: "UTC",
      },
      { now },
    );

    await updateSprintMaterialSelection(
      database,
      sprint.id,
      [{ type: "select", materialId: child.id }],
      { now },
    );
    await archiveMaterial(database, root.id);
    await expect(
      updateSprintMaterialSelection(
        database,
        sprint.id,
        [{ type: "select", materialId: child.id }],
        { now },
      ),
    ).rejects.toBeInstanceOf(ArchivedSprintMaterialError);

    const plan = await listSprintMaterialPlan(database, sprint.id, { now });
    expect(plan.selectedMaterialIds).toEqual([child.id]);
    expect(plan.selectedMaterials).toMatchObject([
      { id: child.id, isSelected: true, children: [] },
    ]);
    expect(await hasSprintMaterialMembership(database, child.id)).toBe(true);
  });

  it("locks membership when the Sprint has become past", async () => {
    const creationTime = new Date("2200-01-01T12:00:00.000Z");
    const { startDate: pastStart, endDate: pastEnd } =
      await getSprintDates(database);
    const root = await createStandaloneMaterial(
      database,
      `Past membership ${crypto.randomUUID()}`,
    );
    const sprint = await createSprint(
      database,
      {
        name: `Past Sprint ${crypto.randomUUID()}`,
        startDate: pastStart,
        endDate: pastEnd,
        deviceTimeZone: "UTC",
      },
      { now: creationTime },
    );
    await updateSprintMaterialSelection(
      database,
      sprint.id,
      [{ type: "select", materialId: root.id }],
      { now: creationTime },
    );

    await expect(
      updateSprintMaterialSelection(
        database,
        sprint.id,
        [{ type: "remove", materialId: root.id }],
        { now: new Date(`${addDays(pastEnd, 1)}T12:00:00.000Z`) },
      ),
    ).rejects.toBeInstanceOf(SprintMaterialLockedError);
    expect(
      (
        await listSprintMaterialPlan(database, sprint.id, {
          now: new Date(`${addDays(pastEnd, 1)}T12:00:00.000Z`),
        })
      ).selectedMaterialIds,
    ).toEqual([root.id]);
  });
});

async function getSprintDates(database: NodePgDatabase<typeof schema>) {
  let startDate = "2300-01-01";
  const { sprints } = await listSprints(database);
  for (const sprint of sprints) {
    if (
      sprint.endDate >= startDate &&
      sprint.startDate <= addDays(startDate, 13)
    ) {
      startDate = addDays(sprint.endDate, 1);
    }
  }
  return { startDate, endDate: addDays(startDate, 6) };
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
