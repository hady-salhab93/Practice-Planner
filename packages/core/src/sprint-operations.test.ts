import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSprint,
  listSprints,
  SprintDateOverlapError,
  updateSprint,
} from "./sprint-operations.js";
import * as schema from "./schema.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

describe("Sprint operations", () => {
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

  it("persists calendar dates and pins the first saved application timezone", async () => {
    const now = new Date("2090-01-01T12:00:00.000Z");
    const startDate = getFutureDate();
    const endDate = addDays(startDate, 2);
    const name = `  Practice focus ${crypto.randomUUID()}  `;
    const existingSettings = await listSprints(database, { now });
    const expectedTimeZone = existingSettings.timeZone ?? "Pacific/Auckland";

    const created = await createSprint(
      database,
      {
        name,
        goal: "  Keep the changes relaxed  ",
        startDate,
        endDate,
        deviceTimeZone: "Pacific/Auckland",
      },
      { now },
    );
    await createSprint(
      database,
      {
        name: name.trim(),
        startDate: addDays(endDate, 2),
        endDate: addDays(endDate, 2),
        deviceTimeZone: "UTC",
      },
      { now },
    );
    const browsed = await listSprints(database, { now });

    expect(created.name).toBe(name.trim());
    expect(created.goal).toBe("Keep the changes relaxed");
    expect(browsed.timeZone).toBe(expectedTimeZone);
    expect(
      browsed.sprints.filter((sprint) => sprint.name === created.name),
    ).toHaveLength(2);
    expect(browsed.sprints).toContainEqual({
      ...created,
      status: "future",
    });
  });

  it("allows adjacent ranges and rejects inclusive and concurrent overlaps", async () => {
    const now = new Date("2090-01-01T12:00:00.000Z");
    const startDate = getFutureDate();
    const firstEndDate = addDays(startDate, 1);

    await createSprintForDates(database, startDate, firstEndDate, now);
    await createSprintForDates(
      database,
      addDays(firstEndDate, 1),
      addDays(firstEndDate, 2),
      now,
    );

    await expect(
      createSprintForDates(
        database,
        firstEndDate,
        addDays(firstEndDate, 2),
        now,
      ),
    ).rejects.toBeInstanceOf(SprintDateOverlapError);

    const concurrentStart = addDays(firstEndDate, 10);
    const attempts = await Promise.allSettled([
      createSprintForDates(database, concurrentStart, concurrentStart, now),
      createSprintForDates(database, concurrentStart, concurrentStart, now),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.find((attempt) => attempt.status === "rejected"),
    ).toMatchObject({
      status: "rejected",
      reason: expect.any(SprintDateOverlapError),
    });
  });

  it("rejects invalid and backdated dates and derives lifecycle in the saved timezone", async () => {
    const savedTimeZone = (await listSprints(database)).timeZone;
    if (savedTimeZone === null) throw new Error("Expected a saved timezone.");

    const now = new Date("2031-03-14T23:30:00.000Z");
    const today = getLocalDate(now, savedTimeZone);
    const yesterday = addDays(today, -1);
    const sprintInput = {
      name: `Date validation ${crypto.randomUUID()}`,
      startDate: today,
      endDate: today,
      deviceTimeZone: "Invalid/Device-Timezone",
    };

    await expect(
      createSprint(database, { ...sprintInput, startDate: yesterday }, { now }),
    ).rejects.toMatchObject({ name: "SprintStartDateInPastError" });
    await expect(
      createSprint(database, { ...sprintInput, name: " \t " }, { now }),
    ).rejects.toMatchObject({ name: "InvalidSprintNameError" });
    await expect(
      createSprint(
        database,
        { ...sprintInput, startDate: "2031-02-30" },
        { now },
      ),
    ).rejects.toMatchObject({ name: "InvalidSprintDateError" });
    await expect(
      createSprint(
        database,
        { ...sprintInput, startDate: addDays(today, 1), endDate: today },
        { now },
      ),
    ).rejects.toMatchObject({ name: "InvalidSprintDateError" });

    const targetDate = getFutureDate();
    const statusInstant = getInstantForLocalDate(targetDate, savedTimeZone);
    const statusToday = getLocalDate(statusInstant, savedTimeZone);
    const creationInstant = getInstantForLocalDate(
      addDays(statusToday, -20),
      savedTimeZone,
    );
    const past = await createSprintForDates(
      database,
      addDays(statusToday, -3),
      addDays(statusToday, -2),
      creationInstant,
    );
    const current = await createSprintForDates(
      database,
      addDays(statusToday, -1),
      addDays(statusToday, 1),
      creationInstant,
    );
    const future = await createSprintForDates(
      database,
      addDays(statusToday, 3),
      addDays(statusToday, 4),
      creationInstant,
    );
    const statuses = await listSprints(database, { now: statusInstant });
    const statusById = new Map(
      statuses.sprints.map((sprint) => [sprint.id, sprint.status]),
    );

    expect(statusById.get(past.id)).toBe("past");
    expect(statusById.get(current.id)).toBe("current");
    expect(statusById.get(future.id)).toBe("future");
    for (const endpoint of [
      addDays(statusToday, -1),
      addDays(statusToday, 1),
    ]) {
      const endpointStatuses = await listSprints(database, {
        now: getInstantForLocalDate(endpoint, savedTimeZone),
      });
      expect(
        endpointStatuses.sprints.find((sprint) => sprint.id === current.id)
          ?.status,
      ).toBe("current");
    }

    const gapInstant = getInstantForLocalDate(
      addDays(statusToday, 2),
      savedTimeZone,
    );
    const gapStatuses = await listSprints(database, { now: gapInstant });
    expect(
      gapStatuses.sprints.some((sprint) => sprint.status === "current"),
    ).toBe(false);
  });

  it("edits a future Sprint's name, goal, and dates and keeps them after reload", async () => {
    const now = new Date("2090-01-01T12:00:00.000Z");
    const startDate = getFutureDate();
    const sprint = await createSprintForDates(
      database,
      startDate,
      addDays(startDate, 1),
      now,
    );

    await updateSprint(
      database,
      {
        id: sprint.id,
        name: "  Renamed focus  ",
        goal: "  New goal  ",
        startDate: addDays(startDate, 1),
        endDate: addDays(startDate, 3),
      },
      { now },
    );

    const reloaded = (await listSprints(database, { now })).sprints.find(
      (candidate) => candidate.id === sprint.id,
    );
    expect(reloaded).toMatchObject({
      name: "Renamed focus",
      goal: "New goal",
      startDate: addDays(startDate, 1),
      endDate: addDays(startDate, 3),
      status: "future",
    });
  });
  it("rejects backdating a future Sprint's start and lets today's start make it current", async () => {
    const savedTimeZone = (await listSprints(database)).timeZone!;
    const targetDate = getFutureDate();
    const today = getLocalDate(
      getInstantForLocalDate(targetDate, savedTimeZone),
      savedTimeZone,
    );
    const mutationInstant = getInstantForLocalDate(today, savedTimeZone);
    const creationInstant = getInstantForLocalDate(
      addDays(today, -20),
      savedTimeZone,
    );
    const sprint = await createSprintForDates(
      database,
      addDays(today, 5),
      addDays(today, 6),
      creationInstant,
    );
    const edit = {
      id: sprint.id,
      name: "Edited",
      startDate: today,
      endDate: addDays(today, 6),
    };

    await expect(
      updateSprint(
        database,
        { ...edit, startDate: addDays(today, -1) },
        { now: mutationInstant },
      ),
    ).rejects.toMatchObject({ name: "SprintStartDateInPastError" });
    const unchanged = (
      await listSprints(database, { now: mutationInstant })
    ).sprints.find((candidate) => candidate.id === sprint.id);
    expect(unchanged).toMatchObject({
      name: sprint.name,
      startDate: addDays(today, 5),
      status: "future",
    });

    await updateSprint(database, edit, { now: mutationInstant });
    const started = (
      await listSprints(database, { now: mutationInstant })
    ).sprints.find((candidate) => candidate.id === sprint.id);
    expect(started).toMatchObject({ name: "Edited", status: "current" });
  });

  it("keeps a current Sprint's start fixed and limits its end to today or later without overlap", async () => {
    const { today, now, creationInstant } = await getClock();
    const current = await createSprintForDates(
      database,
      addDays(today, -1),
      addDays(today, 2),
      creationInstant,
    );
    const next = await createSprintForDates(
      database,
      addDays(today, 10),
      addDays(today, 12),
      creationInstant,
    );
    const edit = {
      id: current.id,
      name: "Current renamed",
      startDate: addDays(today, -1),
      endDate: addDays(today, 8),
    };

    await expect(
      updateSprint(
        database,
        { ...edit, startDate: addDays(today, 1) },
        { now },
      ),
    ).rejects.toMatchObject({ name: "SprintStartDateLockedError" });
    await expect(
      updateSprint(database, { ...edit, endDate: addDays(today, -1) }, { now }),
    ).rejects.toMatchObject({ name: "SprintEndDateInPastError" });
    await expect(
      updateSprint(database, { ...edit, endDate: next.startDate }, { now }),
    ).rejects.toBeInstanceOf(SprintDateOverlapError);

    await updateSprint(database, edit, { now });
    await updateSprint(database, { ...edit, endDate: today }, { now });
    const saved = (await listSprints(database, { now })).sprints.find(
      (candidate) => candidate.id === current.id,
    );
    expect(saved).toMatchObject({
      name: "Current renamed",
      startDate: addDays(today, -1),
      endDate: today,
      status: "current",
    });
  });

  it("locks a past Sprint's dates but lets its name and goal be corrected", async () => {
    const { today, now, creationInstant } = await getClock();
    const past = await createSprintForDates(
      database,
      addDays(today, -3),
      addDays(today, -1),
      getInstantForLocalDate(
        addDays(today, -20),
        (await listSprints(database)).timeZone!,
      ),
    );
    void creationInstant;

    await expect(
      updateSprint(
        database,
        {
          id: past.id,
          name: past.name,
          startDate: past.startDate,
          endDate: today,
        },
        { now },
      ),
    ).rejects.toMatchObject({ name: "SprintDatesLockedError" });
    await updateSprint(
      database,
      {
        id: past.id,
        name: "Corrected",
        goal: "Fixed typo",
        startDate: past.startDate,
        endDate: past.endDate,
      },
      { now },
    );
    const saved = (await listSprints(database, { now })).sprints.find(
      (candidate) => candidate.id === past.id,
    );
    expect(saved).toMatchObject({
      name: "Corrected",
      goal: "Fixed typo",
      startDate: past.startDate,
      endDate: past.endDate,
      status: "past",
    });
  });

  it("applies the lock for the status at mutation time, not when the form was opened", async () => {
    const { today, now, creationInstant } = await getClock();
    const sprint = await createSprintForDates(
      database,
      today,
      today,
      creationInstant,
    );
    const nextDay = getInstantForLocalDate(
      addDays(today, 1),
      (await listSprints(database)).timeZone!,
    );

    await expect(
      updateSprint(
        database,
        {
          id: sprint.id,
          name: sprint.name,
          startDate: today,
          endDate: addDays(today, 1),
        },
        { now: nextDay },
      ),
    ).rejects.toMatchObject({ name: "SprintDatesLockedError" });
    await updateSprint(
      database,
      {
        id: sprint.id,
        name: sprint.name,
        startDate: today,
        endDate: addDays(today, 1),
      },
      { now },
    );
  });

  it("rejects an edit made from a stale copy and saves successive edits", async () => {
    const { today, now, creationInstant } = await getClock();
    const sprint = await createSprintForDates(
      database,
      addDays(today, 5),
      addDays(today, 6),
      creationInstant,
    );
    const edit = {
      id: sprint.id,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      expectedVersion: sprint.version,
    };

    const first = await updateSprint(
      database,
      { ...edit, name: "First writer" },
      { now },
    );
    await expect(
      updateSprint(database, { ...edit, name: "Stale writer" }, { now }),
    ).rejects.toMatchObject({ name: "SprintEditConflictError" });
    await updateSprint(
      database,
      { ...edit, name: "Second writer", expectedVersion: first.version },
      { now },
    );

    const saved = (await listSprints(database, { now })).sprints.find(
      (candidate) => candidate.id === sprint.id,
    );
    expect(saved?.name).toBe("Second writer");
  });

  it("lets only one of two concurrent edits into the same dates succeed", async () => {
    const { today, now, creationInstant } = await getClock();
    const a = await createSprintForDates(
      database,
      addDays(today, 5),
      addDays(today, 5),
      creationInstant,
    );
    const b = await createSprintForDates(
      database,
      addDays(today, 8),
      addDays(today, 8),
      creationInstant,
    );
    const moveTo = (sprint: typeof a) =>
      updateSprint(
        database,
        {
          id: sprint.id,
          name: sprint.name,
          startDate: addDays(today, 20),
          endDate: addDays(today, 20),
          expectedVersion: sprint.version,
        },
        { now },
      );

    const attempts = await Promise.allSettled([moveTo(a), moveTo(b)]);

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.find((attempt) => attempt.status === "rejected"),
    ).toMatchObject({ reason: expect.any(SprintDateOverlapError) });
  });

  async function getClock() {
    const savedTimeZone = (await listSprints(database)).timeZone!;
    const today = getLocalDate(
      getInstantForLocalDate(getFutureDate(), savedTimeZone),
      savedTimeZone,
    );
    return {
      today,
      now: getInstantForLocalDate(today, savedTimeZone),
      creationInstant: getInstantForLocalDate(
        addDays(today, -20),
        savedTimeZone,
      ),
    };
  }
});

function createSprintForDates(
  database: NodePgDatabase<typeof schema>,
  startDate: string,
  endDate: string,
  now: Date,
) {
  return createSprint(
    database,
    {
      name: `Sprint ${crypto.randomUUID()}`,
      startDate,
      endDate,
      deviceTimeZone: "UTC",
    },
    { now },
  );
}

function getFutureDate(): string {
  const firstDay = Date.UTC(2100, 0, 1);
  const offset = Math.floor(Math.random() * 36_500);
  return new Date(firstDay + offset * 86_400_000).toISOString().slice(0, 10);
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function getLocalDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get("year")!.padStart(4, "0")}-${values.get("month")}-${values.get("day")}`;
}

function getInstantForLocalDate(date: string, timeZone: string): Date {
  for (const offset of [-1, 0, 1]) {
    const instant = new Date(`${addDays(date, offset)}T12:00:00.000Z`);
    if (getLocalDate(instant, timeZone) === date) return instant;
  }
  throw new Error(`Could not resolve local noon for ${date} in ${timeZone}.`);
}
