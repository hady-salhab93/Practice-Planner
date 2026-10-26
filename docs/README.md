# Documentation Map

## Product Sources

- Product planning proceeds feature by feature. The previous application-wide specification, product ADRs, and draft implementation issues have been removed.
- [Material management and breakdown](features/material-management.md): approved feature PRD, with unresolved Sprint and timer dependencies explicit; not implemented.
- [Material deletion safety](features/material-deletion-safety.md): approved
  Sprint membership, practice protection, archiving, and stale-confirmation
  contracts, with proposed prerequisite slices. Delete remains blocked on their
  real implementation and verification.
- [Plan and refine Sprints](features/sprint-planning.md): approved calendar
  lifecycle, Material selection/refinement, and deferral requirements for
  Feature #18, with six published Story sub-issues and explicit blockers.
  Stories #24 and #26 are implemented. Story #27 implementation is in place,
  with focused browser verification outstanding; Stories #25 and #28 remain
  gated, and Tag filtering remains discovery-gated.
- [Library pagination](features/library-pagination.md): replacement release spec;
  sorting and moving are deferred. Server-side paging and page navigation are
  implemented; full acceptance verification remains open.
- [Material management implementation issues](https://github.com/hady-salhab93/Practice-Planner/issues/9): GitHub owns the implementation backlog; the feature PRD retains delivery and cross-feature gates.
- [Application decision map](planning/map.md): agreed purpose and the route toward feature boundaries and a first useful version; not an implementation plan.
- [Glossary](../GLOSSARY.md): agreed Material, Library, and classification terminology; feature PRDs own behavior.

## Retained Architecture

- [Full-stack architecture](adr/0004-react-router-fullstack-postgresql.md): React Router framework mode, server-side PostgreSQL access, and no Supabase.
- [Stack planning](STACK_PLANNING.md): workspace tooling and unresolved infrastructure choices.
- [Earlier storage decision](adr/0003-local-postgresql-first.md): superseded history, not current guidance.

## Agent Workflows

- [Code structure](agents/code-structure.md): current workspace layout and how
  the React Router application uses `packages/core`.
- [Domain documentation](agents/domain.md): consume and maintain terminology and decisions.
- [Planning](agents/planning.md): clarify requirements and approve independently verifiable slices.
- [Development backlog](agents/backlog.md): work-item conventions and publication boundaries.
- [Running checks](agents/testing.md): focused validation commands for the current workspace.
- [Delivering changes](agents/merging.md): review, authorization, and future repository gates.

## Frontend And Engineering

- [Frontend standards](FRONTEND_STANDARDS.md): visual reference, controls, layout, menus, and accessibility.
- [Frontend state](FRONTEND_STATE.md): deterministic decisions and external-effect boundaries.
- [Keyboard shortcuts](KEYBOARD_SHORTCUTS.md): consistent, scoped, accessible keyboard behavior.
- [Testing standards](TESTING_STANDARDS.md): what to test and where to test it.
- [Stack planning](STACK_PLANNING.md): delivery questions and technology evaluation criteria.

## Repository Scope

These guides define Practice Planner's own conventions. Setup, planning, and implementation require only this repository; other projects may provide optional inspiration but are not dependencies or sources of product requirements.

The workspace and application shell are implemented. Product behavior, database provisioning, and deployment are still future work.
