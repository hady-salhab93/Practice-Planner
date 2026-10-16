import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useFetcher, useLoaderData } from "react-router";
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
  | { ok: false; intent: "invalid"; message: string };

export async function loader() {
  return listSprints(getDatabase());
}

export async function action({
  request,
}: Route.ActionArgs): Promise<SprintActionData> {
  const formData = await request.formData();
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
  const { timeZone, sprints } = useLoaderData<typeof loader>();
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
  const [editDirty, setEditDirty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const submitted = useRef(false);
  const isSaving = fetcher.state !== "idle";
  const isDirty =
    draft.name.length > 0 ||
    draft.goal.length > 0 ||
    (draft.startDate !== "" && draft.startDate !== today) ||
    (draft.endDate !== "" && draft.endDate !== today);
  const blocker = useBlocker((isDirty || editDirty) && !isSaving);
  const schedulingTimeZone = timeZone ?? deviceTimeZone;

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
    if (!isDirty && !editDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, editDirty]);

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
    } else if (fetcher.data && fetcher.data.intent === "create") {
      setActionError(fetcher.data.message);
    }
  }, [fetcher.data, fetcher.state, today]);

  function updateDraft(field: keyof SprintDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setActionError(null);
  }

  function cancelDraft() {
    setDraft({ name: "", goal: "", startDate: today, endDate: today });
    setActionError(null);
  }

  return (
    <main className="library-page sprint-page">
      <header className="page-header">
        <div>
          <p className="page-context">Practice Planner</p>
          <h1>Sprints</h1>
        </div>
        <Link className="button button-secondary" to="/">
          Library
        </Link>
      </header>

      <section
        className="capture-section"
        aria-labelledby="create-sprint-heading"
      >
        <h2 id="create-sprint-heading">Create Sprint</h2>
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
                onChange={(event) => updateDraft("endDate", event.target.value)}
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
              disabled={isSaving || !isDirty}
              onClick={cancelDraft}
            >
              Cancel
            </button>
          </div>
        </fetcher.Form>
      </section>

      <section
        className="sprint-list-section"
        aria-labelledby="sprint-list-heading"
      >
        <div className="section-heading">
          <h2 id="sprint-list-heading">Scheduled Sprints</h2>
          <p className="material-count" aria-live="polite">
            {sprints.length} {sprints.length === 1 ? "Sprint" : "Sprints"}
          </p>
        </div>
        {sprints.length === 0 ? (
          <p className="sprint-empty-state">No Sprints yet.</p>
        ) : (
          <ol className="sprint-list">
            {sprints.map((sprint) => (
              <SprintRow
                key={sprint.id}
                sprint={sprint}
                today={today}
                isEditing={editingId === sprint.id}
                canEdit={editingId === null}
                onEdit={() => setEditingId(sprint.id)}
                onClose={() => {
                  setEditingId(null);
                  setEditDirty(false);
                }}
                onDirtyChange={setEditDirty}
              />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

type SprintRowProps = {
  sprint: SerializedSprint;
  today: string;
  isEditing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

type SerializedSprint = Awaited<
  ReturnType<typeof listSprints>
>["sprints"][number];

function SprintRow({
  sprint,
  today,
  isEditing,
  canEdit,
  onEdit,
  onClose,
  onDirtyChange,
}: SprintRowProps) {
  const fetcher = useFetcher<typeof action>();
  const [draft, setDraft] = useState<SprintDraft>(() => toDraft(sprint));
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const isSaving = fetcher.state !== "idle";
  const isDirty =
    isEditing &&
    (draft.name !== sprint.name ||
      draft.goal !== (sprint.goal ?? "") ||
      draft.startDate !== sprint.startDate ||
      draft.endDate !== sprint.endDate);
  const datesLocked = sprint.status === "past";
  const startLocked = sprint.status !== "future";
  const minStart = today;
  const minEnd = sprint.status === "current" ? today : draft.startDate || today;

  useEffect(() => {
    if (isEditing) onDirtyChange(isDirty);
  }, [isEditing, isDirty, onDirtyChange]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !submitted.current) return;
    submitted.current = false;
    const data = fetcher.data;
    if (data?.intent !== "update" || data.id !== sprint.id) return;
    if (data.ok) onClose();
    else setError(data.message);
  }, [fetcher.data, fetcher.state, onClose, sprint.id]);

  function open() {
    setDraft(toDraft(sprint));
    setError(null);
    onEdit();
  }

  function update(field: keyof SprintDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  return (
    <li className="sprint-row">
      <div className="sprint-row-heading">
        <h3>{sprint.name}</h3>
        <span className={`sprint-status sprint-status-${sprint.status}`}>
          {sprint.status}
        </span>
      </div>
      {isEditing ? (
        <fetcher.Form
          className="sprint-form"
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
      ) : (
        <>
          <p className="sprint-dates">
            <time dateTime={sprint.startDate}>{sprint.startDate}</time>
            <span aria-hidden="true"> – </span>
            <time dateTime={sprint.endDate}>{sprint.endDate}</time>
          </p>
          {sprint.goal && <p className="sprint-goal">{sprint.goal}</p>}
          {sprint.status === "current" && (
            <p className="sprint-empty-material">
              No Material is selected for this Sprint yet.
            </p>
          )}
          <button
            className="button button-secondary"
            type="button"
            disabled={!canEdit}
            onClick={open}
          >
            Edit
          </button>
        </>
      )}
    </li>
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
  return "Could not save this Sprint. Your input is still here; try again.";
}
