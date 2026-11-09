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

## Discovery Update: 2026-10-14

The user approved optional, user-defined Tag groups and Tags for classifying
Material, filtering the Library and Sprint selection, and comparing practice
time in Sprint reviews. They also replaced the prior ended-Sprint snapshot
rule: past Sprint views use current Material names, hierarchy, and Tags.
Recorded practice remains attached to its original Material and is never
redistributed when the Library changes. These are product requirements, not
claims of implementation or authorization to implement.

## Deletion Safety Discovery Update: 2026-10-15

The user approved the [deletion safety contracts](material-deletion-safety.md)
for Sprint subtree selection and deferral, explicit inclusion of later
descendants, protection through existing Sprint memberships and saved or
in-progress practice, and archiving without disrupting existing commitments
or timers. That agreement also requires refreshed deletion confirmation when
subtree membership changes and atomic protection checks at deletion.

Permanent deletion remains blocked until the real prerequisite workflows and
persistence contracts are implemented and verified. The linked agreement
proposes separate prerequisite slices; it does not authorize implementation
or close the Delete story.

## User Stories

1. As a guitarist, I want to capture material before fully analyzing it so that I can return to it later.
2. As a guitarist, I want to break large material into smaller pieces so that practice preparation becomes actionable.
3. As a guitarist, I want descriptions and reference links so that I can remember what a piece refers to.
4. As a guitarist, I want to search my Library by title so that I can find what matters.
5. As a guitarist, I want to browse my Library in manageable pages so that a growing collection remains usable without sorting or moving it.
6. As a guitarist, I want to archive unused Material and delete mistakes so that the Library stays useful without losing practice history.
7. As a guitarist, I want to classify Material along my own dimensions so that I can find, select, and compare practice in ways meaningful to me.

## Approved Behavior

### Capture And Breakdown

- Use one flexible kind of Material for albums, songs, books, chapters, exercises, passages, and other practice content. There are no mandatory types or fixed hierarchy levels.
- Material can stand alone in the Library or belong to one parent. Breakdown can continue to arbitrary depth; having children is optional.
- Material has no completion status. Capturing something means intending to cover it, not introducing a completion checklist.
- Each Material requires a title and allows an optional plain-text description with line breaks.
- Each Material allows multiple reference links with optional labels, such as "Tab" or "Lesson". Links can be edited and removed independently.

### Titles And Editing

- The home Library uses compact rows with an icon-only Add child button immediately before the expand/collapse chevron. Edit details includes the title, description, and references; there is no separate Rename control.
- Saving Edit details persists all fields together. A failed save leaves all saved fields unchanged.
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
- Provide an archived view with separate title search for archived roots and their descendants, including ancestor context.

### Classification

- Users create, rename, and delete their own Tag groups and Tags. Examples include a "Kind" group with "Song" and "Exercise" Tags, a "Focus" group with "Arpeggios" and "Pentatonic", and a "Style" group with "Blues" and "Rock". No built-in taxonomy is required.
- Manage Tag groups and Tags in a Library-level Manage Tags dialog. Assign and remove existing Tags in the Material Edit details dialog, saving or cancelling those changes together with the other details. Create new groups and Tags in Manage Tags, not inline during assignment.
- Tag group names are unique globally, and Tag names are unique within their group, ignoring case and surrounding whitespace. Create and rename operations in Manage Tags save immediately; a recoverable error preserves the current input.
  -16. Create, rename, and delete user-defined Tag groups and Tags;
- Classification is optional. A Material can have multiple Tags in a group, and Tags apply only to the Material they are assigned to; they are not inherited by descendants.
- Tag assignments remain editable for archived Material. Archived Material is not available as a Sprint candidate until its root is restored.
- Use Tag groups to filter Library Material and help select Material for a Sprint. When multiple Tags are selected within one group, a Material matches any of those Tags; when filters are selected in multiple groups, a Material must match at least one Tag from each selected group.
- Sprint reviews compare practice time within each Tag group. A Material assigned multiple Tags within a group contributes its full recorded time to each matching Tag. These label totals overlap and are not additive; distinguish them from the actual practice-time total.
- Renaming a group or Tag updates current classification. Deleting a Tag removes its assignments; deleting a group also deletes its Tags and their assignments. Confirm deletion with the number of affected Material, without deleting Material or practice records.

