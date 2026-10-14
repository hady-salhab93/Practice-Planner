---
status: approved
approved_on: 2026-10-11
---

# Material Management And Breakdown

## Problem And Outcome

The guitarist has many things to cover, from whole albums and books to songs, exercises, and passages. Large material is difficult to act on without breaking it into manageable pieces. Keeping that material only in memory makes preparation and reuse harder.

Provide a reusable Library where the guitarist can capture, describe, break down,
find, and set aside Material. For example, "Take the Time" can contain a Guitar
Solo, a Fast Passage, and Bars 12-14; a book can contain chapters and exercises.

This PRD records the feature agreement confirmed by the user on 2026-10-11. It does not authorize implementation or claim the behavior exists. Vocabulary is defined in the [glossary](../../GLOSSARY.md); application purpose and first-version context are recorded in the [decision map](../planning/map.md).

## Release Scope Update: 2026-10-14

The author removed user-controlled ordering and moving from this release.
Those behaviors need further discovery before future implementation. Remove
title-sort and move controls, their operations, and feature-only tests and
styles. Preserve all existing Material, parentage, metadata, references, and
saved sibling positions; do not reverse already persisted moves.

[Library pagination](library-pagination.md) replaces those two release
workstreams. It is specified, not yet implemented. The previous sorting and
moving issues remain deferred history rather than current-release blockers.

## User Stories

1. As a guitarist, I want to capture material before fully analyzing it so that I can return to it later.
2. As a guitarist, I want to break large material into smaller pieces so that practice preparation becomes actionable.
3. As a guitarist, I want descriptions and reference links so that I can remember what a piece refers to.
4. As a guitarist, I want to search my Library by title so that I can find what matters.
5. As a guitarist, I want to browse my Library in manageable pages so that a growing collection remains usable without sorting or moving it.
6. As a guitarist, I want to archive unused Material and delete mistakes so that the Library stays useful without losing practice history.

## Approved Behavior

### Capture And Breakdown

- Use one flexible kind of Material for albums, songs, books, chapters, exercises, passages, and other practice content. There are no mandatory types or fixed hierarchy levels.
- Material can stand alone in the Library or belong to one parent. Breakdown can continue to arbitrary depth; having children is optional.
- Material has no completion status. Capturing something means intending to cover it, not introducing a completion checklist.
- Each Material requires a title and allows an optional plain-text description with line breaks.
- Each Material allows multiple reference links with optional labels, such as "Tab" or "Lesson". Links can be edited and removed independently.

### Titles And Editing

- Titles are unique among siblings. All standalone Material shares the same title-uniqueness group.
- Uniqueness includes archived Material and ignores capitalization and surrounding spaces. "Warm-up" and " warm-up " conflict within the same group.
- The same title is allowed under different parents.
- Reject a create or rename that would violate title uniqueness. Identify the conflicting Material; preserve the existing saved state and relevant input. Never merge, overwrite, or automatically rename Material to resolve a conflict.
- Changes to titles, descriptions, and links require explicit Save; Cancel discards unsaved edits.
- Warn before leaving unsaved changes. Failed saves preserve the user's input rather than forcing re-entry.

### Stable Browsing And Pagination

- New Material is appended to its existing sibling group's saved sequence.
- Browse each sibling group in its saved sequence with a stable identity
  tie-breaker. This internal determinism is not a user-controlled ordering
  feature.
- Preserve saved relative sibling positions through archiving and restoration.
- Page standalone Material with its nested subtree kept intact. The
  [pagination spec](library-pagination.md) owns navigation and paging behavior.
- Do not expose title-sort, manual-order, drag-and-drop, or move controls.

### Browsing And Search

- Show the Library's hierarchy so that Material can be browsed in context.
- Normal Library browsing and title search exclude Material hidden by archiving.
- Title search ignores capitalization and searches across the unarchived Library.
- Results show ancestor paths to distinguish matching titles under different parents. Selecting a match opens it in context.
- Provide an archived view with separate title search for archived Material, including descendants hidden by an archived ancestor.

