import { useEffect, useRef, useState } from "react";
import { useBlocker, useFetcher, useLoaderData } from "react-router";
import { Check, Pencil, Plus, X } from "lucide-react";
import {
  createStandaloneMaterial,
  InvalidMaterialTitleError,
  listLibraryMaterials,
  MaterialNotFoundError,
  MaterialTitleConflictError,
  renameMaterial,
} from "@practice-planner/core/material-operations";
import { getDatabase } from "@practice-planner/core/db.server";
import type { Route } from "./+types/home";

export async function loader() {
  return { materials: await listLibraryMaterials(getDatabase()) };
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: {
  actionResult?: unknown;
  defaultShouldRevalidate: boolean;
}) {
  if (isFailedAction(actionResult)) return false;
  return defaultShouldRevalidate;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const rawTitle = formData.get("title");
  const submittedTitle = typeof rawTitle === "string" ? rawTitle : "";
  const database = getDatabase();

  if (intent === "create") {
    try {
      const material = await createStandaloneMaterial(database, submittedTitle);
      return { ok: true, intent, materialId: material.id, submittedTitle };
    } catch (error) {
      return {
        ok: false,
        intent,
        message: getActionErrorMessage(error),
        submittedTitle,
      };
    }
  }

  if (intent === "rename") {
    const materialId = formData.get("materialId");
    if (typeof materialId !== "string") {
      return {
        ok: false,
        intent,
        materialId: "",
        message: "Select a Material to rename.",
        submittedTitle,
      };
    }

    try {
      const material = await renameMaterial(
        database,
        materialId,
        submittedTitle,
      );
      return { ok: true, intent, materialId: material.id, submittedTitle };
    } catch (error) {
      return {
        ok: false,
        intent,
        materialId,
        message: getActionErrorMessage(error),
        submittedTitle,
      };
    }
  }

  return {
    ok: false,
    intent: "invalid",
    message: "This Library action is not supported.",
  };
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof InvalidMaterialTitleError)
    return "Enter a title for this Material.";
  if (error instanceof MaterialTitleConflictError) {
    return `“${error.conflictingMaterial.title}” already exists in the Library. Choose a different title.`;
  }
  if (error instanceof MaterialNotFoundError)
    return "This Material is no longer in the Library. Reload and try again.";
  return "Could not save this Material. Your title is still here; try again.";
}

function isFailedAction(result: unknown): result is { ok: false } {
  return (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    result.ok === false
  );
}

