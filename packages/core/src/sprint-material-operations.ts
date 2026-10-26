import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  selectSprintMaterialTree,
  type SprintMaterialNode,
} from "./sprint-material-selection.js";
export type { SprintMaterialNode } from "./sprint-material-selection.js";
import * as schema from "./schema.js";
import {
  applicationSettings,
  materials,
  sprintMaterials,
  sprints,
  type Material,
  type Sprint,
} from "./schema.js";
import {
  getCalendarDateInTimeZone,
  getSprintStatus,
  MissingApplicationTimeZoneError,
  SprintNotFoundError,
  type SprintOperationOptions,
  type SprintStatus,
  type SprintWithStatus,
} from "./sprint-operations.js";

type Database = NodePgDatabase<typeof schema>;

export type SprintMaterialChange =
  | { type: "select"; materialId: string }
  | { type: "remove"; materialId: string };

export type SprintMaterialPlan = {
  sprint: Sprint & { status: SprintStatus };
  availableMaterials: SprintMaterialNode[];
  selectedMaterials: SprintMaterialNode[];
  selectedMaterialIds: string[];
};

export type SprintMaterialSummary = {
  selectedMaterials: SprintMaterialNode[];
  selectedMaterialIds: string[];
};

export type SprintMaterialCollection = {
  timeZone: string | null;
  sprints: SprintWithStatus[];
  materialTree: SprintMaterialNode[];
  availableMaterials: SprintMaterialNode[];
  plans: Record<string, SprintMaterialSummary>;
};

export class SprintMaterialLockedError extends Error {
  constructor() {
    super("Material membership of a past Sprint is locked.");
    this.name = "SprintMaterialLockedError";
  }
}

export class ArchivedSprintMaterialError extends Error {
  constructor() {
    super(
      "Restore the owning standalone Material before selecting it for a Sprint.",
    );
    this.name = "ArchivedSprintMaterialError";
  }
}

export class SprintMaterialNotFoundError extends Error {
  constructor() {
    super("This Material could not be found. Reload and try again.");
    this.name = "SprintMaterialNotFoundError";
  }
}

export class SprintMaterialNotSelectedError extends Error {
  constructor() {
    super("This Material is no longer selected in the source Sprint.");
    this.name = "SprintMaterialNotSelectedError";
  }
}

export class SprintMaterialSelectionConflictError extends Error {
  constructor() {
    super(
      "The selected Material changed while confirmation was open. Refresh the selection and confirm again.",
    );
    this.name = "SprintMaterialSelectionConflictError";
  }
}

export class SprintMaterialNotCurrentError extends Error {
  constructor() {
    super("Only a current Sprint can defer selected Material.");
    this.name = "SprintMaterialNotCurrentError";
  }
}

export class SprintMaterialDestinationNotFutureError extends Error {
  constructor() {
    super("Choose an existing future Sprint as the destination.");
    this.name = "SprintMaterialDestinationNotFutureError";
  }
}

