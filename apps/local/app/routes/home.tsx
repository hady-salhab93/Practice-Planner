import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useBlocker, useFetcher, useLoaderData } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  createChildMaterial,
  createStandaloneMaterial,
  InvalidMaterialTitleError,
  InvalidMaterialReferenceError,
  listLibraryMaterialTree,
  MaterialNotFoundError,
  MaterialTitleConflictError,
  reorderMaterial,
  renameMaterial,
  updateMaterialMetadata,
  type MaterialTreeNode,
} from "@practice-planner/core/material-operations";
import { getDatabase } from "@practice-planner/core/db.server";
import type { Route } from "./+types/home";

type MaterialMetadataDraft = {
  description: string;
  references: Array<{
    key: string;
    id?: string;
    label: string;
    url: string;
  }>;
};

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

  if (intent === "reorder") {
    const materialId = formData.get("materialId");
    const direction = formData.get("direction");
    if (
      typeof materialId !== "string" ||
      (direction !== "up" && direction !== "down")
    ) {
      return {
        ok: false,
        intent,
        materialId: typeof materialId === "string" ? materialId : "",
        message: "Select a Material and a direction to reorder it.",
      };
    }

    try {
      await reorderMaterial(database, materialId, direction);
      return { ok: true, intent, materialId };
    } catch (error) {
      return {
        ok: false,
        intent,
        materialId,
        message:
          error instanceof MaterialNotFoundError
            ? getActionErrorMessage(error)
            : "Could not reorder this Material. The saved order is unchanged; try again.",
      };
    }
  }

  if (intent === "metadata") {
    const materialId = formData.get("materialId");
    const referenceIds = formData.getAll("referenceId");
    const referenceLabels = formData.getAll("referenceLabel");
    const referenceUrls = formData.getAll("referenceUrl");
    const rawDescription = formData.get("description");
    if (
      typeof materialId !== "string" ||
      referenceIds.length !== referenceLabels.length ||
      referenceIds.length !== referenceUrls.length ||
      referenceIds.some((value) => typeof value !== "string") ||
      referenceLabels.some((value) => typeof value !== "string") ||
      referenceUrls.some((value) => typeof value !== "string")
    ) {
      return {
        ok: false,
        intent,
        materialId: typeof materialId === "string" ? materialId : "",
        message:
          "Could not save these details. Review the reference fields and try again.",
      };
    }

    const references = referenceUrls.map((url, index) => {
      const id = referenceIds[index] as string;
      return {
        ...(id ? { id } : {}),
        label: (referenceLabels[index] as string) || null,
        url: url as string,
      };
    });
    try {
      await updateMaterialMetadata(database, materialId, {
        description: typeof rawDescription === "string" ? rawDescription : "",
        references,
      });
      return { ok: true, intent, materialId };
    } catch (error) {
      return {
        ok: false,
        intent,
        materialId,
        message: getActionErrorMessage(error),
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
  if (error instanceof InvalidMaterialReferenceError) return error.message;
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
  const reorderFetcher = useFetcher<typeof action>();
  const metadataFetcher = useFetcher<typeof action>();
  const [createTitle, setCreateTitle] = useState("");
  const [childDrafts, setChildDrafts] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(
    null,
  );
  const [draftMetadata, setDraftMetadata] =
    useState<MaterialMetadataDraft | null>(null);
  const [metadataErrorId, setMetadataErrorId] = useState<string | null>(null);
  const metadataPanelRef = useRef<HTMLDialogElement>(null);
  const submittedCreate = useRef<{
    parentId: string | null;
    title: string;
  } | null>(null);
  const submittedRenameTitle = useRef<string | null>(null);
  const submittedMetadataId = useRef<string | null>(null);
  const editingMaterial = findMaterial(materials, editingId);
  const editingMetadataMaterial = findMaterial(materials, editingMetadataId);
  const metadataIsDirty =
    editingMetadataMaterial !== undefined &&
    draftMetadata !== null &&
    hasMetadataChanges(editingMetadataMaterial, draftMetadata);
  const isDirty =
    createTitle.length > 0 ||
    Object.values(childDrafts).some((title) => title.length > 0) ||
    (editingMaterial !== undefined && draftTitle !== editingMaterial.title) ||
    metadataIsDirty;
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    const panel = metadataPanelRef.current;
    if (!panel) return;
    if (editingMetadataId !== null && !panel.open) panel.showModal();
    if (editingMetadataId === null && panel.open) panel.close();
  }, [editingMetadataId]);

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
    if (
      metadataFetcher.state !== "idle" ||
      metadataFetcher.data?.intent !== "metadata"
    )
      return;
    const submittedMaterialId = submittedMetadataId.current;
    if (submittedMaterialId === null) return;
    if (
      metadataFetcher.data.ok &&
      metadataFetcher.data.materialId === submittedMaterialId
    ) {
      setEditingMetadataId(null);
      setDraftMetadata(null);
      setMetadataErrorId(null);
    } else if (metadataFetcher.data.materialId === submittedMaterialId) {
      setMetadataErrorId(submittedMaterialId);
    }
    submittedMetadataId.current = null;
  }, [metadataFetcher.data, metadataFetcher.state]);

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
  const metadataError =
    metadataFetcher.data?.intent === "metadata" &&
    editingMetadataId !== null &&
    metadataErrorId === editingMetadataId &&
    metadataFetcher.data.materialId === editingMetadataId &&
    !metadataFetcher.data.ok
      ? metadataFetcher.data.message
      : undefined;
  const materialCount = countMaterials(materials);

  function discardMetadataDraft() {
    setEditingMetadataId(null);
    setDraftMetadata(null);
    setMetadataErrorId(null);
  }

  function requestCloseMetadataPanel() {
    if (metadataFetcher.state !== "idle") return;
    if (metadataIsDirty && !window.confirm("Discard unsaved changes?")) return;
    discardMetadataDraft();
  }

  function renderMaterial(
    material: MaterialTreeNode,
    siblingIndex: number,
    siblingCount: number,
  ) {
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
    const reorderError =
      reorderFetcher.data?.intent === "reorder" &&
      reorderFetcher.data.materialId === material.id &&
      !reorderFetcher.data.ok
        ? reorderFetcher.data.message
        : undefined;
    const orderingDisabled =
      reorderFetcher.state !== "idle" ||
      editingId !== null ||
      editingMetadataId !== null;
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
                <div className="material-copy">
                  <h3 className="material-title">{material.title}</h3>
                  {material.description && (
                    <p className="material-description">
                      {material.description}
                    </p>
                  )}
                  {material.references.length > 0 && (
                    <ul
                      className="material-references"
                      aria-label={`References for ${material.title}`}
                    >
                      {material.references.map((reference) => (
                        <li key={reference.id}>
                          <ExternalLink aria-hidden="true" size={14} />
                          <a href={reference.url}>
                            {reference.label || reference.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div
                className={`material-actions${reorderError ? " material-actions-error" : ""}`}
              >
                <reorderFetcher.Form
                  method="post"
                  className="material-order-form"
                >
                  <input type="hidden" name="intent" value="reorder" />
                  <input
                    type="hidden"
                    name="materialId"
                    value={material.id}
                  />
                  <button
                    className="button button-secondary"
                    type="submit"
                    name="direction"
                    value="up"
                    aria-label={`Move ${material.title} up`}
                    title={`Move ${material.title} up`}
                    disabled={orderingDisabled || siblingIndex === 0}
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="button button-secondary"
                    type="submit"
                    name="direction"
                    value="down"
                    aria-label={`Move ${material.title} down`}
                    title={`Move ${material.title} down`}
                    disabled={
                      orderingDisabled || siblingIndex === siblingCount - 1
                    }
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </button>
                </reorderFetcher.Form>
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
                  disabled={editingMetadataId !== null}
                  aria-label={`Rename ${material.title}`}
                >
                  <Pencil aria-hidden="true" size={16} />
                  Rename
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={editingId !== null || editingMetadataId !== null}
                  onClick={() => {
                    setEditingMetadataId(material.id);
                    setDraftMetadata(createMetadataDraft(material));
                    setMetadataErrorId(null);
                  }}
                >
                  <Pencil aria-hidden="true" size={16} />
                  Edit details
                </button>
                {reorderError && (
                  <p className="form-error material-order-error" role="alert">
                    {reorderError}
                  </p>
                )}
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
            {material.children.map((child, index) =>
              renderMaterial(child, index, material.children.length),
            )}
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
    <>
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
              {materials.map((material, index) =>
                renderMaterial(material, index, materials.length),
              )}
            </ul>
          )}
        </section>
      </main>
      <dialog
        ref={metadataPanelRef}
        className="material-panel"
        aria-labelledby="material-panel-title"
        onCancel={(event) => {
          event.preventDefault();
          requestCloseMetadataPanel();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          requestCloseMetadataPanel();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) requestCloseMetadataPanel();
        }}
      >
        {editingMetadataMaterial && draftMetadata && (
          <metadataFetcher.Form
            method="post"
            className="material-panel-form"
            onSubmit={() => {
              submittedMetadataId.current = editingMetadataMaterial.id;
              setMetadataErrorId(null);
            }}
          >
            <header className="material-panel-header">
              <div>
                <p className="page-context">Material details</p>
                <h2 id="material-panel-title">
                  {editingMetadataMaterial.title}
                </h2>
              </div>
              <button
                className="button button-secondary panel-close"
                type="button"
                aria-label="Close details"
                title="Close details"
                disabled={metadataFetcher.state !== "idle"}
                onClick={requestCloseMetadataPanel}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <input type="hidden" name="intent" value="metadata" />
            <input
              type="hidden"
              name="materialId"
              value={editingMetadataMaterial.id}
            />
            <div className="material-panel-content">
              <label htmlFor="material-panel-description">Description</label>
              <textarea
                id="material-panel-description"
                name="description"
                rows={4}
                value={draftMetadata.description}
                onChange={(event) => {
                  const description = event.currentTarget.value;
                  setDraftMetadata((draft) =>
                    draft ? { ...draft, description } : draft,
                  );
                }}
                disabled={metadataFetcher.state !== "idle"}
              />
              <fieldset className="reference-editor">
                <legend>References</legend>
                {draftMetadata.references.map((reference) => (
                  <div className="reference-editor-row" key={reference.key}>
                    <input
                      type="hidden"
                      name="referenceId"
                      value={reference.id ?? ""}
                    />
                    <div className="reference-fields">
                      <div>
                        <label htmlFor={`reference-label-${reference.key}`}>
                          Label
                        </label>
                        <input
                          id={`reference-label-${reference.key}`}
                          name="referenceLabel"
                          value={reference.label}
                          onChange={(event) =>
                            updateDraftReference(
                              setDraftMetadata,
                              reference.key,
                              { label: event.currentTarget.value },
                            )
                          }
                          disabled={metadataFetcher.state !== "idle"}
                        />
                      </div>
                      <div>
                        <label htmlFor={`reference-url-${reference.key}`}>
                          Link
                        </label>
                        <input
                          id={`reference-url-${reference.key}`}
                          name="referenceUrl"
                          type="url"
                          required
                          value={reference.url}
                          onChange={(event) =>
                            updateDraftReference(
                              setDraftMetadata,
                              reference.key,
                              { url: event.currentTarget.value },
                            )
                          }
                          disabled={metadataFetcher.state !== "idle"}
                        />
                      </div>
                    </div>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={metadataFetcher.state !== "idle"}
                      onClick={() =>
                        setDraftMetadata((draft) =>
                          draft
                            ? {
                                ...draft,
                                references: draft.references.filter(
                                  (item) => item.key !== reference.key,
                                ),
                              }
                            : draft,
                        )
                      }
                    >
                      <X aria-hidden="true" size={16} />
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="button button-secondary add-reference"
                  type="button"
                  disabled={metadataFetcher.state !== "idle"}
                  onClick={() =>
                    setDraftMetadata((draft) =>
                      draft
                        ? {
                            ...draft,
                            references: [
                              ...draft.references,
                              { key: crypto.randomUUID(), label: "", url: "" },
                            ],
                          }
                        : draft,
                    )
                  }
                >
                  <Plus aria-hidden="true" size={16} />
                  Add reference
                </button>
              </fieldset>
              {metadataError && (
                <p className="form-error" role="alert">
                  {metadataError}
                </p>
              )}
            </div>
            <footer className="material-panel-footer">
              <button
                className="button button-secondary"
                type="button"
                disabled={metadataFetcher.state !== "idle"}
                onClick={discardMetadataDraft}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={!metadataIsDirty || metadataFetcher.state !== "idle"}
              >
                <Check aria-hidden="true" size={16} />
                {metadataFetcher.state === "submitting" ? "Saving…" : "Save"}
              </button>
            </footer>
          </metadataFetcher.Form>
        )}
      </dialog>
    </>
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

function createMetadataDraft(
  material: MaterialTreeNode,
): MaterialMetadataDraft {
  return {
    description: material.description ?? "",
    references: material.references.map((reference) => ({
      key: reference.id,
      id: reference.id,
      label: reference.label ?? "",
      url: reference.url,
    })),
  };
}

function hasMetadataChanges(
  material: MaterialTreeNode,
  draft: MaterialMetadataDraft,
): boolean {
  return (
    draft.description !== (material.description ?? "") ||
    draft.references.length !== material.references.length ||
    draft.references.some((reference, index) => {
      const saved = material.references[index];
      return (
        saved === undefined ||
        reference.id !== saved.id ||
        reference.label !== (saved.label ?? "") ||
        reference.url !== saved.url
      );
    })
  );
}

function updateDraftReference(
  setDraftMetadata: Dispatch<SetStateAction<MaterialMetadataDraft | null>>,
  key: string,
  updates: Partial<
    Pick<MaterialMetadataDraft["references"][number], "label" | "url">
  >,
) {
  setDraftMetadata((draft) =>
    draft
      ? {
          ...draft,
          references: draft.references.map((reference) =>
            reference.key === key ? { ...reference, ...updates } : reference,
          ),
        }
      : draft,
  );
}
