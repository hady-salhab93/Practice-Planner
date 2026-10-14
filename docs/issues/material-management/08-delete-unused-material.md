---
name: Delete unused Material safely
status: blocked
blocked_by: [07-archive-and-restore.md]
---

# Delete Unused Material Safely

## Outcome

The guitarist can remove mistakenly added or otherwise unused Material permanently while protecting all recorded practice and Sprint references.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies And Blocker

[Archive and restore Material](07-archive-and-restore.md), plus approved and implemented Sprint-reference and practice-record contracts. This issue stays blocked until those real contracts are available for authoritative subtree eligibility checks. Link their owning approved PRDs and implementation outcomes here before starting; do not invent their schemas or substitute a permanently empty check.

## Acceptance Criteria

- [ ] Request deletion for standalone, nested, or archived Material and show confirmation identifying it and the number of descendants to remove.
- [ ] Cancel confirmation without deleting anything.
- [ ] Confirm deletion of eligible Material and remove its entire subtree; do not relocate children automatically.
- [ ] Reject deletion when the selected Material or any descendant has a practice record or Sprint reference, including archived descendants.
- [ ] Explain blocked deletion and offer archiving without erasing records or breaking references.
- [ ] Enforce protection on the server at the destructive operation, not only when opening confirmation; newly introduced references must not be deleted by a stale confirmation.
- [ ] Failed or rejected deletion leaves the subtree and protected data unchanged; successful deletion remains absent after reload.
- [ ] Verify eligible deletion, cancellation, descendant-only references, archived deletion, and protected-data integrity against the real persistence contracts.

## Exclusions

Deleting practice records, removing Sprint references to force eligibility,
undo/trash behavior, and automatic child relocation. Moving is deferred; this
release does not offer retaining descendants by moving them out first. If the
subtree should be retained, cancel deletion and use archiving instead.
Unresolved contracts block this whole safety-sensitive slice rather than
permitting an unprotected partial delivery.
