---
name: Describe Material and manage references
status: planned
blocked_by: [01-capture-and-rename.md]
---

# Describe Material And Manage References

## Outcome

The guitarist can describe what Material refers to and retain useful external references with it.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

[Capture and rename standalone Material](01-capture-and-rename.md). The same metadata behavior must work for children once nested Material exists; it is not a separate kind of Material.

## Acceptance Criteria

- [ ] Add, edit, or clear an optional plain-text description; preserve line breaks when saved and displayed.
- [ ] Add multiple reference links, with or without labels, and view the saved references with their Material.
- [ ] Edit link destinations and labels and remove links independently, without changing unrelated references or Material identity.
- [ ] Use explicit Save/Cancel; cancelled edits leave saved metadata unchanged.
- [ ] Warn before leaving unsaved changes and preserve relevant entered values after failed saves.
- [ ] Metadata survives navigation and reload; verify the complete persistence workflow and failure behavior.

## Exclusions

Rich text, uploads, embedded playback, and sheet-music rendering. Archived metadata editing is integrated in Slice 7.