### Archiving And Restoration

- Only standalone/root Material can be archived or restored. Archiving a root hides it and its entire subtree from the normal Library without deleting them or their recorded history.
- Descendants cannot be archived or restored independently. The root's archive state applies to its entire subtree; restoring the root makes all of its descendants visible again.
- Preserve relative sibling positions through archiving and restoration.
- Titles, descriptions, and links can be edited in the archived view. Eligible Material can also be deleted there.
- Adding children beneath an archived root requires restoring that root first. Material hidden as part of an archived subtree is not available as an unarchived parent.

### Permanent Deletion

- Permit permanent deletion for mistakenly added or otherwise unused Material.
- Deletion removes the selected Material and its entire subtree, not just the parent. Moving children out first is not available in this release; cancel deletion and use archiving if the subtree should be retained.
- Require confirmation identifying the Material and the number of descendants that will be removed.
- Block deletion if the selected Material or any descendant has recorded practice or a Sprint reference. This protection applies to archived Material as well.
- When deletion is blocked, explain why and offer archiving instead. Deletion must not erase practice records or break Sprint references.
- [Deletion safety contracts](material-deletion-safety.md) define which Sprint
  memberships and practice states protect Material, the root-scoped archiving
  alternative for nested Material, and stale-confirmation handling.

### Historical Integrity

- Adding children never redistributes previously recorded practice. Earlier practice stays attached to its original Material.
- Ended Sprint views use current Material names, hierarchy, and Tags after Library changes. Earlier practice remains attached to its original Material and is not redistributed to newly added children.
- Preserve a connection from historical context to the current Material, including when it is archived.
- These are current-state reporting requirements, not a prescribed mechanism or a specification of the Sprint report UI.

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
9. Archive a standalone book and verify that it and every nested chapter and exercise disappear from normal browsing and search, while their content, identity, and saved positions remain intact. Restore the book and verify its entire subtree returns.
10. Attempt to archive or restore a nested chapter or add children beneath an archived root; reject the archive-state change for the nested Material and require root restoration before adding children.
11. Rename archived Material and edit its description or links without restoring it; title uniqueness still applies.
12. Delete an unused chapter after confirmation showing its descendant count; its subtree is removed. Cancel confirmation and retain everything unchanged.
13. Attempt deletion when only a descendant has practice or a Sprint reference; block the whole deletion and offer archiving, preserving all records and references.
14. Add passages beneath previously practiced Material; its earlier practice remains on that Material and is not assigned to the new passages.
15. Rename Material, change its Tags, or add children after a Sprint ends; the ended Sprint view reflects the current name, Tags, and hierarchy while earlier practice remains attached to the original Material. Move-related verification is deferred.
16. Create, rename, and delete user-defined Tag groups and Tags; assign and remove multiple direct Tags per group through Edit details, including for archived Material. Confirm taxonomy deletion with its affected-Material count and preserve Material and practice records. Filter candidates with OR within a group and AND across selected groups.
17. Record practice against Material with more than one Tag in a group; the Sprint review shows the full time under each matching Tag, marks those totals as overlapping, and keeps the actual practice-time total distinct.

## Exclusions

- Completion, mastery, proficiency, and automatic practice-quality assessment.
- Mandatory song/book/exercise types, fixed hierarchy levels or Tag taxonomies, or shared Material with multiple parents.
- File uploads, embedded recordings or sheet music, and rich-text descriptions.
- Goal-setting or tracking, metronome features, practice reminders, and schedules are deferred from the first version.
- Automatic prioritization, all user-controlled sorting or ordering, moving, merging, and automatic conflict renaming.
- Detailed Sprint selection rules, timer workflows, and report presentation; those belong to their own feature interviews. This PRD only establishes Tag-based filtering/selection and Tag-group comparisons.

## Dependencies And Open Questions

The following cross-feature agreements are approved at discovery level. Their detailed interaction contracts belong in the owning feature PRDs and still block affected integration work, not basic capture and organization:

