import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useBlocker, useFetcher, useLoaderData } from "react-router";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  archiveMaterial,
  ArchivedMaterialParentError,
  MaterialArchiveRootOnlyError,
  createChildMaterial,
  createStandaloneMaterial,
  InvalidMaterialTitleError,
  InvalidMaterialReferenceError,
  listLibraryMaterialTree,
  listArchivedMaterialTree,
  MaterialNotFoundError,
  MaterialTitleConflictError,
  searchLibraryMaterials,
  searchArchivedMaterials,
  restoreMaterial,
  updateMaterialMetadata,
  type MaterialTreeNode,
} from "@practice-planner/core/material-operations";
import { getDatabase } from "@practice-planner/core/db.server";
import type { Route } from "./+types/home";

type MaterialMetadataDraft = {
  title: string;
  description: string;
  references: Array<{
    key: string;
    id?: string;
    label: string;
    url: string;
  }>;
};

export async function loader() {
  const database = getDatabase();
  const [materials, archivedMaterials] = await Promise.all([
    listLibraryMaterialTree(database),
    listArchivedMaterialTree(database),
  ]);
  return { materials, archivedMaterials };
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: {
  actionResult?: unknown;
  defaultShouldRevalidate: boolean;
}) {
  if (
    typeof actionResult === "object" &&
    actionResult !== null &&
    "intent" in actionResult &&
    actionResult.intent === "search"
  ) {
    return false;
  }
  if (isFailedAction(actionResult)) return false;
  return defaultShouldRevalidate;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const rawTitle = formData.get("title");
  const submittedTitle = typeof rawTitle === "string" ? rawTitle : "";

  if (intent === "create") {
    const rawParentId = formData.get("parentId");
    const parentId = typeof rawParentId === "string" ? rawParentId : null;
    try {
      const database = getDatabase();
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

  if (intent === "search") {
    const rawQuery = formData.get("query");
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    const rawScope = formData.get("scope");
    const scope = rawScope === "archive" ? "archive" : "library";
    if (!query) {
      return {
        ok: false,
        intent,
        scope,
        query,
        message: `Enter a title to search ${scope === "archive" ? "archived Material" : "the Library"}.`,
      };
    }

    try {
      const results =
        scope === "archive"
          ? await searchArchivedMaterials(getDatabase(), query)
          : await searchLibraryMaterials(getDatabase(), query);
      return { ok: true, intent, scope, query, results };
    } catch {
      return {
        ok: false,
        intent,
        scope,
        query,
        message: `Could not search ${scope === "archive" ? "archived Material" : "the Library"}. Your search is still here; try again.`,
      };
    }
  }

  if (intent === "archive" || intent === "restore") {
    const materialId = formData.get("materialId");
    if (typeof materialId !== "string") {
      return {
        ok: false,
        intent,
        materialId: "",
        message: "Could not update this Material's archive state. Try again.",
      };
    }

    try {
      const update = intent === "archive" ? archiveMaterial : restoreMaterial;
      await update(getDatabase(), materialId);
      return { ok: true, intent, materialId };
    } catch (error) {
      return {
        ok: false,
        intent,
        materialId,
        message: getActionErrorMessage(
          error,
          "Could not update this Material's archive state. Try again.",
        ),
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
      await updateMaterialMetadata(getDatabase(), materialId, {
        title: submittedTitle,
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

function getActionErrorMessage(
  error: unknown,
  fallback = "Could not save this Material. Your title is still here; try again.",
): string {
  if (error instanceof InvalidMaterialReferenceError) return error.message;
  if (error instanceof InvalidMaterialTitleError)
    return "Enter a title for this Material.";
  if (error instanceof MaterialTitleConflictError) {
    return `“${error.conflictingMaterial.title}” already exists in this group. Choose a different title.`;
  }
  if (error instanceof MaterialNotFoundError)
    return "This Material is no longer in the Library. Reload and try again.";
  if (
    error instanceof MaterialArchiveRootOnlyError ||
    error instanceof ArchivedMaterialParentError
  )
    return error.message;
  return fallback;
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
  const { materials, archivedMaterials } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<typeof action>();
  const searchFetcher = useFetcher<typeof action>();
  const archiveFetcher = useFetcher<typeof action>();
  const metadataFetcher = useFetcher<typeof action>();
  const [view, setView] = useState<"library" | "archive">("library");
  const [createTitle, setCreateTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [childDrafts, setChildDrafts] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(
    null,
  );
  const [draftMetadata, setDraftMetadata] =
    useState<MaterialMetadataDraft | null>(null);
  const [metadataErrorId, setMetadataErrorId] = useState<string | null>(null);
  const pendingMaterialFocusId = useRef<string | null>(null);
  const metadataPanelRef = useRef<HTMLDialogElement>(null);
  const submittedCreate = useRef<{
    parentId: string | null;
    title: string;
  } | null>(null);
  const submittedMetadataId = useRef<string | null>(null);
  const visibleMaterials = view === "library" ? materials : archivedMaterials;
  const editingMetadataMaterial = findMaterial(
    visibleMaterials,
    editingMetadataId,
  );
  const currentSearch =
    searchFetcher.data?.intent === "search" &&
    searchFetcher.data.scope === view &&
    searchFetcher.data.query === searchQuery.trim()
      ? searchFetcher.data
      : undefined;
  const searchResults =
    currentSearch?.intent === "search" &&
    currentSearch.ok &&
    "results" in currentSearch
      ? currentSearch.results
      : undefined;
  const metadataIsDirty =
    editingMetadataMaterial !== undefined &&
    draftMetadata !== null &&
    hasMetadataChanges(editingMetadataMaterial, draftMetadata);
  const isDirty =
    createTitle.length > 0 ||
    Object.values(childDrafts).some((title) => title.length > 0) ||
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

  useEffect(() => {
    const materialId = pendingMaterialFocusId.current;
    if (materialId === null) return;
    const element = document.getElementById(`material-${materialId}`);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest" });
    pendingMaterialFocusId.current = null;
  }, [expandedIds, searchQuery]);

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
  const materialCount = countMaterials(visibleMaterials);

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

  function openMaterialInContext(result: {
    id: string;
    ancestorPath: Array<{ id: string; title: string }>;
  }) {
    pendingMaterialFocusId.current = result.id;
    setExpandedIds((ids) => {
      const nextIds = new Set(ids);
      for (const ancestor of result.ancestorPath) nextIds.add(ancestor.id);
      return nextIds;
    });
    setSearchQuery("");
  }

  function renderMaterial(material: MaterialTreeNode, isRoot: boolean) {
    const childTitle = childDrafts[material.id] ?? "";
    const childError =
      createFetcher.data?.intent === "create" &&
      !createFetcher.data.ok &&
      createFetcher.data.parentId === material.id &&
      createFetcher.data.submittedTitle === childTitle
        ? createFetcher.data.message
        : undefined;
    const hasChildren =
      material.children.length > 0 ||
      (view === "library" && material.id in childDrafts);
    const isExpanded = expandedIds.has(material.id);

    return (
      <li
        className="material-node"
        id={`material-${material.id}`}
        key={material.id}
        tabIndex={-1}
      >
        <div className="material-row">
          <div className="material-heading">
            {view === "library" ? (
              <button
                className="material-disclosure material-add-child"
                type="button"
                aria-label={`Add child to ${material.title}`}
                title={`Add child to ${material.title}`}
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
              </button>
            ) : (
              <span className="material-disclosure-spacer" />
            )}
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
          <details
            className="material-actions-menu"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.open = false;
              }
            }}
          >
            <summary
              className="button button-secondary"
              aria-label={`Actions for ${material.title}`}
            >
              Actions
            </summary>
            <div className="material-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={editingMetadataId !== null}
                onClick={() => {
                  setEditingMetadataId(material.id);
                  setDraftMetadata(createMetadataDraft(material));
                  setMetadataErrorId(null);
                }}
              >
                <Pencil aria-hidden="true" size={16} />
                Edit details
              </button>
              {isRoot && view === "library" && (
                <archiveFetcher.Form method="post">
                  <input type="hidden" name="intent" value="archive" />
                  <input type="hidden" name="materialId" value={material.id} />
                  <button
                    className="button button-secondary"
                    type="submit"
                    title={`Archive ${material.title} and its descendants`}
                    disabled={archiveFetcher.state !== "idle"}
                  >
                    <Archive aria-hidden="true" size={16} />
                    Archive
                  </button>
                </archiveFetcher.Form>
              )}
              {isRoot && view === "archive" && (
                <archiveFetcher.Form method="post">
                  <input type="hidden" name="intent" value="restore" />
                  <input type="hidden" name="materialId" value={material.id} />
                  <button
                    className="button button-secondary"
                    type="submit"
                    title={`Restore ${material.title} and its descendants`}
                    disabled={archiveFetcher.state !== "idle"}
                  >
                    <RotateCcw aria-hidden="true" size={16} />
                    Restore
                  </button>
                </archiveFetcher.Form>
              )}
            </div>
          </details>
        </div>
        {hasChildren && (
          <ul
            className="material-list material-children"
            id={`material-children-${material.id}`}
            hidden={!isExpanded}
          >
            {material.children.map((child) => renderMaterial(child, false))}
            {view === "library" && material.id in childDrafts && (
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

        {view === "library" && (
          <section
            className="capture-section"
            aria-labelledby="capture-heading"
          >
            <h2 id="capture-heading">Add Material</h2>
            <createFetcher.Form
              method="post"
              className="capture-form"
              onSubmit={() => {
                submittedCreate.current = {
                  parentId: null,
                  title: createTitle,
                };
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
                  onChange={(event) =>
                    setCreateTitle(event.currentTarget.value)
                  }
                  aria-describedby={
                    createError ? "create-material-error" : undefined
                  }
                />
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={
                    !createTitle.trim() || createFetcher.state !== "idle"
                  }
                >
                  <Plus aria-hidden="true" size={16} />
                  {createFetcher.state === "submitting"
                    ? "Adding…"
                    : "Add Material"}
                </button>
              </div>
              {createError && (
                <p
                  className="form-error"
                  id="create-material-error"
                  role="alert"
                >
                  {createError}
                </p>
              )}
            </createFetcher.Form>
          </section>
        )}

        <section className="library-section" aria-labelledby="library-heading">
          <div className="section-heading">
            <div className="library-heading">
              <h2 id="library-heading">
                {view === "library" ? "Your Library" : "Archived Material"}
              </h2>
              <nav className="library-views" aria-label="Material views">
                <button
                  className="button button-secondary"
                  type="button"
                  aria-pressed={view === "library"}
                  onClick={() => {
                    setView("library");
                    setSearchQuery("");
                  }}
                >
                  Library
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  aria-pressed={view === "archive"}
                  onClick={() => {
                    setView("archive");
                    setSearchQuery("");
                  }}
                >
                  Archived
                </button>
              </nav>
            </div>
            <searchFetcher.Form
              method="post"
              role="search"
              className="library-search"
            >
              <input type="hidden" name="intent" value="search" />
              <input type="hidden" name="scope" value={view} />
              <label htmlFor="library-search-query">
                {view === "library"
                  ? "Search Library titles"
                  : "Search archived titles"}
              </label>
              <div className="library-search-controls">
                <input
                  id="library-search-query"
                  name="query"
                  type="search"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.currentTarget.value)
                  }
                  aria-describedby={
                    currentSearch?.intent === "search" && !currentSearch.ok
                      ? "library-search-error"
                      : undefined
                  }
                />
                <button
                  className="button button-secondary"
                  type="submit"
                  disabled={
                    !searchQuery.trim() || searchFetcher.state !== "idle"
                  }
                >
                  <Search aria-hidden="true" size={16} />
                  {searchFetcher.state === "submitting"
                    ? "Searching…"
                    : "Search"}
                </button>
              </div>
            </searchFetcher.Form>
          </div>
          {currentSearch?.intent === "search" && !currentSearch.ok && (
            <p
              className="form-error search-error"
              id="library-search-error"
              role="alert"
            >
              {currentSearch.message}
            </p>
          )}
          {archiveFetcher.data?.intent ===
            (view === "library" ? "archive" : "restore") &&
            !archiveFetcher.data.ok && (
              <p className="form-error" role="alert">
                {archiveFetcher.data.message}
              </p>
            )}
          {searchResults ? (
            searchResults.length === 0 ? (
              <p className="empty-state" role="status">
                No Material titles found for “{searchQuery.trim()}”.
              </p>
            ) : (
              <ul className="search-results" aria-label="Search results">
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      className="search-result"
                      type="button"
                      onClick={() => openMaterialInContext(result)}
                    >
                      <span className="search-result-title">
                        {result.title}
                      </span>
                      <span className="search-result-path">
                        {result.ancestorPath.length > 0
                          ? result.ancestorPath
                              .map((ancestor) => ancestor.title)
                              .join(" › ")
                          : "Library"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : visibleMaterials.length === 0 ? (
            view === "library" ? (
              <p className="empty-state">
                No Materials yet. Add a title to start your Library.
              </p>
            ) : (
              <p className="empty-state">No archived Material.</p>
            )
          ) : (
            <ul
              className="material-list"
              aria-label={
                view === "library" ? "Library Materials" : "Archived Material"
              }
            >
              {visibleMaterials.map((material) =>
                renderMaterial(material, true),
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
              <label htmlFor="material-panel-title-input">Title</label>
              <input
                id="material-panel-title-input"
                name="title"
                required
                value={draftMetadata.title}
                onChange={(event) => {
                  const title = event.currentTarget.value;
                  setDraftMetadata((draft) =>
                    draft ? { ...draft, title } : draft,
                  );
                }}
                disabled={metadataFetcher.state !== "idle"}
                aria-describedby={
                  metadataError ? "material-panel-error" : undefined
                }
              />
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
                <p
                  className="form-error"
                  id="material-panel-error"
                  role="alert"
                >
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
                disabled={
                  !draftMetadata.title.trim() ||
                  !metadataIsDirty ||
                  metadataFetcher.state !== "idle"
                }
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
    title: material.title,
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
    draft.title !== material.title ||
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
