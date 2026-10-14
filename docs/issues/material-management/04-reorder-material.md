---
name: Sort Material by title
status: deferred
blocked_by: [02-break-down-material.md]
---

# Sort Material by title

## Outcome

The guitarist can sort standalone Material and children within a parent by title.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Release Decision

Deferred on 2026-10-14. The author does not need user-controlled ordering in this
release and wants to reconsider the behavior before implementing it again.
Title sorting was previously delivered by PR #12; its historical closed issue
does not mean the capability remains in the current release. Remove its controls
and implementation without deleting saved sibling positions or Material data.
The [Library pagination spec](../../features/library-pagination.md) replaces this
release workstream. The criteria below are historical discovery input, not
current implementation authorization.

## Dependencies

[Break Material into nested pieces](02-break-down-material.md).

## Acceptance Criteria

- [ ] Sort standalone Material and children within each parent by title A-Z or Z-A.
- [ ] The selected sort direction survives reload.
- [ ] Sorting changes only displayed sibling order, not saved positions, Material identity, parentage, descendants, or content.
- [ ] Verify the sort control for standalone and nested Material.

## Exclusions

Manual arrangement, moving between parents, and sorting by fields other than title. Saved order preservation through archiving/restoration is integrated in Slice 7.
