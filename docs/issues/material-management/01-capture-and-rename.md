---
name: Capture and rename standalone Material
status: complete
blocked_by: []
---

# Capture And Rename Standalone Material

## Outcome

The guitarist can capture a titled song, book, or other standalone Material, see it in the Library, and rename it later without recreating it.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

Database setup is resolved for this slice: PostgreSQL runs in local Docker Compose, bound to localhost with a persistent named volume. Backup setup is deferred. This issue includes its own minimal Material persistence and server/UI wiring; database setup is not a separate product-feature slice.

## Acceptance Criteria

- [x] Create standalone Material using a required title and see it in the Library; no type, parent, or completion state is required.
- [x] Saved Material remains after leaving the view and reloading the application.
- [x] Rename Material while preserving its identity; Save persists and Cancel leaves the saved title unchanged.
- [x] Reject conflicting standalone titles, ignoring capitalization and surrounding spaces, and identify the conflicting Material without overwriting or automatically renaming it.
- [x] New standalone Material appears at the end of the Library group.
- [x] Warn before leaving unsaved edits; validation or save failures preserve relevant input for correction or retry.
- [x] Verify UI-to-persistence success and failure behavior and authoritative uniqueness enforcement, not just client-side guards.

## Exclusions

Children, descriptions, references, manual reordering, search, archive controls, and deletion are later slices. Include archived siblings in uniqueness once archiving is introduced; this slice must not require a redesign of the agreed uniqueness rule. Sprint and timing integration remain subject to the shared gates.
