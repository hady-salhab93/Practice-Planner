import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Link,
  redirect,
  useBlocker,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
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
  InvalidMaterialTagError,
  listLibraryMaterialPage,
  listArchivedMaterialTree,
  MaterialNotFoundError,
  MaterialTitleConflictError,
  searchLibraryMaterials,
  searchArchivedMaterials,
  restoreMaterial,
  updateMaterialMetadata,
  type MaterialTreeNode,
} from "@practice-planner/core/material-operations";
import {
  listTagGroups,
  listTags,
  createTag,
  createTagGroup,
  deleteTag,
  deleteTagGroup,
  getTagDeletionImpactCount,
  getTagGroupDeletionImpactCount,
  renameTag,
  renameTagGroup,
  ClassificationDeleteImpactChangedError,
  InvalidTagGroupNameError,
  InvalidTagNameError,
  TagGroupNameConflictError,
  TagGroupNotFoundError,
  TagNameConflictError,
  TagNotFoundError,
} from "@practice-planner/core/classification-operations";
import type {
  Tag as ClassificationTag,
  TagGroup,
} from "@practice-planner/core/schema";
import { getDatabase } from "@practice-planner/core/db.server";
import type { Route } from "./+types/home";

type MaterialMetadataDraft = {
  title: string;
  description: string;
  tagIds: string[];
  references: Array<{
    key: string;
    id?: string;
    label: string;
    url: string;
  }>;
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const requestedPage = parseLibraryPageParam(url.searchParams.get("page"));
  const database = getDatabase();
  const [libraryPage, archivedMaterials, tagGroups, tags] = await Promise.all([
    listLibraryMaterialPage(database, requestedPage),
    listArchivedMaterialTree(database),
    listTagGroups(database),
    listTags(database),
  ]);
  const currentPageParam = url.searchParams.get("page");
  if (
    currentPageParam !== null &&
    currentPageParam !== String(libraryPage.page)
  ) {
    url.searchParams.set("page", String(libraryPage.page));
    throw redirect(`${url.pathname}${url.search}${url.hash}`);
  }
  return { ...libraryPage, archivedMaterials, tagGroups, tags };
}

