---
status: approved
approved_on: 2026-10-15
---

# Material Deletion Safety Contracts

## Purpose And Delivery Boundary

This agreement supplements the [Material management PRD](material-management.md)
with the Sprint and practice protections required for permanent deletion.
The user approved these rules during discovery on 2026-10-15.

[Delete unused Material safely](https://github.com/hady-salhab93/Practice-Planner/issues/8)
remains blocked until the real prerequisite workflows and persistence contracts
below are implemented and verified. This document is not implementation,
authorization to build those workflows, or evidence that deletion is safe.
Do not introduce placeholder protection tables or an always-empty eligibility
check to deliver Delete early.

The owning feature work is
[Sprint planning](https://github.com/hady-salhab93/Practice-Planner/issues/18)
and [focused practice](https://github.com/hady-salhab93/Practice-Planner/issues/20).
The [Sprint planning PRD](sprint-planning.md) now owns its approved calendar and
membership workflow; practice interaction designs remain separate discovery
work. Retain the
accepted [React Router/PostgreSQL architecture](../adr/0004-react-router-fullstack-postgresql.md);
this agreement does not choose schemas or new infrastructure.

## Sprint Membership And Protection

- Selecting Material for a Sprint includes that Material and its current
  descendants as saved memberships. Ancestors are not implicitly selected;
  unselected Material is omitted from Sprint membership views.
- Deferring selected Material removes it and its selected descendants from the
  current Sprint. It does not change the Library hierarchy or erase practice.
- A future Sprint destination is optional. Removing membership without a
  destination leaves the Material available for later selection; assigning it
  to a future Sprint creates protection through that Sprint's membership.
- Descendants added in the Library after selection do not automatically join
  the Sprint. Inclusion requires an explicit selection.
- Every existing membership protects its Material, whether the Sprint is
  future, current, or ended. Ended-Sprint membership remains intact so untouched
  Material does not disappear from historical review.
- Explicitly removing or deferring membership in a future or current Sprint
  removes that membership's protection. Other memberships and practice
  protections still apply. Deleting Material never removes Sprint memberships
  to manufacture eligibility.

For example, selecting a book includes its existing chapter and exercise.
Deferring that chapter removes both chapter and exercise memberships, while
the book remains selected. With no other memberships or practice, the deferred
chapter's subtree can become eligible for deletion; the book remains protected.
A newly added exercise requires explicit Sprint inclusion.

## Practice Protection

- Saved practice records protect their original Material. Both timed records
  and manually entered records count.
- Running, paused, and interrupted/unconfirmed practice also protect their
  Material before confirmation produces a saved record.
- Explicit deletion of an erroneous practice record, or explicit discard of
  unsaved/unconfirmed practice, removes that entry's protection. It does not
  remove protection from other practice or Sprint membership.
- Adding descendants never redistributes earlier practice. Protection follows
  the Material actually referenced by the practice entry.
- Material deletion must not delete practice, discard a timer, or retarget
  practice to bypass protection.

## Archiving Protected Material

- Archiving remains root-only and hides the entire subtree from normal Library
  browsing and search.
- Existing Sprint memberships and practice activity remain unchanged. Archiving
  must not stop, discard, or retarget a running or paused timer.
- Existing Sprint and practice context must retain access to archived Material.
- If deletion of nested Material is blocked, offer to archive its owning root.
  Name that root and clearly explain that its entire subtree will be hidden;
  do not silently archive a larger scope than the selected Material.
- For an already archived subtree, explain the protection without presenting
  archiving as a way to make permanent deletion eligible.

## Destructive Operation Contract

1. Identify the selected Material and its descendant count in confirmation.
   Cancellation changes nothing.
2. Check the selected Material and every descendant for any Sprint membership
   or practice protection, including archived Material.
3. At confirmation submission, authoritatively recheck both protection and
   subtree membership on the server. Confirmation-time eligibility alone is
   insufficient.
4. If subtree membership has changed since confirmation, require refreshed
   confirmation. Do not delete newly added descendants under an old count.
   Compare membership, not just count: exchanging one descendant for another
   must also invalidate confirmation.
5. Any newly introduced Sprint or practice protection blocks deletion.
   Explain the reason and offer the applicable archiving alternative.
6. Eligibility checking and deletion must be atomic with respect to concurrent
   hierarchy and protection changes. A successful new reference and deletion
   of its target must not both commit. Server and persistence enforcement, not
   browser state alone, must preserve this integrity.
7. Successful deletion removes only the eligible selected subtree and its
   owned content. It never removes protected records or memberships. Failed,
   stale, cancelled, or rejected deletion preserves the subtree and all
   protected data.

## Prerequisite Implementation Slices

These are proposed separate delivery slices, not published development issues
or ready-for-agent tasks. Detailed owning-feature discovery, breakdown approval,
and explicit implementation authorization are required before work starts.
Each slice must expose real user workflows through the existing application,
core operations, and PostgreSQL; bare tables or synthetic protection checks are
not completion.

### 1. Persist And Refine Sprint Material Membership

**Outcome:** select a current subtree for a real Sprint, explicitly include new
descendants, and defer a selected subtree without changing the Library.

**Status:** Story #26 now persists selection/refinement and exposes real
membership protection. Destination deferral remains unimplemented.

**Acceptance:** membership survives reload; optional future assignment produces
real membership; removal clears only the removed membership's protection;
other and ended-Sprint memberships remain protective; archived Material remains
accessible from existing Sprint context.

**Dependencies:** Stories #24 and #26 are implemented; Story #27 remains gated
for destination deferral. The PRD establishes creation, calendar lifecycle,
membership, and destination behavior. This does not require Tag filtering or
the full Sprint review UI.

### 2. Persist And Correct Practice Records

**Outcome:** save practice against one Material, including manual backfill, and
explicitly correct or delete an erroneous record without changing its Material
or the hierarchy merely to remove protection.

**Acceptance:** records survive reload and protect their original Material;
descendant-only and archived practice remains protective; deleting one record
does not remove protection from another; earlier practice stays on its original
Material when children are added.

**Dependencies:** complete record input, validation, correction, date/timezone,
and Material eligibility discovery under focused practice. This slice does not
require Tag comparisons or daily observations.

### 3. Persist In-Progress And Recoverable Practice

**Outcome:** running, paused, and interrupted/unconfirmed practice have durable
Material identity and protection until explicitly saved or discarded.

**Acceptance:** protection survives applicable reload/recovery; saving transitions
protection to the saved record without a gap; explicit discard removes only that
entry's protection; archiving preserves activity and access to its Material.

**Dependencies:** the practice-record slice and remaining timer lifecycle,
interruption/recovery, eligibility, and concurrency discovery under focused
practice. An in-memory flag is not durable protection.

### 4. Delete Eligible Material Safely

**Outcome:** deliver the existing Delete story with confirmation, root-archiving
alternatives, recovery, and authoritative atomic protection checks.

**Dependencies:** all three real prerequisite slices above, their approved
owning contracts, and persistence verification. Archive/restore and pagination
already exist; integrate deletion with page recovery and both Library views
without claiming their full browser acceptance is previously verified.

**Acceptance:** fulfil the
[existing Delete criteria](https://github.com/hady-salhab93/Practice-Planner/issues/8)
and the destructive operation contract above. Do not close the issue on the
strength of this document.

## Verification And Remaining Discovery

The user approved public core-operation PostgreSQL tests and focused real browser
workflows for [Sprint planning](sprint-planning.md#verification-agreement).
The broader deletion and practice test seams remain proposals: public core
operations against disposable PostgreSQL and user-facing workflows through real
route loaders/actions. Confirm those seams before writing their TDD tests;
follow [testing standards](../TESTING_STANDARDS.md).

Required future scenarios include eligible nested and archived deletion;
cancellation; descendant-only Sprint and practice protection; ended-Sprint
protection without practice; running/paused/unconfirmed protection; explicit
removal of one protection while another remains; stale subtree confirmation;
concurrent creation of protection; and clearly scoped root archiving. Verify
records and memberships through their public interfaces, not a synthetic
side channel.

Still unresolved in the owning features:

- The [Sprint planning PRD](sprint-planning.md) settles creation, calendar
  lifecycle, future destination semantics, and past-Sprint editing restrictions.
  Remaining naming and detailed control/error design questions are explicit
  there; approved requirements still require implementation and verification.
- Practice input/validation, date/timezone rules, correction controls, and
  eligibility to begin new practice or select archived Material.
- Timer controls, concurrency, interruption detection, and recovery mechanics.
- Exact persistence schemas and transaction/constraint mechanisms.

No implementation tests or browser acceptance checks are claimed by this
documentation-only agreement.
