# Material Management Implementation Slices

Breakdown approved on 2026-10-11 from the [Material Management and Breakdown PRD](../../features/material-management.md). These are local implementation issue documents, not published tracker issues. Approval covers the breakdown; starting implementation requires an explicit task.

## Delivery Contract

Each slice delivers a usable workflow through the UI in `apps/local`, React Router loaders/actions, domain operations and PostgreSQL persistence in `packages/core`, plus focused tests. Add only the schema, server operations, and controls needed by that slice. Do not replace these outcomes with separate database, API, or frontend projects.

All slices follow the [glossary](../../../GLOSSARY.md), [frontend standards](../../FRONTEND_STANDARDS.md), [testing standards](../../TESTING_STANDARDS.md), and [running checks](../../agents/testing.md). Verify user-visible success and failure paths, persistence after reload, and relevant integrity risks. An unchecked criterion describes future work, not passing verification.

`planned` means an approved slice that is not implemented or automatically ready to start. `blocked` additionally identifies unresolved contracts beyond preceding slices. Read each issue's dependencies and this index before starting. Dependency lists describe required outcomes; a preceding file's existence does not satisfy them.

## Slices

| Slice | Issue                                                                        | Dependencies                                               | Status  |
| ----- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| 1     | [Capture and rename standalone Material](01-capture-and-rename.md)           | Database setup decision and usable persistence environment | Planned |
| 2     | [Break Material into nested pieces](02-break-down-material.md)               | Slice 1                                                    | Planned |
| 3     | [Describe Material and manage references](03-descriptions-and-references.md) | Slice 1                                                    | Planned |
| 4     | [Reorder Material](04-reorder-material.md)                                   | Slice 2                                                    | Planned |
| 5     | [Move Material with its descendants](05-move-material.md)                    | Slices 2 and 4                                             | Planned |
| 6     | [Find Material in context](06-find-material.md)                              | Slice 2                                                    | Planned |
| 7     | [Archive and restore Material](07-archive-and-restore.md)                    | Slices 3, 4, 5, and 6, transitively Slice 2                | Planned |
| 8     | [Delete unused Material safely](08-delete-unused-material.md)                | Slice 7 and real Sprint/practice-reference contracts       | Blocked |

## Cross-Feature Gates

- **Database setup:** resolve the placement and setup decisions needed for the first slice using [stack planning](../../STACK_PLANNING.md). Do not provision a host or choose unresolved infrastructure implicitly.
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
