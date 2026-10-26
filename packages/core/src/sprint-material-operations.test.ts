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
  deferSprintMaterialSubtree,
  listSprintMaterialCollection,
  listSprintMaterialPlan,
  hasSprintMaterialMembership,
  SprintMaterialLockedError,
  SprintMaterialNotCurrentError,
  SprintMaterialSelectionConflictError,
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

  it("transfers only the current Sprint's selected subtree to a future Sprint", async () => {
    const { startDate, endDate } = await getSprintDates(database);
    const now = await getInstantForCalendarDate(database, startDate);
    const root = await createStandaloneMaterial(
      database,
      `Deferral root ${crypto.randomUUID()}`,
    );
    const selected = await createChildMaterial(
      database,
      root.id,
      `Deferral selection ${crypto.randomUUID()}`,
    );
    const selectedChild = await createChildMaterial(
      database,
      selected.id,
      `Deferral selected child ${crypto.randomUUID()}`,
    );
    const excludedSibling = await createChildMaterial(
      database,
      root.id,
      `Deferral excluded sibling ${crypto.randomUUID()}`,
    );
    const other = await createStandaloneMaterial(
      database,
      `Deferral other selection ${crypto.randomUUID()}`,
    );
    const source = await createSprint(
      database,
      {
        name: `Deferral source ${crypto.randomUUID()}`,
        startDate,
        endDate,
        deviceTimeZone: "UTC",
      },
      { now },
    );
    const destination = await createSprint(
      database,
      {
        name: `Deferral destination ${crypto.randomUUID()}`,
        startDate: addDays(endDate, 1),
        endDate: addDays(endDate, 7),
        deviceTimeZone: "UTC",
      },
      { now },
    );
    const otherSprint = await createSprint(
      database,
      {
        name: `Deferral other Sprint ${crypto.randomUUID()}`,
        startDate: addDays(endDate, 8),
        endDate: addDays(endDate, 14),
        deviceTimeZone: "UTC",
      },
      { now },
    );
    await updateSprintMaterialSelection(
      database,
      source.id,
      [
        { type: "select", materialId: selected.id },
        { type: "select", materialId: other.id },
      ],
      { now },
    );
    await updateSprintMaterialSelection(
      database,
      otherSprint.id,
      [{ type: "select", materialId: selected.id }],
      { now },
    );
    const sourcePlan = await listSprintMaterialPlan(database, source.id, {
      now,
    });

    await deferSprintMaterialSubtree(
      database,
      {
        sourceSprintId: source.id,
        materialId: selected.id,
        expectedMaterialIds: [selected.id, selectedChild.id],
        destinationSprintId: destination.id,
      },
      { now },
    );

    const updatedSource = await listSprintMaterialPlan(database, source.id, {
      now,
    });
    const updatedDestination = await listSprintMaterialPlan(
      database,
      destination.id,
      { now },
    );
    expect(sourcePlan.selectedMaterialIds).toEqual(
      expect.arrayContaining([selected.id, selectedChild.id, other.id]),
    );
    expect(updatedSource.selectedMaterialIds).toEqual([other.id]);
    expect(updatedDestination.selectedMaterialIds).toEqual(
      expect.arrayContaining([selected.id, selectedChild.id]),
    );
    expect(updatedDestination.selectedMaterialIds).toHaveLength(2);
    expect(updatedDestination.selectedMaterialIds).not.toContain(
      excludedSibling.id,
    );
    expect(await hasSprintMaterialMembership(database, selected.id)).toBe(true);
    const updatedLibrary = await listLibraryMaterialTree(database);
    expect(
      updatedLibrary
        .find((material) => material.id === root.id)
        ?.children.map((child) => child.id),
    ).toEqual([selected.id, excludedSibling.id]);
  });

  it("removes a selected subtree when deferral has no destination", async () => {
    const { startDate, endDate } = await getSprintDates(database);
    const now = await getInstantForCalendarDate(database, startDate);
    const root = await createStandaloneMaterial(
      database,
      `Deferral removal ${crypto.randomUUID()}`,
    );
    const child = await createChildMaterial(
      database,
      root.id,
      `Deferral removal child ${crypto.randomUUID()}`,
    );
    const other = await createStandaloneMaterial(
      database,
      `Deferral retained ${crypto.randomUUID()}`,
    );
    const source = await createSprint(
      database,
      {
        name: `Deferral removal source ${crypto.randomUUID()}`,
        startDate,
        endDate,
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

    await deferSprintMaterialSubtree(
      database,
      {
        sourceSprintId: source.id,
        materialId: root.id,
        expectedMaterialIds: [root.id, child.id],
      },
      { now },
    );

    expect(
      (await listSprintMaterialPlan(database, source.id, { now }))
        .selectedMaterialIds,
    ).toEqual([other.id]);
    expect(await hasSprintMaterialMembership(database, root.id)).toBe(false);
    expect(await hasSprintMaterialMembership(database, child.id)).toBe(false);
  });

  it("rejects deferral from a future Sprint", async () => {
    const now = new Date("2200-01-01T12:00:00.000Z");
    const { startDate, endDate } = await getSprintDates(database);
    const material = await createStandaloneMaterial(
      database,
      `Future deferral ${crypto.randomUUID()}`,
    );
    const source = await createSprint(
      database,
      {
        name: `Future deferral source ${crypto.randomUUID()}`,
        startDate,
        endDate,
        deviceTimeZone: "UTC",
      },
      { now },
    );
    await updateSprintMaterialSelection(
      database,
      source.id,
      [{ type: "select", materialId: material.id }],
      { now },
    );

    await expect(
      deferSprintMaterialSubtree(
        database,
        {
          sourceSprintId: source.id,
          materialId: material.id,
          expectedMaterialIds: [material.id],
        },
        { now },
      ),
    ).rejects.toBeInstanceOf(SprintMaterialNotCurrentError);
    expect(await hasSprintMaterialMembership(database, material.id)).toBe(true);
  });

  it("rejects stale deferral confirmation without changing membership", async () => {
    const { startDate, endDate } = await getSprintDates(database);
    const now = await getInstantForCalendarDate(database, startDate);
    const root = await createStandaloneMaterial(
      database,
      `Stale deferral ${crypto.randomUUID()}`,
    );
    const child = await createChildMaterial(
      database,
      root.id,
      `Stale deferral child ${crypto.randomUUID()}`,
    );
    const source = await createSprint(
      database,
      {
        name: `Stale deferral source ${crypto.randomUUID()}`,
        startDate,
        endDate,
        deviceTimeZone: "UTC",
      },
      { now },
    );
    const destination = await createSprint(
      database,
      {
        name: `Stale deferral destination ${crypto.randomUUID()}`,
        startDate: addDays(endDate, 1),
        endDate: addDays(endDate, 7),
        deviceTimeZone: "UTC",
      },
      { now },
    );
    await updateSprintMaterialSelection(
      database,
      source.id,
      [{ type: "select", materialId: root.id }],
      { now },
    );
    const expectedMaterialIds = (
      await listSprintMaterialPlan(database, source.id, { now })
    ).selectedMaterialIds;
    const addedChild = await createChildMaterial(
      database,
      root.id,
      `Stale deferral newly added ${crypto.randomUUID()}`,
    );
    await updateSprintMaterialSelection(
      database,
      source.id,
      [{ type: "select", materialId: addedChild.id }],
      { now },
    );

    await expect(
      deferSprintMaterialSubtree(
        database,
        {
          sourceSprintId: source.id,
          materialId: root.id,
          expectedMaterialIds,
          destinationSprintId: destination.id,
        },
        { now },
      ),
    ).rejects.toBeInstanceOf(SprintMaterialSelectionConflictError);
    expect(
      (await listSprintMaterialPlan(database, source.id, { now }))
        .selectedMaterialIds,
    ).toEqual(expect.arrayContaining([root.id, child.id, addedChild.id]));
    expect(
      (await listSprintMaterialPlan(database, destination.id, { now }))
        .selectedMaterialIds,
    ).toEqual([]);
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

async function getInstantForCalendarDate(
  database: NodePgDatabase<typeof schema>,
  date: string,
): Promise<Date> {
  const { timeZone } = await listSprints(database);
  if (!timeZone) throw new Error("The test application timezone is missing.");
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!, 12);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Map(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(instant))
        .map(({ type, value }) => [type, value]),
    );
    const localAsUtc = Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day")),
      Number(parts.get("hour")),
      Number(parts.get("minute")),
      Number(parts.get("second")),
    );
    const difference = target - localAsUtc;
    instant += difference;
    if (difference === 0) break;
  }
  return new Date(instant);
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
