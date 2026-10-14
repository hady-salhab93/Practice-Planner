---
name: Archive and restore Material
status: planned
blocked_by:
  [
    03-descriptions-and-references.md,
    06-find-material.md,
  ]
---

# Archive And Restore Material

## Outcome

The guitarist can set aside Material and later recover it without losing its structure, ordering, or independently archived descendants.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

[Describe Material and manage references](03-descriptions-and-references.md) and
[Find Material in context](06-find-material.md). Sorting and moving are deferred,
not prerequisites. Preserve the existing saved sibling sequence without adding
user-controlled ordering. When pagination is present, archive/restore must keep
its page counts and out-of-range recovery consistent.

## Acceptance Criteria

- [ ] Archive Material and hide its entire subtree from normal browsing and title search, without deleting identities or content.
- [ ] Browse and separately search archived Material, including descendants hidden by an archived ancestor, with ancestor context.
- [ ] Restore Material with its subtree except descendants archived independently before their ancestor; preserve relative sibling positions and content.
- [ ] Require restoring archived ancestors before restoring a child independently; never move it or restore ancestors silently.
- [ ] Edit titles, descriptions, and links in the archived view using the established Save/Cancel and failure behavior.
- [ ] Include archived siblings in title uniqueness for create and rename operations, even when the conflicting Material is absent from the normal view.
- [ ] Require restoration before adding children; Material hidden by an archived ancestor is not available as an unarchived parent.
- [ ] Failed archive/restore operations leave the saved state unchanged; successful changes survive reload.
- [ ] Verify independent-child archive > ancestor archive > ancestor restore, archived editing/search, conflict protection, and mutation guards through the real workflow.

## Exclusions

Permanent deletion is Slice 8. User-controlled sorting and moving, including
move-specific archive guards, are deferred. Effects on Sprint selection,
existing commitments, or a running timer remain unresolved integration gates.
Verify ended-Sprint context and recorded-practice preservation with later
feature contracts rather than declaring them complete from this slice's Library
tests.
