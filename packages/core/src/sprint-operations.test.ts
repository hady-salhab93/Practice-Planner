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
