import { useEffect, useRef, useState } from "react";
import { useBlocker, useFetcher, useLoaderData } from "react-router";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  createChildMaterial,
  createStandaloneMaterial,
  InvalidMaterialTitleError,
  listLibraryMaterialTree,
  MaterialNotFoundError,
  MaterialTitleConflictError,
  renameMaterial,
  type MaterialTreeNode,
} from "@practice-planner/core/material-operations";
import { getDatabase } from "@practice-planner/core/db.server";
import type { Route } from "./+types/home";

export async function loader() {
  return { materials: await listLibraryMaterialTree(getDatabase()) };
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
    const rawParentId = formData.get("parentId");
    const parentId = typeof rawParentId === "string" ? rawParentId : null;
    try {
      const material =
        parentId === null
          ? await createStandaloneMaterial(database, submittedTitle)
          : await createChildMaterial(database, parentId, submittedTitle);
      return {
        ok: true,
        intent,
        materialId: material.id,
        parentId,
        submittedTitle,
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        parentId,
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
    return `“${error.conflictingMaterial.title}” already exists in this group. Choose a different title.`;
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
  const [childDrafts, setChildDrafts] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const submittedCreate = useRef<{
    parentId: string | null;
    title: string;
  } | null>(null);
  const submittedRenameTitle = useRef<string | null>(null);
  const editingMaterial = findMaterial(materials, editingId);
  const isDirty =
    createTitle.length > 0 ||
    Object.values(childDrafts).some((title) => title.length > 0) ||
    (editingMaterial !== undefined && draftTitle !== editingMaterial.title);
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (
      createFetcher.state !== "idle" ||
      createFetcher.data?.intent !== "create"
    )
      return;
    const submitted = submittedCreate.current;
    if (submitted === null) return;
    if (createFetcher.data.ok) {
      if (submitted.parentId === null && createTitle === submitted.title)
        setCreateTitle("");
      if (
        submitted.parentId !== null &&
        childDrafts[submitted.parentId] === submitted.title
      ) {
        setChildDrafts((drafts) => {
          const nextDrafts = { ...drafts };
          delete nextDrafts[submitted.parentId as string];
          return nextDrafts;
        });
      }
    }
    submittedCreate.current = null;
  }, [childDrafts, createFetcher.data, createFetcher.state, createTitle]);

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
    createFetcher.data.parentId === null &&
    createFetcher.data.submittedTitle === createTitle
      ? createFetcher.data.message
      : undefined;
  const materialCount = countMaterials(materials);

  function renderMaterial(material: MaterialTreeNode) {
    const isEditing = editingId === material.id;
    const childTitle = childDrafts[material.id] ?? "";
    const childError =
      createFetcher.data?.intent === "create" &&
      !createFetcher.data.ok &&
      createFetcher.data.parentId === material.id &&
      createFetcher.data.submittedTitle === childTitle
        ? createFetcher.data.message
        : undefined;
    const renameError =
      renameFetcher.data?.intent === "rename" &&
      renameFetcher.data.materialId === material.id &&
      renameFetcher.data.submittedTitle === draftTitle &&
      !renameFetcher.data.ok
        ? renameFetcher.data.message
        : undefined;
    const hasChildren =
      material.children.length > 0 || material.id in childDrafts;
    const isExpanded = expandedIds.has(material.id);

    return (
      <li className="material-node" key={material.id}>
        <div className="material-row">
          {isEditing ? (
            <renameFetcher.Form
              method="post"
              className="rename-form"
              onSubmit={() => {
                submittedRenameTitle.current = draftTitle;
              }}
            >
              <input type="hidden" name="intent" value="rename" />
              <input type="hidden" name="materialId" value={material.id} />
              <label htmlFor={`rename-material-${material.id}`}>Title</label>
              <div className="form-row">
                <input
                  id={`rename-material-${material.id}`}
                  name="title"
                  required
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.currentTarget.value)}
                  aria-describedby={
                    renameError ? `rename-error-${material.id}` : undefined
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
                  {renameFetcher.state === "submitting" ? "Saving…" : "Save"}
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
              <div className="material-heading">
                {hasChildren ? (
                  <button
                    className="material-disclosure"
                    type="button"
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${material.title}`}
                    aria-expanded={isExpanded}
                    aria-controls={`material-children-${material.id}`}
                    onClick={() =>
                      setExpandedIds((ids) => {
                        const nextIds = new Set(ids);
                        if (isExpanded) nextIds.delete(material.id);
                        else nextIds.add(material.id);
                        return nextIds;
                      })
                    }
                  >
                    {isExpanded ? (
                      <ChevronDown aria-hidden="true" size={16} />
                    ) : (
                      <ChevronRight aria-hidden="true" size={16} />
                    )}
                  </button>
                ) : (
                  <span className="material-disclosure-spacer" />
                )}
                <h3 className="material-title">{material.title}</h3>
              </div>
              <div className="material-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setChildDrafts((drafts) =>
                      material.id in drafts
                        ? drafts
                        : { ...drafts, [material.id]: "" },
                    );
                    setExpandedIds((ids) => new Set(ids).add(material.id));
                  }}
                >
                  <Plus aria-hidden="true" size={16} />
                  Add child
                </button>
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
              </div>
            </>
          )}
        </div>
        {hasChildren && (
          <ul
            className="material-list material-children"
            id={`material-children-${material.id}`}
            hidden={!isExpanded}
          >
            {material.children.map(renderMaterial)}
            {material.id in childDrafts && (
              <li className="material-node">
                <createFetcher.Form
                  method="post"
                  className="capture-form create-child-form"
                  onSubmit={() => {
                    submittedCreate.current = {
                      parentId: material.id,
                      title: childTitle,
                    };
                  }}
                >
                  <input type="hidden" name="intent" value="create" />
                  <input type="hidden" name="parentId" value={material.id} />
                  <label htmlFor={`child-material-${material.id}`}>Title</label>
                  <div className="form-row">
                    <input
                      id={`child-material-${material.id}`}
                      name="title"
                      required
                      value={childTitle}
                      onChange={(event) => {
                        const title = event.currentTarget.value;
                        setChildDrafts((drafts) => ({
                          ...drafts,
                          [material.id]: title,
                        }));
                      }}
                      aria-describedby={
                        childError ? `child-error-${material.id}` : undefined
                      }
                    />
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={
                        !childTitle.trim() || createFetcher.state !== "idle"
                      }
                    >
                      <Check aria-hidden="true" size={16} />
                      {createFetcher.state === "submitting"
                        ? "Saving…"
                        : "Save"}
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={createFetcher.state !== "idle"}
                      onClick={() =>
                        setChildDrafts((drafts) => {
                          const nextDrafts = { ...drafts };
                          delete nextDrafts[material.id];
                          return nextDrafts;
                        })
                      }
                    >
                      <X aria-hidden="true" size={16} />
                      Cancel
                    </button>
                  </div>
                  {childError && (
                    <p
                      className="form-error"
                      id={`child-error-${material.id}`}
                      role="alert"
                    >
                      {childError}
                    </p>
                  )}
                </createFetcher.Form>
              </li>
            )}
          </ul>
        )}
      </li>
    );
  }

  return (
    <main className="library-page">
      <header className="page-header">
        <div>
          <p className="page-context">Practice Planner</p>
          <h1>Library</h1>
        </div>
        <p className="material-count" aria-live="polite">
          {materialCount} {materialCount === 1 ? "Material" : "Materials"}
        </p>
      </header>

      <section className="capture-section" aria-labelledby="capture-heading">
        <h2 id="capture-heading">Add Material</h2>
        <createFetcher.Form
          method="post"
          className="capture-form"
          onSubmit={() => {
            submittedCreate.current = { parentId: null, title: createTitle };
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
            {materials.map(renderMaterial)}
          </ul>
        )}
      </section>
    </main>
  );
}

function findMaterial(
  materials: MaterialTreeNode[],
  materialId: string | null,
): MaterialTreeNode | undefined {
  if (materialId === null) return undefined;

  for (const material of materials) {
    if (material.id === materialId) return material;
    const descendant = findMaterial(material.children, materialId);
    if (descendant) return descendant;
  }

  return undefined;
}

function countMaterials(materials: MaterialTreeNode[]): number {
  return materials.reduce(
    (count, material) => count + 1 + countMaterials(material.children),
    0,
  );
}