- **Sprint planning and refinement:** The approved [Sprint planning PRD](sprint-planning.md) owns calendar lifecycle, current-subtree selection, subtree deferral, explicit inclusion of later descendants, and future-Sprint cancellation. The [deletion safety agreement](material-deletion-safety.md) owns membership protection and preservation through archiving. Tag-based selection filtering is specified in the Sprint PRD and depends on real classification. Sprint implementation and real membership verification remain outstanding; moving remains deferred.
- **Focused timing:** V1 allows missed practice to be entered for any past date as one Material and a focused-time duration, then edited or deleted. Timer records count only unpaused time, continue while the app is backgrounded until explicitly paused or stopped, and can be edited or deleted. An unexpectedly interrupted timer returns unconfirmed for user confirmation or duration adjustment. The [deletion safety agreement](material-deletion-safety.md) protects saved and in-progress practice and preserves activity through archiving. Eligibility, timer controls, recovery mechanics, and date/timezone boundaries remain open.
- **Daily observations:** V1 allows one optional day-level summary per practice date across that day's practice; per-Material notes are not required. Detailed capture and editing behavior remains open.
- **Sprint review:** compare practice time within each user-defined Tag group using current Material classification, names, and hierarchy, including for ended Sprints. Multiple-Tag totals overlap as specified above. Review layout, comparisons beyond these groups, and historical-to-current Material navigation remain open.
- **Delivery:** unresolved database provisioning and durability choices remain in [stack planning](../STACK_PLANNING.md). This PRD does not silently settle them.

Do not implement unresolved interactions by borrowing behavior from the deleted application-wide plan. Resolve them in the owning feature interview and link its approved PRD here before decomposing dependent integration tasks.

## Verification Expectations

Follow [testing standards](../TESTING_STANDARDS.md) and [running checks](../agents/testing.md). Use focused behavior checks for hierarchy integrity, title conflicts, stable saved sibling sequence, pagination, root-only archive/restoration of complete subtrees, and deletion eligibility. Verify persistence and protected relationships through integration checks, and exercise Save/Cancel, unsaved changes, page/search navigation, and destructive confirmation through user-facing checks. Sort and move behavior is excluded from current-release verification.

Historical current-state reporting scenarios require the later Sprint, timing, and review contracts; they cannot be declared verified by Library-only tests. Use [frontend standards](../FRONTEND_STANDARDS.md) for layout and controls without treating this document as a finalized screen design. The classification workflow is published as Story #35 under the Material Management issue; other implementation issues require approved contracts and dependencies.

## Implementation Backlog And Delivery Contract

[The parent GitHub issue](https://github.com/hady-salhab93/Practice-Planner/issues/9)
and its sub-issues own the implementation backlog. Local copies of the issue
breakdown have been removed; consult GitHub for issue state, acceptance criteria,
and dependencies. Sorting and moving remain deferred, and the
[pagination spec](library-pagination.md) owns the replacement release scope.
The classification workflow is tracked in [Story #35](https://github.com/hady-salhab93/Practice-Planner/issues/35).

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
  [Sprint, practice-record, and in-progress practice contracts](material-deletion-safety.md)
  support authoritative subtree eligibility checks. Never invent those schemas
  or use a permanently empty protection check. Atomically recheck eligibility
  at the destructive operation; changed subtree membership requires refreshed
  confirmation and newly protected Material must not be deleted.
- Implement the approved subtree-selection, deferral, explicit-inclusion, and
  archive-preservation contracts before connecting Library mutations to Sprints.
  Resolve remaining lifecycle and interaction details in the owning feature.
  Revisit move effects only if moving is approved in the future.
- Archiving preserves existing timer activity and its Material identity.
  Resolve remaining timing eligibility and lifecycle behavior in the timing
  feature. Library actions must not silently start, stop, discard, or retarget
  a timer.
- Preserve earlier practice on its original Material when children are added.
  Ended Sprint views must reflect current Material names, hierarchy, and Tags,
  while retaining access to the original Material, including archived
  Material. Verify these against real timing and review contracts, not invented
  copies or Library-only tests.

Basic Library outcomes may precede later features. Once Sprints or timers are
connected, resolve and verify the applicable gates before calling the integrated
workflow complete.
