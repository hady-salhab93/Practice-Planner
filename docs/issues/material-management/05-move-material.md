---
name: Move Material with its descendants
status: planned
blocked_by: [02-break-down-material.md, 04-reorder-material.md]
---

# Move Material With Its Descendants

## Outcome

The guitarist can reorganize existing Material without duplicating or rebuilding its breakdown.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

[Break Material into nested pieces](02-break-down-material.md) and [Reorder Material](04-reorder-material.md).

## Acceptance Criteria

- [ ] Move Material between parents or make it standalone; append it to the destination group's end.
- [ ] Moving a chapter carries its entire exercise subtree while preserving every Material identity and its metadata.
- [ ] Preserve the relative order of descendants and the remaining siblings at the source.
- [ ] Reject moves beneath the same Material or its descendants; hierarchy changes cannot create cycles or multiple parents.
- [ ] Reject destination title conflicts using the agreed case/space comparison, identify the conflict, and do not merge, overwrite, or automatically rename.
- [ ] Invalid or failed moves leave the saved hierarchy and ordering unchanged, without partial subtree changes.
- [ ] Verify persisted subtree moves, standalone destinations, cycle rejection, and title conflicts through the user-facing workflow.

## Exclusions

Copying and multiple parents. Archived-source/destination guards arrive with Slice 7. Attached-practice preservation and planned/active Sprint or running-timer effects require the real contracts at the shared integration gates; Library-only checks do not satisfy them.