export default function Home() {
  const { materials } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<typeof action>();
  const renameFetcher = useFetcher<typeof action>();
  const [createTitle, setCreateTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const submittedCreateTitle = useRef<string | null>(null);
  const submittedRenameTitle = useRef<string | null>(null);
  const editingMaterial = materials.find(
    (material) => material.id === editingId,
  );
  const isDirty =
    createTitle.length > 0 ||
    (editingMaterial !== undefined && draftTitle !== editingMaterial.title);
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (
      createFetcher.state !== "idle" ||
      createFetcher.data?.intent !== "create"
    )
      return;
    const submittedTitle = submittedCreateTitle.current;
    if (submittedTitle === null) return;
    if (createFetcher.data.ok && createTitle === submittedTitle)
      setCreateTitle("");
    submittedCreateTitle.current = null;
  }, [createFetcher.data, createFetcher.state, createTitle]);

  useEffect(() => {
    if (
      renameFetcher.state !== "idle" ||
      renameFetcher.data?.intent !== "rename"
    )
      return;
    const submittedTitle = submittedRenameTitle.current;
    if (submittedTitle === null) return;
    if (
      renameFetcher.data.ok &&
      renameFetcher.data.materialId === editingId &&
      draftTitle === submittedTitle
    ) {
      setEditingId(null);
      setDraftTitle("");
    }
    submittedRenameTitle.current = null;
  }, [draftTitle, editingId, renameFetcher.data, renameFetcher.state]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Discard unsaved changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const createError =
    createFetcher.data?.intent === "create" &&
    !createFetcher.data.ok &&
    createFetcher.data.submittedTitle === createTitle
      ? createFetcher.data.message
      : undefined;

  return (
    <main className="library-page">
      <header className="page-header">
        <div>
          <p className="page-context">Practice Planner</p>
          <h1>Library</h1>
        </div>
        <p className="material-count" aria-live="polite">
          {materials.length} {materials.length === 1 ? "Material" : "Materials"}
        </p>
      </header>

      <section className="capture-section" aria-labelledby="capture-heading">
        <h2 id="capture-heading">Add Material</h2>
        <createFetcher.Form
          method="post"
          className="capture-form"
          onSubmit={() => {
            submittedCreateTitle.current = createTitle;
          }}
        >
          <input type="hidden" name="intent" value="create" />
          <label htmlFor="new-material-title">Title</label>
          <div className="form-row">
            <input
              id="new-material-title"
              name="title"
              required
              value={createTitle}
              onChange={(event) => setCreateTitle(event.currentTarget.value)}
              aria-describedby={
                createError ? "create-material-error" : undefined
              }
            />
            <button
              className="button button-primary"
              type="submit"
              disabled={!createTitle.trim() || createFetcher.state !== "idle"}
            >
              <Plus aria-hidden="true" size={16} />
              {createFetcher.state === "submitting"
                ? "Adding…"
                : "Add Material"}
            </button>
          </div>
          {createError && (
            <p className="form-error" id="create-material-error" role="alert">
              {createError}
            </p>
          )}
        </createFetcher.Form>
      </section>

      <section className="library-section" aria-labelledby="library-heading">
        <div className="section-heading">
          <h2 id="library-heading">Your Library</h2>
        </div>
        {materials.length === 0 ? (
          <p className="empty-state">
            No Materials yet. Add a title to start your Library.
          </p>
        ) : (
          <ul className="material-list" aria-label="Library Materials">
            {materials.map((material) => {
              const isEditing = editingId === material.id;
              const renameError =
                renameFetcher.data?.intent === "rename" &&
                renameFetcher.data.materialId === material.id &&
                renameFetcher.data.submittedTitle === draftTitle &&
                !renameFetcher.data.ok
                  ? renameFetcher.data.message
                  : undefined;

              return (
                <li className="material-row" key={material.id}>
                  {isEditing ? (
                    <renameFetcher.Form
                      method="post"
                      className="rename-form"
                      onSubmit={() => {
                        submittedRenameTitle.current = draftTitle;
                      }}
                    >
                      <input type="hidden" name="intent" value="rename" />
                      <input
                        type="hidden"
                        name="materialId"
                        value={material.id}
                      />
                      <label htmlFor={`rename-material-${material.id}`}>
                        Title
                      </label>
                      <div className="form-row">
                        <input
                          id={`rename-material-${material.id}`}
                          name="title"
                          required
                          value={draftTitle}
                          onChange={(event) =>
                            setDraftTitle(event.currentTarget.value)
                          }
                          aria-describedby={
                            renameError
                              ? `rename-error-${material.id}`
                              : undefined
                          }
                        />
                        <button
                          className="button button-primary"
                          type="submit"
                          disabled={
                            !draftTitle.trim() ||
                            draftTitle === material.title ||
                            renameFetcher.state !== "idle"
                          }
                        >
                          <Check aria-hidden="true" size={16} />
                          {renameFetcher.state === "submitting"
                            ? "Saving…"
                            : "Save"}
                        </button>
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={renameFetcher.state !== "idle"}
                          onClick={() => {
                            setEditingId(null);
                            setDraftTitle("");
                          }}
                        >
                          <X aria-hidden="true" size={16} />
                          Cancel
                        </button>
                      </div>
                      {renameError && (
                        <p
                          className="form-error"
                          id={`rename-error-${material.id}`}
                          role="alert"
                        >
                          {renameError}
                        </p>
                      )}
                    </renameFetcher.Form>
                  ) : (
                    <>
                      <h3 className="material-title">{material.title}</h3>
                      <button
                        className="button button-secondary rename-button"
                        type="button"
                        onClick={() => {
                          setEditingId(material.id);
                          setDraftTitle(material.title);
                        }}
                        aria-label={`Rename ${material.title}`}
                      >
                        <Pencil aria-hidden="true" size={16} />
                        Rename
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