### Archiving And Restoration

- Archiving Material hides it and its descendants from the normal Library without deleting them or their recorded history.
- Restoring it makes the subtree visible again, except descendants that were independently archived before the ancestor was archived. Those remain archived.
- Restore archived ancestors before restoring a child independently. Restoration does not silently move Material or restore ancestors on the user's behalf.
- Preserve relative sibling positions through archiving and restoration.
- Titles, descriptions, and links can be edited in the archived view. Eligible Material can also be deleted there.
- Adding children requires restoration first. Material hidden by an archived ancestor is not available as an unarchived parent.

### Permanent Deletion

- Permit permanent deletion for mistakenly added or otherwise unused Material.
- Deletion removes the selected Material and its entire subtree, not just the parent. Moving children out first is not available in this release; cancel deletion and use archiving if the subtree should be retained.
- Require confirmation identifying the Material and the number of descendants that will be removed.
- Block deletion if the selected Material or any descendant has recorded practice or a Sprint reference. This protection applies to archived Material as well.
- When deletion is blocked, explain why and offer archiving instead. Deletion must not erase practice records or break Sprint references.

### Historical Integrity

- Adding children never redistributes previously recorded practice. Earlier practice stays attached to its original Material.
- Later Library renames or archiving do not rewrite an ended Sprint's historical names or grouping. Revisit move-related historical preservation if moving is approved in a future release.
- Preserve a connection from historical context to the current Material, including when it is archived.
- These are preservation requirements, not a prescribed snapshot mechanism or a specification of the Sprint report UI.

## Acceptance Scenarios

These scenarios are requirements for future verification, not claims of passing tests.

1. Create a standalone song with only a title; create a book with chapters and exercises and a song with several nested passages, without choosing mandatory item types or levels.
2. Edit a description containing line breaks and add, relabel, change, and remove reference links. Save persists changes; Cancel leaves the saved Material unchanged.
3. Attempt to leave unsaved edits and receive a warning. A failed Save retains the entered values for correction or retry.
4. Create "Warm-up" under two different books successfully. A second " warm-up " under either same book is rejected, even if the existing sibling is archived. The same rule applies to standalone Material.
5. Deferred: subtree moves require future discovery and are not current-release acceptance work.
6. Deferred: cycle and destination-conflict protection belong to any future approved move workflow.
7. Browse standalone Material across pages with nested context intact, without sorting or moving controls. Page navigation survives reload and preserves the saved sibling sequence; archiving and restoring a sibling preserves its saved relative position.
8. Search for "exercise" and find differently capitalized matching titles across the Library with ancestor context. Open a result in its hierarchy; archived matches appear only in the archived view's search.
9. Archive one exercise independently, then archive and restore its book. The book and previously visible descendants return; the independently archived exercise stays archived.
10. Attempt to restore a child beneath an archived ancestor or add children to archived Material; require ancestor restoration or Material restoration as applicable rather than silently reorganizing the Library.
11. Rename archived Material and edit its description or links without restoring it; title uniqueness still applies.
12. Delete an unused chapter after confirmation showing its descendant count; its subtree is removed. Cancel confirmation and retain everything unchanged.
13. Attempt deletion when only a descendant has practice or a Sprint reference; block the whole deletion and offer archiving, preserving all records and references.
14. Add passages beneath previously practiced Material; its earlier practice remains on that Material and is not assigned to the new passages.
15. Rename or archive Material after a Sprint ends; the ended Sprint retains its names and grouping and remains connected to current Material. Move-related verification is deferred.

## Exclusions

- Completion, mastery, proficiency, and automatic practice-quality assessment.
- Mandatory song/book/exercise types, fixed hierarchy levels, or shared Material with multiple parents.
- File uploads, embedded recordings or sheet music, and rich-text descriptions.
- Tags, categories, automatic prioritization, all user-controlled sorting or ordering, moving, merging, and automatic conflict renaming.
- Sprint selection, timing controls, and report presentation; these belong to their own feature interviews.