export async function listSprintMaterialCollection(
  database: Database,
  options: SprintOperationOptions = {},
): Promise<SprintMaterialCollection> {
  return database.transaction(
    async (transaction) => {
      const [settingsRows, sprintRows, rows, memberships] = await Promise.all([
        transaction
          .select({ timeZone: applicationSettings.timeZone })
          .from(applicationSettings)
          .where(eq(applicationSettings.id, 1))
          .limit(1),
        transaction
          .select()
          .from(sprints)
          .orderBy(asc(sprints.startDate), asc(sprints.createdAt)),
        transaction
          .select()
          .from(materials)
          .orderBy(asc(materials.position), asc(materials.id)),
        transaction.select().from(sprintMaterials),
      ]);
      const timeZone = settingsRows[0]?.timeZone ?? null;
      if (sprintRows.length > 0 && timeZone === null) {
        throw new MissingApplicationTimeZoneError();
      }
      const today =
        timeZone === null
          ? null
          : getCalendarDateInTimeZone(options.now ?? new Date(), timeZone);
      const sprintList = sprintRows.map((sprint) => ({
        ...sprint,
        status:
          today === null ? ("future" as const) : getSprintStatus(sprint, today),
      }));
      const selectedIdsBySprint = new Map<string, Set<string>>();
      for (const membership of memberships) {
        const ids =
          selectedIdsBySprint.get(membership.sprintId) ?? new Set<string>();
        ids.add(membership.materialId);
        selectedIdsBySprint.set(membership.sprintId, ids);
      }
      const materialTree = buildMaterialTree(rows, new Set());
      const plans: Record<string, SprintMaterialSummary> = {};
      for (const sprint of sprintList) {
        const selectedIds =
          selectedIdsBySprint.get(sprint.id) ?? new Set<string>();
        const selectedTree = buildMaterialTree(rows, selectedIds);
        plans[sprint.id] = {
          selectedMaterials: selectSprintMaterialTree(
            selectedTree,
            selectedIds,
          ),
          selectedMaterialIds: [...selectedIds],
        };
      }

      return {
        timeZone,
        sprints: sprintList,
        materialTree,
        availableMaterials: materialTree.filter(
          (material) =>
            material.parentId === null && material.archivedAt === null,
        ),
        plans,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function listSprintMaterialPlan(
  database: Database,
  sprintId: string,
  options: SprintOperationOptions = {},
): Promise<SprintMaterialPlan> {
  return database.transaction(
    async (transaction) => {
      const [sprint] = await transaction
        .select()
        .from(sprints)
        .where(eq(sprints.id, sprintId))
        .limit(1);
      if (!sprint) throw new SprintNotFoundError();

      const [settings] = await transaction
        .select({ timeZone: applicationSettings.timeZone })
        .from(applicationSettings)
        .where(eq(applicationSettings.id, 1))
        .limit(1);
      if (!settings) throw new MissingApplicationTimeZoneError();

      const [rows, memberships] = await Promise.all([
        transaction
          .select()
          .from(materials)
          .orderBy(asc(materials.position), asc(materials.id)),
        transaction
          .select({ materialId: sprintMaterials.materialId })
          .from(sprintMaterials)
          .where(eq(sprintMaterials.sprintId, sprintId)),
      ]);
      const selectedIds = new Set(
        memberships.map(({ materialId }) => materialId),
      );
      const tree = buildMaterialTree(rows, selectedIds);
      const availableMaterials = tree.filter(
        (material) =>
          material.parentId === null && material.archivedAt === null,
      );
      const selectedMaterials = selectSprintMaterialTree(tree, selectedIds);
      const now = options.now ?? new Date();
      const today = getCalendarDateInTimeZone(now, settings.timeZone);

      return {
        sprint: { ...sprint, status: getSprintStatus(sprint, today) },
        availableMaterials,
        selectedMaterials,
        selectedMaterialIds: [...selectedIds],
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function updateSprintMaterialSelection(
  database: Database,
  sprintId: string,
  changes: SprintMaterialChange[],
  options: SprintOperationOptions = {},
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(1886218352, 0)`);
    const [sprint] = await transaction
      .select()
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .for("update");
    if (!sprint) throw new SprintNotFoundError();

    const [settings] = await transaction
      .select({ timeZone: applicationSettings.timeZone })
      .from(applicationSettings)
      .where(eq(applicationSettings.id, 1))
      .limit(1);
    if (!settings) throw new MissingApplicationTimeZoneError();

    const today = getCalendarDateInTimeZone(
      options.now ?? new Date(),
      settings.timeZone,
    );
    if (getSprintStatus(sprint, today) === "past") {
      throw new SprintMaterialLockedError();
    }

    const [rows, memberships] = await Promise.all([
      transaction.select().from(materials),
      transaction
        .select({ materialId: sprintMaterials.materialId })
        .from(sprintMaterials)
        .where(eq(sprintMaterials.sprintId, sprintId)),
    ]);
    const materialById = new Map(
      rows.map((material) => [material.id, material]),
    );
    const childrenByParent = new Map<string, Material[]>();
    for (const material of rows) {
      if (material.parentId === null) continue;
      const children = childrenByParent.get(material.parentId) ?? [];
      children.push(material);
      childrenByParent.set(material.parentId, children);
    }

    const selectedIds = new Set(
      memberships.map(({ materialId }) => materialId),
    );
    for (const change of changes) {
      const material = materialById.get(change.materialId);
      if (!material) throw new SprintMaterialNotFoundError();
      if (change.type === "select") {
        if (getOwningRoot(material, materialById).archivedAt !== null) {
          throw new ArchivedSprintMaterialError();
        }
        visitSubtree(material, childrenByParent, (descendant) =>
          selectedIds.add(descendant.id),
        );
      } else {
        visitSubtree(material, childrenByParent, (descendant) =>
          selectedIds.delete(descendant.id),
        );
      }
    }

    const currentIds = new Set(memberships.map(({ materialId }) => materialId));
    const removedIds = [...currentIds].filter((id) => !selectedIds.has(id));
    const addedIds = [...selectedIds].filter((id) => !currentIds.has(id));

    if (removedIds.length > 0) {
      await transaction
        .delete(sprintMaterials)
        .where(
          and(
            eq(sprintMaterials.sprintId, sprintId),
            inArray(sprintMaterials.materialId, removedIds),
          ),
        );
    }
    if (addedIds.length > 0) {
      await transaction.insert(sprintMaterials).values(
        addedIds.map((materialId) => ({
          sprintId,
          materialId,
        })),
      );
    }
  });
}

export type DeferSprintMaterialInput = {
  sourceSprintId: string;
  materialId: string;
  expectedMaterialIds: string[];
  destinationSprintId?: string | null;
};

export async function deferSprintMaterialSubtree(
  database: Database,
  input: DeferSprintMaterialInput,
  options: SprintOperationOptions = {},
): Promise<number> {
  if (
    new Set(input.expectedMaterialIds).size !== input.expectedMaterialIds.length
  ) {
    throw new SprintMaterialSelectionConflictError();
  }
  if (input.destinationSprintId === input.sourceSprintId) {
    throw new SprintMaterialDestinationNotFutureError();
  }

  return database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(1886218352, 0)`);
    const sprintIds = [
      input.sourceSprintId,
      ...(input.destinationSprintId ? [input.destinationSprintId] : []),
    ].sort();
    const sprintRows = await transaction
      .select()
      .from(sprints)
      .where(inArray(sprints.id, sprintIds))
      .orderBy(asc(sprints.id))
      .for("update");
    const sprintById = new Map(sprintRows.map((sprint) => [sprint.id, sprint]));
    const source = sprintById.get(input.sourceSprintId);
    if (!source) throw new SprintNotFoundError();
    const destination = input.destinationSprintId
      ? sprintById.get(input.destinationSprintId)
      : undefined;
    if (input.destinationSprintId && !destination) {
      throw new SprintNotFoundError();
    }

    const [settings] = await transaction
      .select({ timeZone: applicationSettings.timeZone })
      .from(applicationSettings)
      .where(eq(applicationSettings.id, 1))
      .limit(1);
    if (!settings) throw new MissingApplicationTimeZoneError();

    const today = getCalendarDateInTimeZone(
      options.now ?? new Date(),
      settings.timeZone,
    );
    const sourceStatus = getSprintStatus(source, today);
    if (sourceStatus === "past") throw new SprintMaterialLockedError();
    if (sourceStatus !== "current") throw new SprintMaterialNotCurrentError();
    if (destination && getSprintStatus(destination, today) !== "future") {
      throw new SprintMaterialDestinationNotFutureError();
    }

    const [rows, memberships] = await Promise.all([
      transaction.select().from(materials),
      transaction
        .select({ materialId: sprintMaterials.materialId })
        .from(sprintMaterials)
        .where(eq(sprintMaterials.sprintId, input.sourceSprintId)),
    ]);
    const materialById = new Map(
      rows.map((material) => [material.id, material]),
    );
    const material = materialById.get(input.materialId);
    if (!material) throw new SprintMaterialNotFoundError();

    const childrenByParent = new Map<string, Material[]>();
    for (const row of rows) {
      if (row.parentId === null) continue;
      const children = childrenByParent.get(row.parentId) ?? [];
      children.push(row);
      childrenByParent.set(row.parentId, children);
    }
    const subtreeIds = new Set<string>();
    visitSubtree(material, childrenByParent, (descendant) =>
      subtreeIds.add(descendant.id),
    );
    const currentMaterialIds = memberships
      .map(({ materialId }) => materialId)
      .filter((id) => subtreeIds.has(id));
    const currentMaterialSet = new Set(currentMaterialIds);
    const expectedMaterialSet = new Set(input.expectedMaterialIds);
    if (!currentMaterialSet.has(input.materialId)) {
      throw new SprintMaterialNotSelectedError();
    }
    if (
      currentMaterialSet.size !== expectedMaterialSet.size ||
      [...currentMaterialSet].some((id) => !expectedMaterialSet.has(id))
    ) {
      throw new SprintMaterialSelectionConflictError();
    }

    if (destination) {
      await transaction
        .insert(sprintMaterials)
        .values(
          currentMaterialIds.map((materialId) => ({
            sprintId: destination.id,
            materialId,
          })),
        )
        .onConflictDoNothing();
    }
    await transaction
      .delete(sprintMaterials)
      .where(
        and(
          eq(sprintMaterials.sprintId, source.id),
          inArray(sprintMaterials.materialId, currentMaterialIds),
        ),
      );
    return currentMaterialIds.length;
  });
}

export async function hasSprintMaterialMembership(
  database: Database,
  materialId: string,
): Promise<boolean> {
  const [membership] = await database
    .select({ materialId: sprintMaterials.materialId })
    .from(sprintMaterials)
    .where(eq(sprintMaterials.materialId, materialId))
    .limit(1);
  return membership !== undefined;
}

function buildMaterialTree(
  rows: Material[],
  selectedIds: Set<string>,
): SprintMaterialNode[] {
  const nodes = new Map<string, SprintMaterialNode>();
  for (const material of rows) {
    nodes.set(material.id, {
      ...material,
      isSelected: selectedIds.has(material.id),
      children: [],
    });
  }

  const roots: SprintMaterialNode[] = [];
  for (const material of rows) {
    const node = nodes.get(material.id);
    if (!node) continue;
    if (material.parentId === null) {
      roots.push(node);
      continue;
    }
    nodes.get(material.parentId)?.children.push(node);
  }
  return roots;
}

function getOwningRoot(
  material: Material,
  materialById: Map<string, Material>,
): Material {
  let root = material;
  while (root.parentId !== null) {
    const parent = materialById.get(root.parentId);
    if (!parent) throw new SprintMaterialNotFoundError();
    root = parent;
  }
  return root;
}

function visitSubtree(
  material: Material,
  childrenByParent: Map<string, Material[]>,
  visit: (material: Material) => void,
): void {
  visit(material);
  for (const child of childrenByParent.get(material.id) ?? []) {
    visitSubtree(child, childrenByParent, visit);
  }
}
