---
name: Sort Material by title
status: planned
blocked_by: [02-break-down-material.md]
---

# Sort Material by title

## Outcome

The guitarist can sort standalone Material and children within a parent by title.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

[Break Material into nested pieces](02-break-down-material.md).

## Acceptance Criteria

- [ ] Sort standalone Material and children within each parent by title A-Z or Z-A.
- [ ] The selected sort direction survives reload.
- [ ] Sorting changes only displayed sibling order, not saved positions, Material identity, parentage, descendants, or content.
- [ ] Verify the sort control for standalone and nested Material.

## Exclusions

Manual arrangement, moving between parents, and sorting by fields other than title. Saved order preservation through archiving/restoration is integrated in Slice 7.
