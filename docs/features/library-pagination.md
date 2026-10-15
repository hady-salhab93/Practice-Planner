---
status: specified
specified_on: 2026-10-14
---

# Library Pagination And Release Simplification

## Problem Statement

The guitarist needs a useful, uncomplicated Library for organizing practice
Material. User-controlled ordering and moving Material are unnecessary for this
release, and their intended behavior needs more thought. A growing Library
instead needs manageable pages without losing nested context or disrupting
capture and editing.

## Solution

Remove title-sort and move capabilities from this release, preserve existing
Material and its saved hierarchy, and replace those release workstreams with
simple Library pagination. Browse standalone Material in bounded pages, keeping
each Material's descendants together. Preserve deterministic saved sibling order
internally; do not expose sorting, manual ordering, drag-and-drop, or relocation.

## User Stories

1. As a guitarist, I want a Library without sorting controls, so that I can focus on capturing and practicing Material rather than arranging it.
2. As a guitarist, I want moving Material deferred, so that I can decide what reorganization should mean before it becomes part of my workflow.
3. As a guitarist, I want existing Material preserved when these capabilities are removed, so that a release-scope change does not lose my work.
4. As a guitarist, I want the Library divided into manageable pages, so that a large collection is easier to browse.
5. As a guitarist, I want pages to contain standalone Material together with their nested children, so that a book, song, or exercise hierarchy is not split across pages.
6. As a guitarist, I want to expand and collapse children on the current page, so that I can browse breakdowns in context.
7. As a guitarist, I want sibling groups displayed in their existing saved sequence, so that returning to the Library does not arbitrarily reshuffle Material.
8. As a guitarist, I want Previous and Next controls, so that I can navigate without scrolling through the entire Library.
9. As a guitarist, I want to see my current page and the number of available pages, so that I understand my location.
10. As a guitarist, I want clear first-page and last-page states, so that navigation never leads to an unavailable page.
11. As a guitarist, I want reloading to retain the current page, so that I can resume browsing where I was.
12. As a guitarist, I want browser Back and Forward to restore visited pages, so that Library navigation behaves predictably.
13. As a guitarist, I want an empty Library to retain its helpful capture prompt, so that I know how to begin.
14. As a guitarist, I want invalid or outdated page links to resolve to a valid page, so that bookmarks do not strand me on an empty or broken screen.
15. As a guitarist, I want adding standalone Material to reveal it on its page after a successful save, so that I can see what I just captured.
16. As a guitarist, I want adding a child to retain the current parent context, so that breakdown does not unexpectedly navigate away.
17. As a guitarist, I want renaming or editing details to preserve the current page, so that editing does not disrupt browsing.
18. As a guitarist, I want page navigation to respect the existing unsaved-change warning, so that changing pages cannot silently discard my drafts.
19. As a guitarist, I want failed saves to retain input and show a recoverable error, so that pagination does not weaken existing editing behavior.
20. As a keyboard user, I want clearly named, focus-visible page controls, so that I can navigate without a pointer.
21. As a guitarist on a narrow screen, I want page controls and nested Material to remain usable, so that pagination does not create horizontal overflow or hide actions.
22. As a guitarist, I want pagination to leave titles, descriptions, reference links, identities, parentage, and saved positions unchanged, so that browsing is a read-only operation.
23. As a guitarist, I want sorting and moving retained as future discovery topics, so that deferring them does not pretend their previous requirements are ready for implementation.

## Implementation Decisions

- Retain the accepted full-stack React Router architecture. The Library route's
  server loader calls the existing core Material operations; PostgreSQL stays
  server-side. Do not introduce a separate API, transport, or state library.
- Remove title-sort controls, sort URL-state interpretation, the tree sorter,
  move controls and drafts, the move action intent and operation, the move-only
  error type, and feature-only styles and tests. Unsupported move submissions
  use the existing unsupported-action response; old sort query parameters have
  no effect.
- Preserve tables, migrations, saved sibling positions, parent relationships,
  metadata, and reference identities. Do not reverse already persisted moves.
  Removing configurable ordering does not mean randomizing the list.
- Page standalone Material, not flattened descendants. Each selected root keeps
  its complete nested subtree and references. A large single subtree may still
  be large; separately paging children is excluded.
