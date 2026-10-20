import { useEffect, useId, useRef, useState } from "react";
import {
  Link,
  useBlocker,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "react-router";
import {
  Check,
  ChevronRight,
  ListPlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { selectSprintMaterialTree } from "@practice-planner/core/sprint-material-selection";
import {
  createSprint,
  InvalidApplicationTimeZoneError,
  InvalidSprintDateError,
  InvalidSprintNameError,
  SprintDateOverlapError,
  SprintDatesLockedError,
  SprintEditConflictError,
  SprintEndDateInPastError,
  SprintNotFoundError,
  SprintStartDateInPastError,
  SprintStartDateLockedError,
  listSprints,
  updateSprint,
} from "@practice-planner/core/sprint-operations";
import {
  ArchivedSprintMaterialError,
  listSprintMaterialCollection,
  SprintMaterialLockedError,
  SprintMaterialNotFoundError,
  updateSprintMaterialSelection,
  type SprintMaterialChange,
  type SprintMaterialNode,
  type SprintMaterialSummary,
} from "@practice-planner/core/sprint-material-operations";
import { getDatabase } from "@practice-planner/core/db.server";
import type { Route } from "./+types/sprints";

type SprintDraft = {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
};

type SprintActionData =
  | { ok: true; intent: "create" }
  | { ok: false; intent: "create"; message: string }
  | { ok: true; intent: "update"; id: string }
  | { ok: false; intent: "update"; id: string; message: string }
  | { ok: true; intent: "materials"; id: string }
  | { ok: false; intent: "materials"; id: string; message: string }
  | { ok: false; intent: "invalid"; message: string };

export async function loader() {
  return listSprintMaterialCollection(getDatabase());
}

export async function action({
  request,
}: Route.ActionArgs): Promise<SprintActionData> {
  const formData = await request.formData();
  if (formData.get("intent") === "materials") {
    const id = getFormValue(formData, "id");
    const changes = parseSprintMaterialChanges(
      getFormValue(formData, "changes"),
    );
    if (changes === null) {
      return {
        ok: false,
        intent: "materials",
        id,
        message: "This Material selection is invalid. Reload and try again.",
      };
    }

    try {
      await updateSprintMaterialSelection(getDatabase(), id, changes);
      return { ok: true, intent: "materials", id };
    } catch (error) {
      return {
        ok: false,
        intent: "materials",
        id,
        message: getSprintErrorMessage(error),
      };
    }
  }

  if (formData.get("intent") === "update") {
    const id = getFormValue(formData, "id");
    const version = Number(getFormValue(formData, "version"));
    try {
      await updateSprint(getDatabase(), {
        id,
        name: getFormValue(formData, "name"),
        goal: getFormValue(formData, "goal"),
        startDate: getFormValue(formData, "startDate"),
        endDate: getFormValue(formData, "endDate"),
        expectedVersion: Number.isInteger(version) ? version : -1,
      });
      return { ok: true, intent: "update", id };
    } catch (error) {
      return {
        ok: false,
        intent: "update",
        id,
        message: getSprintErrorMessage(error),
      };
    }
  }
  if (formData.get("intent") !== "create") {
    return {
      ok: false,
      intent: "invalid",
      message: "This Sprint action is not supported.",
    };
  }

  try {
    await createSprint(getDatabase(), {
      name: getFormValue(formData, "name"),
      goal: getFormValue(formData, "goal"),
      startDate: getFormValue(formData, "startDate"),
      endDate: getFormValue(formData, "endDate"),
      deviceTimeZone: getFormValue(formData, "deviceTimeZone"),
    });
    return { ok: true, intent: "create" };
  } catch (error) {
    return {
      ok: false,
      intent: "create",
      message: getSprintErrorMessage(error),
    };
  }
}

export default function Sprints() {
  const { timeZone, sprints, materialTree, availableMaterials, plans } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [deviceTimeZone, setDeviceTimeZone] = useState("");
  const [today, setToday] = useState("");
  const [draft, setDraft] = useState<SprintDraft>({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [rowDirty, setRowDirty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const createPanelRef = useRef<HTMLDialogElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const submitted = useRef(false);
  const isSaving = fetcher.state !== "idle";
  const isDirty =
    draft.name.length > 0 ||
    draft.goal.length > 0 ||
    (draft.startDate !== "" && draft.startDate !== today) ||
    (draft.endDate !== "" && draft.endDate !== today);
  const blocker = useBlocker((isDirty || rowDirty) && !isSaving);
  const schedulingTimeZone = timeZone ?? deviceTimeZone;
  const pastCount = sprints.filter((sprint) => sprint.status === "past").length;
  const visibleSprints = sprints.filter(
    (sprint) => showPast || sprint.status !== "past",
  );
  const scheduledSprints = sprints.filter((sprint) => sprint.status !== "past");
  const requestedSprint = sprints.find(
    (sprint) => sprint.id === searchParams.get("sprint"),
  );
  const selectedSprint =
    searchParams.get("view") === "all"
      ? null
      : (requestedSprint ??
        scheduledSprints.find((sprint) => sprint.status === "current") ??
        scheduledSprints[0] ??
        null);
  const navigationSprints = scheduledSprints.slice(0, 6);

  useEffect(() => {
    const panel = createPanelRef.current;
    if (!panel) return;
    if (isCreating && !panel.open) panel.showModal();
    if (!isCreating && panel.open) {
      panel.close();
      createButtonRef.current?.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const effectiveTimeZone = timeZone ?? browserTimeZone;
    const localToday = getCalendarDate(effectiveTimeZone);
    setDeviceTimeZone(browserTimeZone);
    setToday(localToday);
    setDraft((current) => ({
      ...current,
      startDate: current.startDate || localToday,
      endDate: current.endDate || localToday,
    }));
  }, [timeZone]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Discard your unsaved Sprint changes?"))
      blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!isDirty && !rowDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, rowDirty]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !submitted.current) return;
    submitted.current = false;
    if (fetcher.data?.ok && fetcher.data.intent === "create") {
      setDraft({
        name: "",
        goal: "",
        startDate: today,
        endDate: today,
      });
      setActionError(null);
      setIsCreating(false);
      setSearchParams({ view: "all" });
    } else if (fetcher.data && fetcher.data.intent === "create") {
      setActionError(fetcher.data.message);
    }
  }, [fetcher.data, fetcher.state, today, setSearchParams]);

  function updateDraft(field: keyof SprintDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setActionError(null);
  }

  function cancelDraft() {
    if (isSaving) return;
    if (isDirty && !window.confirm("Discard your unsaved Sprint changes?"))
      return;
    setDraft({ name: "", goal: "", startDate: today, endDate: today });
    setActionError(null);
    setIsCreating(false);
  }

  return (
    <main className="library-page sprint-page">
      <header className="page-header">
        <div>
          <p className="page-context">Practice Planner</p>
          <h1>Sprints</h1>
        </div>
        <button
          ref={createButtonRef}
          className="button button-primary"
          type="button"
          onClick={() => setIsCreating(true)}
        >
          <Plus aria-hidden="true" size={16} />
          New Sprint
        </button>
      </header>

      <dialog
        ref={createPanelRef}
        className="material-panel sprint-panel sprint-create-panel"
        aria-labelledby="create-sprint-heading"
        onCancel={(event) => {
          event.preventDefault();
          cancelDraft();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          cancelDraft();
        }}
      >
        <header className="material-panel-header">
          <h2 id="create-sprint-heading">Create Sprint</h2>
          <button
            className="button button-secondary panel-close"
            type="button"
            aria-label="Close Sprint dialog"
            title="Close"
            disabled={isSaving}
            onClick={cancelDraft}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        <div className="sprint-panel-content">
          <p className="sprint-timezone">
            Scheduling timezone:{" "}
            <strong>{schedulingTimeZone || "Detecting device timezone"}</strong>
          </p>
          <fetcher.Form
            className="sprint-form"
            method="post"
            onSubmit={(event) => {
              if (submitted.current) {
                event.preventDefault();
                return;
              }
              submitted.current = true;
              setActionError(null);
            }}
          >
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="deviceTimeZone" value={deviceTimeZone} />
            <label htmlFor="sprint-name">Name</label>
            <input
              id="sprint-name"
              name="name"
              value={draft.name}
              required
              disabled={isSaving}
              onChange={(event) => updateDraft("name", event.target.value)}
            />
            <label htmlFor="sprint-goal">Goal (optional)</label>
            <textarea
              id="sprint-goal"
              name="goal"
              value={draft.goal}
              rows={3}
              disabled={isSaving}
              onChange={(event) => updateDraft("goal", event.target.value)}
            />
            <div className="sprint-date-fields">
              <div>
                <label htmlFor="sprint-start-date">Start date</label>
                <input
                  id="sprint-start-date"
                  name="startDate"
                  type="date"
                  value={draft.startDate}
                  min={today}
                  required
                  disabled={isSaving || !today}
                  onChange={(event) =>
                    updateDraft("startDate", event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="sprint-end-date">End date</label>
                <input
                  id="sprint-end-date"
                  name="endDate"
                  type="date"
                  value={draft.endDate}
                  min={draft.startDate || today}
                  required
                  disabled={isSaving || !today}
                  onChange={(event) =>
                    updateDraft("endDate", event.target.value)
                  }
                />
              </div>
            </div>
            {actionError && (
              <p className="form-error" role="alert">
                {actionError}
              </p>
            )}
            <div className="sprint-form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={isSaving || !deviceTimeZone}
              >
                {isSaving ? "Saving..." : "Save Sprint"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={isSaving}
                onClick={cancelDraft}
              >
                Cancel
              </button>
            </div>
          </fetcher.Form>
        </div>
      </dialog>

      <div className="sprint-workspace">
        <nav className="sprint-navigation" aria-label="Sprint navigation">
          <p className="sprint-navigation-label">Current &amp; Upcoming</p>
          {navigationSprints.map((sprint) => (
            <Link
              key={sprint.id}
              to={`?sprint=${sprint.id}`}
              className="sprint-navigation-link"
              aria-current={
                selectedSprint?.id === sprint.id ? "page" : undefined
              }
            >
              <span className="sprint-navigation-name">{sprint.name}</span>
              <span className="sprint-navigation-date">
                {sprint.startDate} <span aria-hidden="true">·</span>{" "}
                {sprint.status}
              </span>
            </Link>
          ))}
          {scheduledSprints.length === 0 && (
            <p className="sprint-empty-state">No current or future Sprints.</p>
          )}
          <Link
            to="?view=all"
            className="sprint-navigation-link sprint-all-link"
            aria-current={!selectedSprint ? "page" : undefined}
          >
            All Sprints <span className="material-count">{sprints.length}</span>
          </Link>
        </nav>
        <div className="sprint-mobile-picker">
          <label htmlFor="sprint-picker">Sprint</label>
          <select
            id="sprint-picker"
            value={selectedSprint?.id ?? "all"}
            onChange={(event) =>
              setSearchParams(
                event.target.value === "all"
                  ? { view: "all" }
                  : { sprint: event.target.value },
              )
            }
          >
            <option value="all">All Sprints</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} — {sprint.status}
              </option>
            ))}
          </select>
        </div>
        <section
          className="sprint-detail"
          aria-label={selectedSprint ? "Selected Sprint" : "All Sprints"}
        >
          {selectedSprint ? (
            <ol className="sprint-list sprint-selected-list">
              <SprintRow
                key={selectedSprint.id}
                sprint={selectedSprint}
                today={today}
                materialTree={materialTree}
                availableMaterials={availableMaterials}
                materialSummary={
                  plans[selectedSprint.id] ?? EMPTY_MATERIAL_SUMMARY
                }
                isEditing={editingId === selectedSprint.id}
                isManagingMaterials={managingId === selectedSprint.id}
                canEdit={editingId === null && managingId === null}
                canManageMaterials={editingId === null && managingId === null}
                onEdit={() => setEditingId(selectedSprint.id)}
                onManageMaterials={() => setManagingId(selectedSprint.id)}
                onClose={() => {
                  setEditingId(null);
                  setManagingId(null);
                  setRowDirty(false);
                }}
                onDirtyChange={setRowDirty}
              />
            </ol>
          ) : (
            <>
              <div className="section-heading">
                <h2 id="sprint-list-heading">All Sprints</h2>
                <p className="material-count" aria-live="polite">
                  {visibleSprints.length}{" "}
                  {visibleSprints.length === 1 ? "Sprint" : "Sprints"}
                </p>
                {pastCount > 0 && (
                  <button
                    className="button button-secondary"
                    type="button"
                    aria-pressed={showPast}
                    disabled={editingId !== null || managingId !== null}
                    onClick={() => setShowPast((current) => !current)}
                  >
                    {showPast
                      ? "Hide past Sprints"
                      : `Show past Sprints (${pastCount})`}
                  </button>
                )}
              </div>
              {visibleSprints.length === 0 ? (
                <p className="sprint-empty-state">
                  {sprints.length === 0
                    ? "No Sprints yet."
                    : "No current or future Sprints."}
                </p>
              ) : (
                <ol className="sprint-list">
                  {visibleSprints.map((sprint) => (
                    <li key={sprint.id}>
                      <Link
                        className="sprint-overview-row"
                        to={`?sprint=${sprint.id}`}
                      >
                        <span className="sprint-overview-name">
                          {sprint.name}
                        </span>
                        <span className="sprint-dates">
                          {sprint.startDate} – {sprint.endDate}
                        </span>
                        <span
                          className={`sprint-status sprint-status-${sprint.status}`}
                        >
                          {sprint.status}
                        </span>
                        <ChevronRight aria-hidden="true" size={16} />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

type SprintRowProps = {
  sprint: SerializedSprint;
  today: string;
  materialTree: SprintMaterialNode[];
  availableMaterials: SprintMaterialNode[];
  materialSummary: SprintMaterialSummary;
  isEditing: boolean;
  isManagingMaterials: boolean;
  canEdit: boolean;
  canManageMaterials: boolean;
  onEdit: () => void;
  onManageMaterials: () => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

type SerializedSprint = Awaited<
  ReturnType<typeof listSprints>
>["sprints"][number];

const EMPTY_MATERIAL_SUMMARY: SprintMaterialSummary = {
  selectedMaterials: [],
  selectedMaterialIds: [],
};

function SprintRow({
  sprint,
  today,
  materialTree,
  availableMaterials,
  materialSummary,
  isEditing,
  isManagingMaterials,
  canEdit,
  canManageMaterials,
  onEdit,
  onManageMaterials,
  onClose,
  onDirtyChange,
}: SprintRowProps) {
  const fetcher = useFetcher<typeof action>();
  const materialFetcher = useFetcher<typeof action>();
  const [draft, setDraft] = useState<SprintDraft>(() => toDraft(sprint));
  const [error, setError] = useState<string | null>(null);
  const [materialDraftIds, setMaterialDraftIds] = useState(
    () => new Set(materialSummary.selectedMaterialIds),
  );
  const [materialChanges, setMaterialChanges] = useState<
    SprintMaterialChange[]
  >([]);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const submitted = useRef(false);
  const materialSubmitted = useRef(false);
  const panelRef = useRef<HTMLDialogElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const materialButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const isSaving = fetcher.state !== "idle";
  const isSavingMaterials = materialFetcher.state !== "idle";
  const isDirty =
    isEditing &&
    (draft.name !== sprint.name ||
      draft.goal !== (sprint.goal ?? "") ||
      draft.startDate !== sprint.startDate ||
      draft.endDate !== sprint.endDate);
  const materialIsDirty = !sameIds(
    materialDraftIds,
    new Set(materialSummary.selectedMaterialIds),
  );
  const datesLocked = sprint.status === "past";
  const startLocked = sprint.status !== "future";
  const minStart = today;
  const minEnd = sprint.status === "current" ? today : draft.startDate || today;

  useEffect(() => {
    if (isEditing || isManagingMaterials) {
      onDirtyChange(isDirty || (materialIsDirty && isManagingMaterials));
    }
  }, [isEditing, isDirty, isManagingMaterials, materialIsDirty, onDirtyChange]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if ((isEditing || isManagingMaterials) && !panel.open) panel.showModal();
    if (!isEditing && !isManagingMaterials && panel.open) {
      panel.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [isEditing, isManagingMaterials]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !submitted.current) return;
    submitted.current = false;
    const data = fetcher.data;
    if (data?.intent !== "update" || data.id !== sprint.id) return;
    if (data.ok) onClose();
    else setError(data.message);
  }, [fetcher.data, fetcher.state, onClose, sprint.id]);

  useEffect(() => {
    if (materialFetcher.state !== "idle" || !materialSubmitted.current) return;
    materialSubmitted.current = false;
    const data = materialFetcher.data;
    if (data?.intent !== "materials" || data.id !== sprint.id) return;
    if (data.ok) onClose();
    else setMaterialError(data.message);
  }, [materialFetcher.data, materialFetcher.state, onClose, sprint.id]);

  function open() {
    returnFocusRef.current = editButtonRef.current;
    setDraft(toDraft(sprint));
    setError(null);
    onEdit();
  }

  function openMaterialManager() {
    returnFocusRef.current = materialButtonRef.current;
    setMaterialDraftIds(new Set(materialSummary.selectedMaterialIds));
    setMaterialChanges([]);
    setMaterialError(null);
    onManageMaterials();
  }

  function selectMaterial(materialId: string) {
    const material = findSprintMaterial(availableMaterials, materialId);
    if (!material || isSavingMaterials) return;
    setMaterialDraftIds((ids) => {
      const next = new Set(ids);
      for (const id of getSubtreeIds(material)) next.add(id);
      return next;
    });
    setMaterialChanges((changes) => [
      ...changes,
      { type: "select", materialId },
    ]);
    setMaterialError(null);
  }

  function removeMaterial(materialId: string) {
    const material = findSprintMaterial(materialTree, materialId);
    if (!material || isSavingMaterials) return;
    setMaterialDraftIds((ids) => {
      const next = new Set(ids);
      for (const id of getSubtreeIds(material)) next.delete(id);
      return next;
    });
    setMaterialChanges((changes) => [
      ...changes,
      { type: "remove", materialId },
    ]);
    setMaterialError(null);
  }

  function update(field: keyof SprintDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function requestClose() {
    if (isSaving || isSavingMaterials) return;
    if (
      (isDirty || (isManagingMaterials && materialIsDirty)) &&
      !window.confirm("Discard your unsaved Sprint changes?")
    )
      return;
    onClose();
  }

  return (
    <li className="sprint-row">
      <div className="sprint-row-heading">
        <h3>{sprint.name}</h3>
        <div className="sprint-row-actions">
          <span className={`sprint-status sprint-status-${sprint.status}`}>
            {sprint.status}
          </span>
          <button
            ref={editButtonRef}
            className="button button-secondary panel-close"
            type="button"
            aria-label={`Edit ${sprint.name}`}
            title="Edit Sprint"
            disabled={!canEdit}
            onClick={open}
          >
            <Pencil aria-hidden="true" size={16} />
          </button>
          {sprint.status !== "past" && (
            <button
              ref={materialButtonRef}
              className="button button-secondary panel-close"
              type="button"
              aria-label={`Manage Material for ${sprint.name}`}
              title="Manage Material"
              disabled={!canManageMaterials}
              onClick={openMaterialManager}
            >
              <ListPlus aria-hidden="true" size={16} />
            </button>
          )}
        </div>
      </div>
      <dialog
        ref={panelRef}
        className={`material-panel sprint-panel${isManagingMaterials ? " sprint-panel-wide" : ""}`}
        aria-labelledby={`sprint-panel-title-${sprint.id}`}
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          requestClose();
        }}
      >
        <header className="material-panel-header">
          <div>
            <p className="page-context">
              {isEditing ? "Edit Sprint" : "Manage Material"}
            </p>
            <h2 id={`sprint-panel-title-${sprint.id}`}>{sprint.name}</h2>
          </div>
          <button
            className="button button-secondary panel-close"
            type="button"
            aria-label="Close Sprint dialog"
            title="Close"
            disabled={isSaving || isSavingMaterials}
            onClick={requestClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        {isEditing ? (
          <fetcher.Form
            className="sprint-form sprint-panel-content"
            method="post"
            onSubmit={(event) => {
              if (submitted.current) {
                event.preventDefault();
                return;
              }
              submitted.current = true;
              setError(null);
            }}
          >
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="id" value={sprint.id} />
            <input type="hidden" name="version" value={sprint.version} />
            <label htmlFor={`sprint-name-${sprint.id}`}>Name</label>
            <input
              id={`sprint-name-${sprint.id}`}
              name="name"
              value={draft.name}
              required
              disabled={isSaving}
              onChange={(event) => update("name", event.target.value)}
            />
            <label htmlFor={`sprint-goal-${sprint.id}`}>Goal (optional)</label>
            <textarea
              id={`sprint-goal-${sprint.id}`}
              name="goal"
              value={draft.goal}
              rows={3}
              disabled={isSaving}
              onChange={(event) => update("goal", event.target.value)}
            />
            <div className="sprint-date-fields">
              <div>
                <label htmlFor={`sprint-start-${sprint.id}`}>Start date</label>
                <input
                  id={`sprint-start-${sprint.id}`}
                  name="startDate"
                  type="date"
                  value={draft.startDate}
                  min={minStart}
                  required
                  readOnly={startLocked}
                  disabled={isSaving}
                  onChange={(event) => update("startDate", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor={`sprint-end-${sprint.id}`}>End date</label>
                <input
                  id={`sprint-end-${sprint.id}`}
                  name="endDate"
                  type="date"
                  value={draft.endDate}
                  min={datesLocked ? undefined : minEnd}
                  required
                  readOnly={datesLocked}
                  disabled={isSaving}
                  onChange={(event) => update("endDate", event.target.value)}
                />
              </div>
            </div>
            {startLocked && (
              <p className="sprint-timezone">
                {datesLocked
                  ? "Dates of a past Sprint are locked."
                  : "A current Sprint's start date is fixed."}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="sprint-form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={isSaving}
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </fetcher.Form>
        ) : isManagingMaterials ? (
          <section
            className="sprint-material-editor"
            aria-label={`Manage Material for ${sprint.name}`}
          >
            <div className="sprint-material-columns">
              <section aria-labelledby={`available-materials-${sprint.id}`}>
                <h4 id={`available-materials-${sprint.id}`}>Library</h4>
                <div
                  className="sprint-material-tree-scroll"
                  tabIndex={0}
                  aria-label="Available Material tree"
                >
                  {availableMaterials.length === 0 ? (
                    <p className="sprint-empty-state">
                      No Library Material yet.
                    </p>
                  ) : (
                    <SprintMaterialTree
                      materials={availableMaterials}
                      selectedIds={materialDraftIds}
                      mode="available"
                      disabled={isSavingMaterials}
                      onSelect={selectMaterial}
                      onRemove={removeMaterial}
                    />
                  )}
                </div>
              </section>
              <section aria-labelledby={`selected-materials-${sprint.id}`}>
                <h4 id={`selected-materials-${sprint.id}`}>
                  Selected Material
                </h4>
                <div
                  className="sprint-material-tree-scroll"
                  tabIndex={0}
                  aria-label="Selected Material tree"
                >
                  {selectSprintMaterialTree(materialTree, materialDraftIds)
                    .length === 0 ? (
                    <p className="sprint-empty-state">
                      No Material is selected for this Sprint.
                    </p>
                  ) : (
                    <SprintMaterialTree
                      materials={selectSprintMaterialTree(
                        materialTree,
                        materialDraftIds,
                      )}
                      selectedIds={materialDraftIds}
                      mode="selected"
                      disabled={isSavingMaterials}
                      onSelect={selectMaterial}
                      onRemove={removeMaterial}
                    />
                  )}
                </div>
              </section>
            </div>
            {materialError && (
              <p className="form-error" role="alert">
                {materialError}
              </p>
            )}
            <materialFetcher.Form
              className="sprint-form-actions"
              method="post"
              onSubmit={(event) => {
                if (materialSubmitted.current) {
                  event.preventDefault();
                  return;
                }
                materialSubmitted.current = true;
                setMaterialError(null);
              }}
            >
              <input type="hidden" name="intent" value="materials" />
              <input type="hidden" name="id" value={sprint.id} />
              <input
                type="hidden"
                name="changes"
                value={JSON.stringify(materialChanges)}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={isSavingMaterials || !materialIsDirty}
              >
                {isSavingMaterials ? "Saving..." : "Save Material"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={isSavingMaterials}
                onClick={onClose}
              >
                Cancel
              </button>
            </materialFetcher.Form>
          </section>
        ) : null}
      </dialog>
      <>
        <p className="sprint-dates">
          <time dateTime={sprint.startDate}>{sprint.startDate}</time>
          <span aria-hidden="true"> – </span>
          <time dateTime={sprint.endDate}>{sprint.endDate}</time>
        </p>
        {sprint.goal && <p className="sprint-goal">{sprint.goal}</p>}
        <div className="sprint-material-heading">
          <h3>Material</h3>
          <span className="material-count">
            {materialSummary.selectedMaterialIds.length} selected
          </span>
        </div>
        {materialSummary.selectedMaterials.length > 0 ? (
          <SprintMaterialTree
            materials={materialSummary.selectedMaterials}
            selectedIds={new Set(materialSummary.selectedMaterialIds)}
            mode="summary"
          />
        ) : (
          <p className="sprint-empty-material">
            No Material is selected for this Sprint yet.
          </p>
        )}
        {sprint.status === "past" && (
          <p className="sprint-timezone">Material membership is locked.</p>
        )}
      </>
    </li>
  );
}

type SprintMaterialTreeProps = {
  materials: SprintMaterialNode[];
  selectedIds: Set<string>;
  mode: "available" | "selected" | "summary";
  disabled?: boolean;
  onSelect?: (materialId: string) => void;
  onRemove?: (materialId: string) => void;
};

function SprintMaterialTree({
  materials,
  selectedIds,
  mode,
  disabled = false,
  onSelect,
  onRemove,
}: SprintMaterialTreeProps) {
  const treeId = useId();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  return (
    <ul className="sprint-material-tree">
      {materials.map((material) => {
        const isSelected = selectedIds.has(material.id);
        const hasChildren = material.children.length > 0;
        const isExpanded = mode === "available" || expandedIds.has(material.id);
        const childrenId = `${treeId}-${material.id}`;
        return (
          <li key={material.id}>
            <div className="sprint-material-item">
              {mode !== "available" && hasChildren && (
                <button
                  className="material-disclosure sprint-material-toggle"
                  type="button"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${material.title}`}
                  title={`${isExpanded ? "Collapse" : "Expand"} children`}
                  aria-expanded={isExpanded}
                  aria-controls={childrenId}
                  onClick={() =>
                    setExpandedIds((current) => {
                      const next = new Set(current);
                      if (next.has(material.id)) next.delete(material.id);
                      else next.add(material.id);
                      return next;
                    })
                  }
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              )}
              <span className="sprint-material-title">{material.title}</span>
              {mode === "available" ? (
                isSelected ? (
                  <span
                    className="sprint-material-state sprint-material-check"
                    role="img"
                    aria-label="Selected"
                    title="Selected"
                  >
                    <Check aria-hidden="true" size={16} />
                  </span>
                ) : (
                  <button
                    className="material-disclosure sprint-material-action"
                    type="button"
                    disabled={disabled}
                    aria-label={`Select ${material.title}`}
                    title={`Select ${material.title}`}
                    onClick={() => onSelect?.(material.id)}
                  >
                    <Plus aria-hidden="true" size={16} />
                  </button>
                )
              ) : mode === "selected" ? (
                isSelected ? (
                  <button
                    className="material-disclosure sprint-material-action sprint-material-remove"
                    type="button"
                    disabled={disabled}
                    aria-label={`Remove ${material.title} from Sprint`}
                    title="Remove from Sprint"
                    onClick={() => onRemove?.(material.id)}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                ) : null
              ) : null}
            </div>
            {hasChildren && (
              <div id={childrenId} hidden={!isExpanded}>
                {isExpanded && (
                  <SprintMaterialTree
                    materials={material.children}
                    selectedIds={selectedIds}
                    mode={mode}
                    disabled={disabled}
                    onSelect={onSelect}
                    onRemove={onRemove}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function findSprintMaterial(
  materials: SprintMaterialNode[],
  materialId: string,
): SprintMaterialNode | undefined {
  for (const material of materials) {
    if (material.id === materialId) return material;
    const child = findSprintMaterial(material.children, materialId);
    if (child) return child;
  }
  return undefined;
}

function getSubtreeIds(material: SprintMaterialNode): string[] {
  return [
    material.id,
    ...material.children.flatMap((child) => getSubtreeIds(child)),
  ];
}

function sameIds(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size &&
    [...left].every((materialId) => right.has(materialId))
  );
}

function toDraft(sprint: SerializedSprint): SprintDraft {
  return {
    name: sprint.name,
    goal: sprint.goal ?? "",
    startDate: sprint.startDate,
    endDate: sprint.endDate,
  };
}

function getCalendarDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get("year")!.padStart(4, "0")}-${values.get("month")}-${values.get("day")}`;
}

function getFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getSprintErrorMessage(error: unknown): string {
  if (error instanceof InvalidSprintNameError) return error.message;
  if (error instanceof InvalidSprintDateError) return error.message;
  if (error instanceof SprintStartDateInPastError) return error.message;
  if (error instanceof InvalidApplicationTimeZoneError) return error.message;
  if (error instanceof SprintDateOverlapError) return error.message;
  if (error instanceof SprintDatesLockedError) return error.message;
  if (error instanceof SprintStartDateLockedError) return error.message;
  if (error instanceof SprintEndDateInPastError) return error.message;
  if (error instanceof SprintEditConflictError) return error.message;
  if (error instanceof SprintNotFoundError) return error.message;
  if (error instanceof ArchivedSprintMaterialError) return error.message;
  if (error instanceof SprintMaterialLockedError) return error.message;
  if (error instanceof SprintMaterialNotFoundError) return error.message;
  return "Could not save this Sprint. Your input is still here; try again.";
}

function parseSprintMaterialChanges(
  serialized: string,
): SprintMaterialChange[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const changes: SprintMaterialChange[] = [];
  for (const value of parsed) {
    if (
      typeof value !== "object" ||
      value === null ||
      !("type" in value) ||
      !("materialId" in value) ||
      (value.type !== "select" && value.type !== "remove") ||
      typeof value.materialId !== "string" ||
      value.materialId.length === 0
    ) {
      return null;
    }
    changes.push({ type: value.type, materialId: value.materialId });
  }
  return changes;
}
