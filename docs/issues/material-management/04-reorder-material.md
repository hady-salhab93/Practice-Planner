---
name: Reorder Material
status: planned
blocked_by: [02-break-down-material.md]
---

# Reorder Material

## Outcome

The guitarist can arrange standalone Material and children in a personally useful sequence.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

[Break Material into nested pieces](02-break-down-material.md).

## Acceptance Criteria

- [ ] Manually change the order of standalone Material and of children within a parent.
- [ ] The chosen order survives navigation and reload.
- [ ] Reordering changes only sibling order, not Material identity, parentage, descendants, or content.
- [ ] Reordering one group leaves the order of other groups unchanged.
- [ ] Failed reorder operations preserve the saved sequence and leave the user able to retry.
- [ ] Verify the user-facing operation and persisted sequence for both standalone and nested groups.

## Exclusions

Moving between parents and automatic sorting or prioritization. Order preservation through archiving/restoration is integrated in Slice 7.