- Use saved sibling sequence with a stable identity tie-breaker. Renaming does
  not change page membership.
- Use a fixed default of 20 standalone Material per page. This is a synthesized
  implementation default, not a user-selected product preference. No page-size
  picker or infinite-scroll mode is required.
- Represent the current page in the URL with a positive, one-based page number.
  Missing, malformed, zero, and negative values resolve to page 1. Out-of-range
  positive pages resolve to the last available page. An empty Library resolves
  to page 1 and retains the existing empty state.
- Return selected root subtrees and pagination metadata for current page,
  page count, and standalone total from the loader. Keep any whole-Library
  Material count truthful; do not label the current page's count as a Library
  total or conflate root totals with descendant totals.
- Bound root selection on the server and fetch only the selected subtrees and
  their references. Client-side slicing of a full Library response does not
  satisfy this requirement. Reuse or extend the public Library read operation.
- Show Previous/Next and page status when useful. Unavailable directions must
  not issue invalid requests. Navigate through React Router, preserve unrelated
  URL state, and keep focus and pending states usable across themes and widths.
- After successful standalone capture, reveal the new Material on the last page
  in saved order. Child creation, rename, and details updates keep the current
  page and parent context. Failures retain input and do not navigate away.
  Preserve Save/Cancel and unsaved-navigation protections.
- Sorting and moving are no longer archive/restore prerequisites. Saved
  relative sibling positions must still survive archive/restore. Move guards
  and title-sort workflows are excluded from current-release criteria.
- Keep the old issues as deferred history rather than repurposing identifiers.
  Sorting's historical closed issue need not be reopened; moving is deferred,
  not ready for implementation. Link this replacement from the parent and
  release map. Do not create an artificial pagination dependency for independent
  work; integrate page counts and recovery when pagination is present.

## Testing Decisions

- The user confirmed the Library workflow as the highest test seam: observable
  paging, reload/Back/Forward, intact nested context, and no sort/move controls.
  Prefer that public workflow over testing private helpers or internal state.
- Reuse existing public core-operation integration tests with disposable
  PostgreSQL for persistence risks that browser checks cannot prove alone.
  Observe results through public operations, not direct SQL side channels,
  internal mocks, call counts, or CSS snapshots.
- Prior art is Material operations coverage for capture, hierarchy, sibling
  uniqueness, rename, and metadata/reference persistence, plus existing
  Library Save/Cancel, error, and unsaved-change behavior.
- A worked 21-root fixture shows the first 20 roots on page 1 and the remaining
  root on page 2, without missing or duplicate identities. Nested children and
  references remain with their parent. Page changes never mutate content.
- Cover empty, single-page, first/last-page, malformed and out-of-range pages,
  reload, and browser history. Test capture revealing the new root, child
  creation keeping context, rename preserving page membership, and save failure
  retaining input.
- Verify navigation cancellation for dirty create/rename/details drafts, visible
  recoverable errors, and unchanged existing editing workflows.
- Verify sort/move controls are absent, old sort links do not sort, and a move
  intent cannot mutate hierarchy.
- Validate keyboard access, focus, long titles, deep trees, narrow screens, and
  both system themes. Run focused tests during development and the repository's
  typecheck, lint, and release checks before delivery. Clean editor diagnostics
  alone are not passing integration tests.

## Out of Scope

- Implementing or rediscovering sorting, manual arrangement, drag-and-drop,
  moving, copying Material, or reparenting existing descendants.
- Deleting saved positions, schema rollback, data cleanup, recreating Material,
  or undoing previously persisted moves.
- Paging children independently, infinite scroll, configurable page size, new
  search behavior, or a pagination framework for hypothetical future pages.
- Implementing archive/delete, inventing Sprint or practice-reference contracts,
  timer behavior, production hosting, or multi-user access.
- Relaxing deletion safety or claiming historical-integrity verification without
  the real later-feature contracts.

## Further Notes

This supersedes sorting and moving in the current-release scope as requested
on 2026-10-14. The fixed page size and URL edge handling are pragmatic defaults
synthesized for this spec; future discovery may revise them without restoring
the deferred capabilities.

Server-side root paging, URL page resolution, and page navigation are
implemented. Full browser-history, editing-recovery, keyboard, and responsive
workflow acceptance checks remain unverified; issue closure does not imply
those checks have been completed.