export function parseLibraryPageParam(value: string | null): number {
  if (value === null || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : Number.MAX_SAFE_INTEGER;
}

export function getLibraryPageSearch(search: string, page: number): string {
  const searchParams = new URLSearchParams(search);
  searchParams.set("page", String(page));
  return `?${searchParams.toString()}`;
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
    const tagIds = formData.getAll("tagId");
    const rawDescription = formData.get("description");
    if (
      typeof materialId !== "string" ||
      referenceIds.length !== referenceLabels.length ||
      referenceIds.length !== referenceUrls.length ||
      referenceIds.some((value) => typeof value !== "string") ||
      referenceLabels.some((value) => typeof value !== "string") ||
      referenceUrls.some((value) => typeof value !== "string") ||
      tagIds.some((value) => typeof value !== "string")
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
        tagIds: tagIds as string[],
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

  if (intent === "tag-group-create" || intent === "tag-group-rename") {
    const rawName = formData.get("name");
    const name = typeof rawName === "string" ? rawName : "";
    const groupId = formData.get("groupId");
    if (intent === "tag-group-rename" && typeof groupId !== "string") {
      return {
        ok: false,
        intent,
        id: "",
        message: "This Tag group is no longer available. Reload and try again.",
      };
    }

    try {
      const group =
        intent === "tag-group-create"
          ? await createTagGroup(getDatabase(), name)
          : await renameTagGroup(getDatabase(), groupId as string, name);
      return { ok: true, intent, id: group.id, name: group.name };
    } catch (error) {
      return {
        ok: false,
        intent,
        id: typeof groupId === "string" ? groupId : "",
        submittedName: name,
        message: getClassificationActionErrorMessage(error),
      };
    }
  }

  if (intent === "tag-create" || intent === "tag-rename") {
    const rawName = formData.get("name");
    const name = typeof rawName === "string" ? rawName : "";
    const tagId = formData.get("tagId");
    const groupId = formData.get("groupId");
    if (
      (intent === "tag-create" && typeof groupId !== "string") ||
      (intent === "tag-rename" && typeof tagId !== "string")
    ) {
      return {
        ok: false,
        intent,
        id: "",
        message: "This Tag is no longer available. Reload and try again.",
      };
    }

    try {
      const tag =
        intent === "tag-create"
          ? await createTag(getDatabase(), groupId as string, name)
          : await renameTag(getDatabase(), tagId as string, name);
      return {
        ok: true,
        intent,
        id: tag.id,
        groupId: tag.groupId,
        name: tag.name,
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        id: typeof tagId === "string" ? tagId : "",
        submittedName: name,
        message: getClassificationActionErrorMessage(error),
      };
    }
  }

  if (intent === "tag-delete-preview") {
    const entity = formData.get("entity");
    const id = formData.get("id");
    if ((entity !== "group" && entity !== "tag") || typeof id !== "string") {
      return {
        ok: false,
        intent,
        entity: "tag",
        id: "",
        message: "Could not check the deletion impact. Try again.",
      };
    }

    try {
      const affectedMaterialCount =
        entity === "group"
          ? await getTagGroupDeletionImpactCount(getDatabase(), id)
          : await getTagDeletionImpactCount(getDatabase(), id);
      return { ok: true, intent, entity, id, affectedMaterialCount };
    } catch (error) {
      return {
        ok: false,
        intent,
        entity,
        id,
        message: getClassificationActionErrorMessage(error),
      };
    }
  }

  if (intent === "tag-delete" || intent === "tag-group-delete") {
    const entity = intent === "tag-group-delete" ? "group" : "tag";
    const id = formData.get("id");
    const rawExpectedCount = formData.get("affectedMaterialCount");
    const expectedAffectedMaterialCount = Number(rawExpectedCount);
    if (
      typeof id !== "string" ||
      typeof rawExpectedCount !== "string" ||
      !Number.isSafeInteger(expectedAffectedMaterialCount) ||
      expectedAffectedMaterialCount < 0
    ) {
      return {
        ok: false,
        intent,
        entity,
        id: typeof id === "string" ? id : "",
        message:
          "Could not confirm this deletion. Check the impact and try again.",
      };
    }

    try {
      const affectedMaterialCount =
        entity === "group"
          ? await deleteTagGroup(
              getDatabase(),
              id,
              expectedAffectedMaterialCount,
            )
          : await deleteTag(getDatabase(), id, expectedAffectedMaterialCount);
      return { ok: true, intent, entity, id, affectedMaterialCount };
    } catch (error) {
      return {
        ok: false,
        intent,
        entity,
        id,
        ...(error instanceof ClassificationDeleteImpactChangedError
          ? {
              impactChanged: true,
              affectedMaterialCount: error.affectedMaterialCount,
            }
          : {}),
        message: getClassificationActionErrorMessage(error),
      };
    }
  }

  return {
    ok: false,
    intent: "invalid",
    message: "This Library action is not supported.",
  };
}

function getClassificationActionErrorMessage(error: unknown): string {
  if (error instanceof InvalidTagGroupNameError) return error.message;
  if (error instanceof TagGroupNameConflictError) return error.message;
  if (error instanceof TagGroupNotFoundError) return error.message;
  if (error instanceof InvalidTagNameError) return error.message;
  if (error instanceof TagNameConflictError) return error.message;
  if (error instanceof TagNotFoundError) return error.message;
  if (error instanceof ClassificationDeleteImpactChangedError) {
    return `${error.message} It now affects ${error.affectedMaterialCount} Material.`;
  }
  return "Could not update classification. Your input is still here; try again.";
}

function getActionErrorMessage(
  error: unknown,
  fallback = "Could not save this Material. Your title is still here; try again.",
): string {
  if (error instanceof InvalidMaterialReferenceError) return error.message;
  if (error instanceof InvalidMaterialTagError) return error.message;
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
  const {
    materials,
    archivedMaterials,
    tagGroups,
    tags,
    page,
    pageCount,
    standaloneTotal,
    materialTotal,
  } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const createFetcher = useFetcher<typeof action>();
  const searchFetcher = useFetcher<typeof action>();
  const archiveFetcher = useFetcher<typeof action>();
  const metadataFetcher = useFetcher<typeof action>();
  const [view, setView] = useState<"library" | "archive">("library");
  const [isManagingTags, setIsManagingTags] = useState(false);
  const manageTagsButtonRef = useRef<HTMLButtonElement>(null);
  const wasManagingTagsOpen = useRef(false);
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
  const isPageNavigation =
    navigation.state !== "idle" &&
    navigation.location?.pathname === location.pathname &&
    navigation.location.search !== location.search;
  const pendingPage = isPageNavigation
    ? parseLibraryPageParam(
        new URLSearchParams(navigation.location?.search ?? "").get("page"),
      )
    : page;
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
  const submittedCreateDraft = submittedCreate.current;
  const successfulRootCreate =
    createFetcher.state === "idle" &&
    createFetcher.data?.intent === "create" &&
    createFetcher.data.ok &&
    createFetcher.data.parentId === null &&
    submittedCreateDraft !== null &&
    submittedCreateDraft.parentId === null &&
    submittedCreateDraft.title === createTitle &&
    createFetcher.data.submittedTitle === createTitle;
  const isDirty =
    (createTitle.length > 0 && !successfulRootCreate) ||
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
    if (isManagingTags) {
      wasManagingTagsOpen.current = true;
      return;
    }
    if (wasManagingTagsOpen.current) {
      manageTagsButtonRef.current?.focus();
      wasManagingTagsOpen.current = false;
    }
  }, [isManagingTags]);

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
      if (submitted.parentId === null && page !== pageCount) {
        navigate({
          pathname: location.pathname,
          search: getLibraryPageSearch(location.search, pageCount),
          hash: location.hash,
        });
      }
    }
    submittedCreate.current = null;
  }, [
    childDrafts,
    createFetcher.data,
    createFetcher.state,
    createTitle,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    page,
    pageCount,
  ]);

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
  const materialCount =
    view === "library" ? materialTotal : countMaterials(archivedMaterials);

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
              className="button button-secondary panel-close"
              aria-label={`Actions for ${material.title}`}
              title={`Actions for ${material.title}`}
            >
              <EllipsisVertical aria-hidden="true" size={16} />
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
                <button
                  ref={manageTagsButtonRef}
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsManagingTags(true)}
                >
                  <Tag aria-hidden="true" size={16} />
                  Manage Tags
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
          {view === "library" && !searchResults && pageCount > 1 && (
            <nav
              className="library-pagination"
              aria-label="Library pages"
              aria-busy={isPageNavigation}
            >
              {page > 1 ? (
                <Link
                  className="button button-secondary"
                  to={{
                    pathname: location.pathname,
                    search: getLibraryPageSearch(location.search, page - 1),
                    hash: location.hash,
                  }}
                  aria-label="Previous page"
                >
                  Previous
                </Link>
              ) : (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled
                  aria-label="Previous page"
                >
                  Previous
                </button>
              )}
              <p className="library-pagination-status" aria-live="polite">
                {isPageNavigation
                  ? `Loading page ${pendingPage}…`
                  : `Page ${page} of ${pageCount} · ${standaloneTotal} standalone ${
                      standaloneTotal === 1 ? "Material" : "Materials"
                    }`}
              </p>
              {page < pageCount ? (
                <Link
                  className="button button-secondary"
                  to={{
                    pathname: location.pathname,
                    search: getLibraryPageSearch(location.search, page + 1),
                    hash: location.hash,
                  }}
                  aria-label="Next page"
                >
                  Next
                </Link>
              ) : (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled
                  aria-label="Next page"
                >
                  Next
                </button>
              )}
            </nav>
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
              <fieldset className="reference-editor tag-assignment-editor">
                <legend>Tags</legend>
                {tagGroups.length === 0 ? (
                  <p>No Tag groups yet. Create one to classify Material.</p>
                ) : (
                  tagGroups.map((group) => {
                    const groupTags = tags.filter(
                      (tag) => tag.groupId === group.id,
                    );
                    return (
                      <fieldset className="tag-assignment-group" key={group.id}>
                        <legend>{group.name}</legend>
                        {groupTags.length === 0 ? (
                          <p>No Tags in this group yet.</p>
                        ) : (
                          groupTags.map((tag) => (
                            <label
                              className="tag-assignment-option"
                              key={tag.id}
                            >
                              <input
                                type="checkbox"
                                name="tagId"
                                value={tag.id}
                                checked={draftMetadata.tagIds.includes(tag.id)}
                                disabled={metadataFetcher.state !== "idle"}
                                onChange={(event) => {
                                  const checked = event.currentTarget.checked;
                                  setDraftMetadata((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          tagIds: checked
                                            ? [...draft.tagIds, tag.id]
                                            : draft.tagIds.filter(
                                                (id) => id !== tag.id,
                                              ),
                                        }
                                      : draft,
                                  );
                                }}
                              />
                              {tag.name}
                            </label>
                          ))
                        )}
                      </fieldset>
                    );
                  })
                )}
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
      <ManageTagsDialog
        isOpen={isManagingTags}
        groups={tagGroups}
        tags={tags}
        onClose={() => setIsManagingTags(false)}
      />
    </>
  );
}

