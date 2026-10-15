import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { applicationSettings, sprints, type Sprint } from "./schema.js";

type Database = NodePgDatabase<typeof schema>;
type SprintStatus = "future" | "current" | "past";

export type SprintWithStatus = Sprint & { status: SprintStatus };
export type SprintList = {
  timeZone: string | null;
  sprints: SprintWithStatus[];
};

export type CreateSprintInput = {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  deviceTimeZone: string;
};

export type SprintOperationOptions = {
  now?: Date;
};

export class InvalidSprintNameError extends Error {
  constructor() {
    super("Enter a name for this Sprint.");
    this.name = "InvalidSprintNameError";
  }
}

export class InvalidSprintDateError extends Error {
  constructor() {
    super(
      "Enter valid Sprint start and end dates, with the end on or after the start.",
    );
    this.name = "InvalidSprintDateError";
  }
}

export class SprintStartDateInPastError extends Error {
  constructor() {
    super("A new Sprint must start today or in the future.");
    this.name = "SprintStartDateInPastError";
  }
}

export class InvalidApplicationTimeZoneError extends Error {
  constructor() {
    super(
      "The application timezone is invalid. Choose a valid device timezone and try again.",
    );
    this.name = "InvalidApplicationTimeZoneError";
  }
}

export class SprintDateOverlapError extends Error {
  constructor() {
    super("These dates overlap another Sprint. Choose a different date range.");
    this.name = "SprintDateOverlapError";
  }
}

export class MissingApplicationTimeZoneError extends Error {
  constructor() {
    super(
      "Saved Sprints have no application timezone. Reload and contact support.",
    );
    this.name = "MissingApplicationTimeZoneError";
  }
}

export async function createSprint(
  database: Database,
  input: CreateSprintInput,
  options: SprintOperationOptions = {},
): Promise<Sprint> {
  const name = input.name.trim();
  if (!name) throw new InvalidSprintNameError();

  const startDate = parseCalendarDate(input.startDate);
  const endDate = parseCalendarDate(input.endDate);
  if (startDate === null || endDate === null || endDate < startDate) {
    throw new InvalidSprintDateError();
  }

  const goal = input.goal?.trim() || null;
  const now = options.now ?? new Date();

  return database.transaction(async (transaction) => {
    let [settings] = await transaction
      .select({ timeZone: applicationSettings.timeZone })
      .from(applicationSettings)
      .where(eq(applicationSettings.id, 1))
      .limit(1);
    if (!settings) {
      getCalendarDateInTimeZone(now, input.deviceTimeZone);
      await transaction
        .insert(applicationSettings)
        .values({ id: 1, timeZone: input.deviceTimeZone })
        .onConflictDoNothing({ target: applicationSettings.id });
      [settings] = await transaction
        .select({ timeZone: applicationSettings.timeZone })
        .from(applicationSettings)
        .where(eq(applicationSettings.id, 1))
        .limit(1);
    }
    if (!settings) throw new MissingApplicationTimeZoneError();

    const today = getCalendarDateInTimeZone(now, settings.timeZone);
    if (startDate < today) throw new SprintStartDateInPastError();

    try {
      const [created] = await transaction
        .insert(sprints)
        .values({ name, goal, startDate, endDate })
        .returning();
      if (!created) throw new Error("Sprint creation returned no saved row.");
      return created;
    } catch (error) {
      if (isExclusionViolation(error)) throw new SprintDateOverlapError();
      throw error;
    }
  });
}

export async function listSprints(
  database: Database,
  options: SprintOperationOptions = {},
): Promise<SprintList> {
  return database.transaction(
    async (transaction) => {
      const [settingsRows, sprintRows] = await Promise.all([
        transaction
          .select({ timeZone: applicationSettings.timeZone })
          .from(applicationSettings)
          .where(eq(applicationSettings.id, 1))
          .limit(1),
        transaction
          .select()
          .from(sprints)
          .orderBy(asc(sprints.startDate), asc(sprints.createdAt)),
      ]);
      const timeZone = settingsRows[0]?.timeZone ?? null;
      if (sprintRows.length > 0 && timeZone === null) {
        throw new MissingApplicationTimeZoneError();
      }
      if (timeZone === null) return { timeZone, sprints: [] };

      const today = getCalendarDateInTimeZone(
        options.now ?? new Date(),
        timeZone,
      );
      return {
        timeZone,
        sprints: sprintRows.map((sprint) => ({
          ...sprint,
          status: getSprintStatus(sprint, today),
        })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

function parseCalendarDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    year < 1
  )
    return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function getCalendarDateInTimeZone(now: Date, timeZone: string): string {
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("Invalid current date.");
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    throw new InvalidApplicationTimeZoneError();
  }
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  if (!year || !month || !day) {
    throw new InvalidApplicationTimeZoneError();
  }
  return `${year.padStart(4, "0")}-${month}-${day}`;
}

function getSprintStatus(
  sprint: Pick<Sprint, "startDate" | "endDate">,
  today: string,
): SprintStatus {
  if (today < sprint.startDate) return "future";
  if (today > sprint.endDate) return "past";
  return "current";
}

function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23P01") return true;
  return "cause" in error && isExclusionViolation(error.cause);
}
