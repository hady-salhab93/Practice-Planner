---
status: approved
approved_on: 2026-10-11
---

# Material Management And Breakdown

## Problem And Outcome

The guitarist has many things to cover, from whole albums and books to songs, exercises, and passages. Large material is difficult to act on without breaking it into manageable pieces. Keeping that material only in memory makes preparation and reuse harder.

Provide a reusable Library where the guitarist can capture, describe, break down, find, reorganize, and set aside Material. For example, "Take the Time" can contain a Guitar Solo, a Fast Passage, and Bars 12-14; a book can contain chapters and exercises.

This PRD records the feature agreement confirmed by the user on 2026-10-11. It does not authorize implementation or claim the behavior exists. Vocabulary is defined in the [glossary](../../GLOSSARY.md); application purpose and first-version context are recorded in the [decision map](../planning/map.md).

## User Stories

1. As a guitarist, I want to capture material before fully analyzing it so that I can return to it later.
2. As a guitarist, I want to break large material into smaller pieces so that practice preparation becomes actionable.
3. As a guitarist, I want descriptions and reference links so that I can remember what a piece refers to.
4. As a guitarist, I want to search and sort my Library by title so that I can find and organize what matters.
5. As a guitarist, I want to move Material without recreating it so that its organization can evolve.
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
- Reject a create, rename, or move that would violate title uniqueness. Identify the conflicting Material; preserve the existing saved state and relevant input. Never merge, overwrite, or automatically rename Material to resolve a conflict.
- Changes to titles, descriptions, and links require explicit Save; Cancel discards unsaved edits.
- Warn before leaving unsaved changes. Failed saves preserve the user's input rather than forcing re-entry.

### Moving And Ordering

- Moving Material carries all descendants and preserves the identity of existing Material rather than making copies.
- Material can move between parents or become standalone in the Library.
- Prevent moving Material beneath itself or any descendant.
- New Material and Material moved into a different group are appended to the saved sibling sequence.
- Sort Material by title in ascending (A-Z) or descending (Z-A) order within each sibling group, including standalone Material. The selected direction survives reloads, and sorting does not change saved sibling positions, identity, parentage, descendants, or content.
- Preserve saved relative sibling positions through archiving and restoration.
- Restore archived Material before moving it; moving into an archived parent is prohibited.

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
- Adding children and moving Material require restoration first. Material hidden by an archived ancestor is not available as an unarchived destination.

### Permanent Deletion

- Permit permanent deletion for mistakenly added or otherwise unused Material.
- Deletion removes the selected Material and its entire subtree, not just the parent. To retain children, move them out before deleting.
- Require confirmation identifying the Material and the number of descendants that will be removed.
- Block deletion if the selected Material or any descendant has recorded practice or a Sprint reference. This protection applies to archived Material as well.
- When deletion is blocked, explain why and offer archiving instead. Deletion must not erase practice records or break Sprint references.

### Historical Integrity

- Adding children never redistributes previously recorded practice. Earlier practice stays attached to its original Material.
- Later Library renames, moves, or archiving do not rewrite an ended Sprint's historical names or grouping.
- Preserve a connection from historical context to the current Material, including when it is archived.
- These are preservation requirements, not a prescribed snapshot mechanism or a specification of the Sprint report UI.

## Acceptance Scenarios

These scenarios are requirements for future verification, not claims of passing tests.

1. Create a standalone song with only a title; create a book with chapters and exercises and a song with several nested passages, without choosing mandatory item types or levels.
2. Edit a description containing line breaks and add, relabel, change, and remove reference links. Save persists changes; Cancel leaves the saved Material unchanged.
3. Attempt to leave unsaved edits and receive a warning. A failed Save retains the entered values for correction or retry.
4. Create "Warm-up" under two different books successfully. A second " warm-up " under either same book is rejected, even if the existing sibling is archived. The same rule applies to standalone Material.
5. Move a chapter containing exercises into another book; all descendants move with it. Move an exercise to stand alone. Existing identities and attached practice remain intact.
6. Attempt a cyclic move or a move into a group with a conflicting title; the operation is rejected without partial changes, merging, replacement, or automatic renaming.
7. Sort standalone Material and children within a parent by title A-Z or Z-A. The selected direction survives reloads without changing the saved sibling sequence; archiving and restoring a sibling preserves its saved relative position.
8. Search for "exercise" and find differently capitalized matching titles across the Library with ancestor context. Open a result in its hierarchy; archived matches appear only in the archived view's search.
9. Archive one exercise independently, then archive and restore its book. The book and previously visible descendants return; the independently archived exercise stays archived.
10. Attempt to restore a child beneath an archived ancestor, add children to archived Material, or move archived Material; require ancestor restoration or Material restoration as applicable rather than silently reorganizing the Library.
11. Rename archived Material and edit its description or links without restoring it; title uniqueness still applies.
12. Delete an unused chapter after confirmation showing its descendant count; its subtree is removed. Cancel confirmation and retain everything unchanged.
13. Attempt deletion when only a descendant has practice or a Sprint reference; block the whole deletion and offer archiving, preserving all records and references.
14. Add passages beneath previously practiced Material; its earlier practice remains on that Material and is not assigned to the new passages.
15. Rename, move, or archive Material after a Sprint ends; the ended Sprint retains its names and grouping and remains connected to current Material.

## Exclusions

- Completion, mastery, proficiency, and automatic practice-quality assessment.
- Mandatory song/book/exercise types, fixed hierarchy levels, or shared Material with multiple parents.
- File uploads, embedded recordings or sheet music, and rich-text descriptions.
- Tags, categories, automatic prioritization, sorting by fields other than title, merging, and automatic conflict renaming.
- Sprint selection, timing controls, and report presentation; these belong to their own feature interviews.

## Dependencies And Open Questions

The Library agreement is approved. The following cross-feature decisions remain open and block affected integration work, not basic capture and organization:

- **Sprint planning and refinement:** what a Sprint references, whether selecting a parent includes descendants, and how adding children, moving, archiving, or restoring Material affects planned or active commitments.
- **Focused timing:** which Material is eligible for timing and what happens when its hierarchy or archive state changes while a timer is running.
- **Sprint review:** the point at which historical names and grouping are retained, and how historical-to-current Material navigation is presented. Ended context must remain stable regardless of the chosen mechanism.
- **Delivery:** unresolved database provisioning and durability choices remain in [stack planning](../STACK_PLANNING.md). This PRD does not silently settle them.

Do not implement unresolved interactions by borrowing behavior from the deleted application-wide plan. Resolve them in the owning feature interview and link its approved PRD here before decomposing dependent integration tasks.

## Verification Expectations

Follow [testing standards](../TESTING_STANDARDS.md) and [running checks](../agents/testing.md). Use focused behavior checks for hierarchy integrity, title conflicts, ordering, archive/restoration state, and deletion eligibility. Verify persistence and protected relationships through integration checks, and exercise Save/Cancel, unsaved changes, search navigation, and destructive confirmation through user-facing checks.

Historical preservation scenarios require the later Sprint, timing, and review contracts; they cannot be declared verified by Library-only tests. Use [frontend standards](../FRONTEND_STANDARDS.md) for layout and controls without treating this document as a finalized screen design. Implementation issues and their acceptance criteria will be proposed separately after reviewing this PRD and its dependencies.