type PendingClassificationDeletion = {
  entity: "group" | "tag";
  id: string;
  name: string;
  affectedMaterialCount?: number;
};

function ManageTagsDialog({
  isOpen,
  groups,
  tags,
  onClose,
}: {
  isOpen: boolean;
  groups: TagGroup[];
  tags: ClassificationTag[];
  onClose: () => void;
}) {
  const fetcher = useFetcher<typeof action>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [groupName, setGroupName] = useState("");
  const [tagNames, setTagNames] = useState<Record<string, string>>({});
  const [editingGroup, setEditingGroup] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingTag, setEditingTag] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingClassificationDeletion | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isBusy = fetcher.state !== "idle";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const result = fetcher.data;
    if (!result.ok) {
      setErrorMessage(
        "message" in result && typeof result.message === "string"
          ? result.message
          : "Could not update classification. Your input is still here; try again.",
      );
      if (
        (result.intent === "tag-delete" ||
          result.intent === "tag-group-delete") &&
        "impactChanged" in result &&
        result.impactChanged
      ) {
        setPendingDeletion((current) =>
          current
            ? {
                ...current,
                affectedMaterialCount:
                  "affectedMaterialCount" in result &&
                  typeof result.affectedMaterialCount === "number"
                    ? result.affectedMaterialCount
                    : current.affectedMaterialCount,
              }
            : current,
        );
      }
      return;
    }

    setErrorMessage(null);
    if (result.intent === "tag-group-create") {
      setGroupName("");
      setStatusMessage("Tag group created.");
    } else if (result.intent === "tag-group-rename") {
      setEditingGroup(null);
      setStatusMessage("Tag group renamed.");
    } else if (result.intent === "tag-create") {
      if ("groupId" in result && typeof result.groupId === "string") {
        setTagNames((drafts) => ({ ...drafts, [result.groupId]: "" }));
      }
      setStatusMessage("Tag created.");
    } else if (result.intent === "tag-rename") {
      setEditingTag(null);
      setStatusMessage("Tag renamed.");
    } else if (result.intent === "tag-delete-preview") {
      setPendingDeletion((current) =>
        current && current.id === result.id
          ? {
              ...current,
              affectedMaterialCount: result.affectedMaterialCount,
            }
          : current,
      );
    } else if (
      result.intent === "tag-delete" ||
      result.intent === "tag-group-delete"
    ) {
      setPendingDeletion(null);
      setStatusMessage(
        `${result.entity === "group" ? "Tag group" : "Tag"} deleted.`,
      );
    }
  }, [fetcher.data, fetcher.state]);

  function startDeletion(entity: "group" | "tag", id: string, name: string) {
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingDeletion({ entity, id, name });
    void fetcher.submit(
      { intent: "tag-delete-preview", entity, id },
      { method: "post" },
    );
  }

  function confirmDeletion() {
    if (!pendingDeletion || pendingDeletion.affectedMaterialCount === undefined)
      return;
    setErrorMessage(null);
    void fetcher.submit(
      {
        intent:
          pendingDeletion.entity === "group"
            ? "tag-group-delete"
            : "tag-delete",
        id: pendingDeletion.id,
        affectedMaterialCount: String(pendingDeletion.affectedMaterialCount),
      },
      { method: "post" },
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="material-panel manage-tags-panel"
      aria-labelledby="manage-tags-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="material-panel-form">
        <header className="material-panel-header">
          <div>
            <p className="page-context">Library</p>
            <h2 id="manage-tags-title">Manage Tags</h2>
          </div>
          <button
            className="button button-secondary panel-close"
            type="button"
            aria-label="Close Manage Tags"
            title="Close"
            disabled={isBusy}
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        <div className="material-panel-content manage-tags-content">
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          {statusMessage && (
            <p className="sprint-timezone" role="status">
              {statusMessage}
            </p>
          )}
          <fetcher.Form
            className="tag-management-create"
            method="post"
            onSubmit={() => {
              setErrorMessage(null);
              setStatusMessage(null);
            }}
          >
            <input type="hidden" name="intent" value="tag-group-create" />
            <label htmlFor="new-tag-group-name">New Tag group</label>
            <div className="form-row">
              <input
                id="new-tag-group-name"
                name="name"
                required
                value={groupName}
                disabled={isBusy}
                onChange={(event) => {
                  setGroupName(event.currentTarget.value);
                  setErrorMessage(null);
                }}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={!groupName.trim() || isBusy}
              >
                <Plus aria-hidden="true" size={16} />
                Add group
              </button>
            </div>
          </fetcher.Form>

          {groups.length === 0 ? (
            <p className="empty-state">No Tag groups yet.</p>
          ) : (
            <div className="tag-management-groups">
              {groups.map((group) => {
                const groupTags = tags.filter(
                  (tag) => tag.groupId === group.id,
                );
                const groupDraft =
                  editingGroup?.id === group.id ? editingGroup : null;
                return (
                  <section
                    className="tag-management-group"
                    key={group.id}
                    aria-labelledby={`tag-group-${group.id}`}
                  >
                    <div className="tag-management-heading">
                      <h3 id={`tag-group-${group.id}`}>{group.name}</h3>
                      <div className="tag-management-actions">
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            setEditingGroup({ id: group.id, name: group.name })
                          }
                        >
                          <Pencil aria-hidden="true" size={16} />
                          Rename
                        </button>
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            startDeletion("group", group.id, group.name)
                          }
                        >
                          <Trash2 aria-hidden="true" size={16} />
                          Delete
                        </button>
                      </div>
                    </div>
                    {groupDraft && (
                      <fetcher.Form
                        className="tag-management-edit"
                        method="post"
                        onSubmit={() => {
                          setErrorMessage(null);
                          setStatusMessage(null);
                        }}
                      >
                        <input
                          type="hidden"
                          name="intent"
                          value="tag-group-rename"
                        />
                        <input type="hidden" name="groupId" value={group.id} />
                        <label htmlFor={`rename-group-${group.id}`}>
                          Tag group name
                        </label>
                        <div className="form-row">
                          <input
                            id={`rename-group-${group.id}`}
                            name="name"
                            required
                            value={groupDraft.name}
                            disabled={isBusy}
                            onChange={(event) => {
                              setEditingGroup({
                                id: group.id,
                                name: event.currentTarget.value,
                              });
                              setErrorMessage(null);
                            }}
                          />
                          <button
                            className="button button-primary"
                            type="submit"
                            disabled={!groupDraft.name.trim() || isBusy}
                          >
                            Save name
                          </button>
                          <button
                            className="button button-secondary"
                            type="button"
                            disabled={isBusy}
                            onClick={() => setEditingGroup(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </fetcher.Form>
                    )}

                    {groupTags.length > 0 && (
                      <ul className="tag-management-list">
                        {groupTags.map((tag) => {
                          const tagDraft =
                            editingTag?.id === tag.id ? editingTag : null;
                          return (
                            <li key={tag.id}>
                              {tagDraft ? (
                                <fetcher.Form
                                  className="tag-management-edit"
                                  method="post"
                                  onSubmit={() => {
                                    setErrorMessage(null);
                                    setStatusMessage(null);
                                  }}
                                >
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="tag-rename"
                                  />
                                  <input
                                    type="hidden"
                                    name="tagId"
                                    value={tag.id}
                                  />
                                  <label htmlFor={`rename-tag-${tag.id}`}>
                                    Tag name
                                  </label>
                                  <div className="form-row">
                                    <input
                                      id={`rename-tag-${tag.id}`}
                                      name="name"
                                      required
                                      value={tagDraft.name}
                                      disabled={isBusy}
                                      onChange={(event) => {
                                        setEditingTag({
                                          id: tag.id,
                                          name: event.currentTarget.value,
                                        });
                                        setErrorMessage(null);
                                      }}
                                    />
                                    <button
                                      className="button button-primary"
                                      type="submit"
                                      disabled={!tagDraft.name.trim() || isBusy}
                                    >
                                      Save name
                                    </button>
                                    <button
                                      className="button button-secondary"
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => setEditingTag(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </fetcher.Form>
                              ) : (
                                <>
                                  <span>{tag.name}</span>
                                  <div className="tag-management-actions">
                                    <button
                                      className="button button-secondary"
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        setEditingTag({
                                          id: tag.id,
                                          name: tag.name,
                                        })
                                      }
                                    >
                                      <Pencil aria-hidden="true" size={16} />
                                      Rename
                                    </button>
                                    <button
                                      className="button button-secondary"
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        startDeletion("tag", tag.id, tag.name)
                                      }
                                    >
                                      <Trash2 aria-hidden="true" size={16} />
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <fetcher.Form
                      className="tag-management-create tag-create-row"
                      method="post"
                      onSubmit={() => {
                        setErrorMessage(null);
                        setStatusMessage(null);
                      }}
                    >
                      <input type="hidden" name="intent" value="tag-create" />
                      <input type="hidden" name="groupId" value={group.id} />
                      <label htmlFor={`new-tag-${group.id}`}>New Tag</label>
                      <div className="form-row">
                        <input
                          id={`new-tag-${group.id}`}
                          name="name"
                          required
                          value={tagNames[group.id] ?? ""}
                          disabled={isBusy}
                          onChange={(event) => {
                            const name = event.currentTarget.value;
                            setTagNames((drafts) => ({
                              ...drafts,
                              [group.id]: name,
                            }));
                            setErrorMessage(null);
                          }}
                        />
                        <button
                          className="button button-secondary"
                          type="submit"
                          disabled={
                            !(tagNames[group.id] ?? "").trim() || isBusy
                          }
                        >
                          <Plus aria-hidden="true" size={16} />
                          Add Tag
                        </button>
                      </div>
                    </fetcher.Form>
                  </section>
                );
              })}
            </div>
          )}

          {pendingDeletion && (
            <section
              className="tag-delete-confirmation"
              aria-labelledby="tag-delete-title"
              aria-live="polite"
            >
              <h3 id="tag-delete-title">
                Delete{" "}
                {pendingDeletion.entity === "group" ? "Tag group" : "Tag"}?
              </h3>
              <p>
                “{pendingDeletion.name}” will be removed from{" "}
                {pendingDeletion.entity === "group"
                  ? "this group and its Tags"
                  : "the classification vocabulary"}
                .
                {pendingDeletion.affectedMaterialCount === undefined
                  ? " Checking affected Material…"
                  : ` This removes classification from ${pendingDeletion.affectedMaterialCount} ${pendingDeletion.affectedMaterialCount === 1 ? "Material" : "Materials"}. Material and practice records remain.`}
              </p>
              <div className="tag-management-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={isBusy}
                  onClick={() => setPendingDeletion(null)}
                >
                  Cancel
                </button>
                {pendingDeletion.affectedMaterialCount === undefined ? (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      startDeletion(
                        pendingDeletion.entity,
                        pendingDeletion.id,
                        pendingDeletion.name,
                      )
                    }
                  >
                    Check impact
                  </button>
                ) : (
                  <button
                    className="button button-danger"
                    type="button"
                    disabled={isBusy}
                    onClick={confirmDeletion}
                  >
                    Delete{" "}
                    {pendingDeletion.entity === "group" ? "group" : "Tag"}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </dialog>
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
    tagIds: material.tags.map((tag) => tag.id),
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
  const currentTagIds = new Set(material.tags.map((tag) => tag.id));
  return (
    draft.title !== material.title ||
    draft.description !== (material.description ?? "") ||
    draft.tagIds.length !== currentTagIds.size ||
    draft.tagIds.some((tagId) => !currentTagIds.has(tagId)) ||
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