## Dependencies And Open Questions

The Library agreement is approved. The following cross-feature decisions remain open and block affected integration work, not basic capture and organization:

- **Sprint planning and refinement:** what a Sprint references, whether selecting a parent includes descendants, and how adding children, archiving, or restoring Material affects planned or active commitments. Move effects are deferred with the move feature.
- **Focused timing:** which Material is eligible for timing and what happens when its hierarchy or archive state changes while a timer is running.
- **Sprint review:** the point at which historical names and grouping are retained, and how historical-to-current Material navigation is presented. Ended context must remain stable regardless of the chosen mechanism.
- **Delivery:** unresolved database provisioning and durability choices remain in [stack planning](../STACK_PLANNING.md). This PRD does not silently settle them.

Do not implement unresolved interactions by borrowing behavior from the deleted application-wide plan. Resolve them in the owning feature interview and link its approved PRD here before decomposing dependent integration tasks.

## Verification Expectations

Follow [testing standards](../TESTING_STANDARDS.md) and [running checks](../agents/testing.md). Use focused behavior checks for hierarchy integrity, title conflicts, stable saved sibling sequence, pagination, archive/restoration state, and deletion eligibility. Verify persistence and protected relationships through integration checks, and exercise Save/Cancel, unsaved changes, page/search navigation, and destructive confirmation through user-facing checks. Sort and move behavior is excluded from current-release verification.

Historical preservation scenarios require the later Sprint, timing, and review contracts; they cannot be declared verified by Library-only tests. Use [frontend standards](../FRONTEND_STANDARDS.md) for layout and controls without treating this document as a finalized screen design. Implementation issues and their acceptance criteria will be proposed separately after reviewing this PRD and its dependencies.

## Implementation Backlog And Delivery Contract

[The parent GitHub issue](https://github.com/hady-salhab93/Practice-Planner/issues/9)
and its sub-issues own the implementation backlog. Local copies of the issue
breakdown have been removed; consult GitHub for issue state, acceptance criteria,
and dependencies. Sorting and moving remain deferred, and the
[pagination spec](library-pagination.md) owns the replacement release scope.

Each implementation slice delivers a usable workflow through the local UI,
React Router loaders/actions, core domain operations, PostgreSQL persistence,
and focused tests. Add only the schema, operations, and controls needed by that
slice; do not replace an end-to-end outcome with separate database, API, and
frontend projects. Verify visible success and failure paths, persistence after
reload, and relevant integrity risks. Unchecked criteria are not passing
verification, and a dependency's document or code existing does not prove its
required outcome.

### Cross-Feature Safety Gates

- Local PostgreSQL uses Docker Compose on localhost with a persistent named
  volume. Backups are deferred; this does not approve production infrastructure.
- Permanent deletion remains blocked until approved and implemented
  Sprint-reference and practice-record contracts support authoritative subtree
  eligibility checks. Never invent those schemas or use a permanently empty
  protection check. Recheck eligibility at the destructive operation so stale
  confirmation cannot delete newly protected Material.
- Resolve breakdown, archiving, and restoration effects on planned or active
  Sprint commitments before connecting Library mutations to Sprints. Revisit
  move effects only if moving is approved in the future.
- Resolve hierarchy/archive changes during timing and timing eligibility in the
  timing feature. Library actions must not silently start, stop, or retarget a
  timer.
- Preserve earlier practice on its original Material when children are added.
  Preserve ended-Sprint names/grouping and access to current Material, including
  archived Material. Verify these against real timing and review contracts,
  not invented copies or Library-only tests.

Basic Library outcomes may precede later features. Once Sprints or timers are
connected, resolve and verify the applicable gates before calling the integrated
workflow complete.
