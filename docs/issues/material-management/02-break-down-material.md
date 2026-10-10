---
name: Break Material into nested pieces
status: planned
blocked_by: [01-capture-and-rename.md]
---

# Break Material Into Nested Pieces

## Outcome

The guitarist can turn a song or book into smaller actionable pieces and browse the resulting hierarchy.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

[Capture and rename standalone Material](01-capture-and-rename.md), including its persisted Material identity and save behavior.

## Acceptance Criteria

- [ ] Add children beneath standalone Material and beneath other children, without mandatory levels or types.
- [ ] Browse Book > Chapter > Exercise and Song > Solo > Passage > Bars in context; the hierarchy survives reload.
- [ ] Each Material has at most one parent; adding children preserves the existing parent's identity and content.
- [ ] Create or rename children using explicit Save/Cancel, retaining input after failures and warning before leaving unsaved edits.
- [ ] Reject a title conflict within the same parent using the agreed case/space comparison; allow the same title under different parents.
- [ ] New children appear at the end of their sibling group; creating children does not reorder other groups.
- [ ] Verify nested creation, sibling uniqueness, and persisted parent-child relationships through the real workflow.

## Exclusions

Moving, manual reordering, and archive controls are later slices. Adding children must not redistribute existing practice; verify that requirement when the real practice-record contract exists. Timing eligibility and effects on Sprint commitments remain unresolved cross-feature gates.
