---
name: Find Material in context
status: planned
blocked_by: [02-break-down-material.md]
---

# Find Material In Context

## Outcome

The guitarist can find Material across the Library and identify where similarly titled pieces belong.

Source: [approved PRD](../../features/material-management.md). Apply the shared [delivery contract and gates](README.md).

## Dependencies

[Break Material into nested pieces](02-break-down-material.md).

## Acceptance Criteria

- [ ] Search titles across standalone and nested Material without case sensitivity.
- [ ] Search results show ancestor paths, distinguishing identically titled exercises under different books.
- [ ] Selecting a result opens the matching Material in its hierarchy context.
- [ ] Show a usable no-results state and a recoverable search failure without losing the search input.
- [ ] Verify matching and contextual navigation against persisted nested Material, not a static sample list.

## Exclusions

Description/link search, tags, categories, and prioritization. Slice 7 adds archive filtering and separate archived search; the normal search must then exclude all Material hidden by archiving.
