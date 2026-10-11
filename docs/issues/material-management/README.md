# Material Management Implementation Slices

Breakdown approved on 2026-10-11 from the [Material Management and Breakdown PRD](../../features/material-management.md). Its parent specification is published as [#9 Material Management and Breakdown](https://github.com/hady-salhab93/Practice-Planner/issues/9), with the eight GitHub issues below linked as native sub-issues. These local documents preserve the approved slice details. Approval covers the breakdown, not implementation; starting implementation requires an explicit task.

## Delivery Contract

Each slice delivers a usable workflow through the UI in `apps/local`, React Router loaders/actions, domain operations and PostgreSQL persistence in `packages/core`, plus focused tests. Add only the schema, server operations, and controls needed by that slice. Do not replace these outcomes with separate database, API, or frontend projects.

All slices follow the [glossary](../../../GLOSSARY.md), [frontend standards](../../FRONTEND_STANDARDS.md), [testing standards](../../TESTING_STANDARDS.md), and [running checks](../../agents/testing.md). Verify user-visible success and failure paths, persistence after reload, and relevant integrity risks. An unchecked criterion describes future work, not passing verification.

`planned` means an approved slice that is not implemented or automatically ready to start. `blocked` additionally identifies unresolved contracts beyond preceding slices. `complete` means the slice's acceptance criteria have been verified. Read each issue's dependencies and this index before starting. Dependency lists describe required outcomes; a preceding file's existence does not satisfy them.

## Slices

| Slice | Issue                                                                        | GitHub issue                                                     | Dependencies                                             | Status   |
| ----- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| 1     | [Capture and rename standalone Material](01-capture-and-rename.md)           | [#1](https://github.com/hady-salheb93/Practice-Planner/issues/1) | Local Docker Compose PostgreSQL, persistent named volume | Complete |
| 2     | [Break Material into nested pieces](02-break-down-material.md)               | [#2](https://github.com/hady-salhab93/Practice-Planner/issues/2) | Slice 1                                                  | Complete |
| 3     | [Describe Material and manage references](03-descriptions-and-references.md) | [#3](https://github.com/hady-salhab93/Practice-Planner/issues/3) | Slice 1                                                  | Complete |
| 4     | [Sort Material by title](04-reorder-material.md)                              | [#4](https://github.com/hady-salhab93/Practice-Planner/issues/4) | Slice 2                                                  | Planned  |
| 5     | [Move Material with its descendants](05-move-material.md)                    | [#5](https://github.com/hady-salhab93/Practice-Planner/issues/5) | Slices 2 and 4                                           | Planned  |
| 6     | [Find Material in context](06-find-material.md)                              | [#6](https://github.com/hady-salhab93/Practice-Planner/issues/6) | Slice 2                                                  | Planned  |
| 7     | [Archive and restore Material](07-archive-and-restore.md)                    | [#7](https://github.com/hady-salhab93/Practice-Planner/issues/7) | Slices 3, 4, 5, and 6, transitively Slice 2              | Planned  |
| 8     | [Delete unused Material safely](08-delete-unused-material.md)                | [#8](https://github.com/hady-salhab93/Practice-Planner/issues/8) | Slice 7 and real Sprint/practice-reference contracts     | Blocked  |

## Cross-Feature Gates

- **Database setup:** Slice 1 uses local Docker Compose PostgreSQL on localhost with a persistent named volume; backups are deferred. See [stack planning](../../STACK_PLANNING.md). This does not approve production hosting or other infrastructure.
- **Deletion protection:** Slice 8 requires approved and implemented Sprint-reference and practice-record contracts. Do not invent those schemas or hardcode a permanently empty protection check.
- **Planned/active Sprint integration:** resolve how breakdown, moves, archiving, and restoration affect commitments before connecting Library mutations to Sprints. Relevant Library-only slices do not prove those interactions.
- **Running-timer integration:** resolve hierarchy/archive changes during timing and future timing eligibility in the timing interview. Do not silently start, stop, or retarget a timer from Library actions.
- **Historical integrity:** retain prior practice on Material when children are added, and retain ended-Sprint names/grouping with access to current Material. Complete these checks against the real timing and review contracts, not invented copies. These are required integration acceptance checks, not optional follow-up cleanup.

Basic Library outcomes can be implemented before those later features exist. Once Sprints or timers are connected, resolve and verify the applicable gates before considering the integrated workflows complete.

## PRD Scenario Coverage

| PRD Acceptance Scenario | Owning Slice Or Gate                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| 1                       | Slices 1 and 2                                                           |
| 2                       | Slice 3                                                                  |
| 3                       | Slices 1, 2, and 3; archived editing in Slice 7                          |
| 4                       | Slices 1 and 2; archived conflicts in Slice 7                            |
| 5                       | Slice 5; attached-practice preservation at the historical-integrity gate |
| 6                       | Slice 5                                                                  |
| 7                       | Slices 2, 4, 5, and 7                                                    |
| 8                       | Slice 6; archived filtering/search in Slice 7                            |
| 9, 10, 11               | Slice 7                                                                  |
| 12, 13                  | Slice 8                                                                  |
| 14, 15                  | Historical-integrity gate, completed with later feature contracts        |
