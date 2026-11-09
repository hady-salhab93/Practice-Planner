---
status: approved
approved_on: 2026-10-15
---

# Plan And Refine Sprints

## Outcome And Approval Boundary

The guitarist selects a manageable practice focus for a calendar window, refines
that selection, and defers parts of it without changing the Library hierarchy.

This PRD records the discovery agreement confirmed on 2026-10-15 for
[Feature #18](https://github.com/hady-salhab93/Practice-Planner/issues/18), under
[Epic #16](https://github.com/hady-salhab93/Practice-Planner/issues/16).
The user approved Story publication on 2026-10-15; GitHub owns the published
backlog linked below. Story #24 was implemented first; Story #26 was explicitly
authorized by an implementation task on 2026-10-16 and is now implemented.
Story #28 was authorized on 2026-10-28 and is now implemented. Other Stories
retain the delivery and approval status recorded below.

Use the [glossary](../../GLOSSARY.md) for Material and Library terminology.
The [Material management PRD](material-management.md) owns Library behavior;
the [deletion safety agreement](material-deletion-safety.md) owns protection
across Sprints, practice, and permanent deletion.

## Prior Art And Deliberate Differences

The user selected an ADO-like calendar lifecycle after comparing official
Azure DevOps and Jira documentation:

- [Azure Boards end-of-sprint guidance](https://learn.microsoft.com/en-us/azure/devops/boards/sprints/end-sprint-activities?view=azure-devops)
  identifies the current iteration automatically from dates and does not
  automatically carry unfinished work into another iteration.
- [Jira Sprint controls](https://support.atlassian.com/jira-software-cloud/docs/enable-sprints/)
  instead use explicit Start and Complete actions.
- [Jira completion](https://support.atlassian.com/jira-software-cloud/docs/complete-a-sprint/)
  prompts for the destination of incomplete work, and
  [Jira editing](https://support.atlassian.com/jira-software-cloud/docs/edit-a-sprint-in-a-company-managed-project/)
  restricts editing completed Sprint dates.

Practice Planner uses calendar dates, not explicit Start/End actions. It
enforces non-overlapping ranges, preserves past membership, and does not add
work-item completion status to Material. Vendor workflow details are prior art,
not imported business rules. Sources were reviewed on 2026-10-15.

This supersedes the provisional interview choice of automatic starting with
explicit ending or automatic replacement. A Sprint becomes past after its
planned end even when no next Sprint exists.

## User Stories

1. As a guitarist, I want to name and schedule Sprints so I can organize a
   practice focus into clear calendar windows.
2. As a guitarist, I want the current Sprint determined automatically so I
   do not need to start and close calendar windows manually.
3. As a guitarist, I want to choose Material with its existing descendants
   so I can plan at a useful level and refine the included pieces.
4. As a guitarist, I want to defer a selected subtree, optionally to a future
   Sprint, so I can adjust scope without reorganizing my Library.
5. As a guitarist, I want past membership preserved so I can review what I
   selected without later Library edits rewriting that selection.
6. As a guitarist, I want to cancel a future Sprint without deleting Material
   or practice so I can safely change plans.
7. As a guitarist, I want Tag-based candidate filtering once classification
   exists so I can choose focus using my own dimensions.

## Approved Behavior

### Identity, Dates, And Lifecycle

- A Sprint requires a name, a start date, and an end date. Its goal is optional
  planning context, not a completion checklist or an assessment of improvement.
- Start and end are inclusive calendar dates. The end must be on or after
  the start. A Sprint ending October 25 does not overlap one starting October
  26; one starting October 25 does overlap.
- New Sprints may start today or in the future, not in the past.
- Use one saved application timezone, initially taken from the device. Once
  Sprints exist, timezone changes/migration are deferred rather than silently
  reinterpreting the schedule.
- A Sprint is future before its start, current from its start through its end,
  and past afterward, evaluated in that saved timezone. No explicit Start or
  End action is required.
- Reject overlapping Sprint date ranges, including overlap introduced by
  editing. At most one Sprint is current.
- Allow several future Sprints and gaps between ranges. During a gap, there
  is no current Sprint; an old Sprint does not remain current.
- Calendar transitions work without requiring the app to be open at midnight.
  Reopening must report the state appropriate to the current application date.
- A Sprint can be saved with no Material. An empty current Sprint prompts the
  user to select focus; it does not automatically copy or invent membership.

### Editing And Cancellation

- Future Sprints allow name, goal, and valid non-overlapping date changes.
  A changed start still cannot be backdated; starting today makes it current.
- A current Sprint's start date is fixed. Its end can be extended or shortened
  to today or later, provided the resulting range does not overlap another
  Sprint. Name and goal remain editable.
- Past Sprint dates and Material membership are locked. Name and goal can
  be corrected.
- Past Sprints are hidden by default, with a Show/Hide past Sprints control
  for historical review. This changes visibility, not membership or protection.
- Sprint plan editing and Material refinement open in right-side modal dialogs,
  keeping the list stable. Cancel discards the draft; closing a dirty dialog
  warns before discarding it. These interaction adjustments were approved
  on 2026-10-17.
- Only future Sprints can be deleted. Confirm before deleting, making clear
  that membership is removed but Material and practice are not.
- Recheck future status when executing deletion; an old confirmation cannot
  delete a Sprint that has become current.
- Explicit Save persists changes; Cancel discards the draft. Failed saves
  preserve input and saved state; warn before leaving unsaved edits, following
  the existing application conventions.

### Material Selection And Context

- Sprint Material branches start collapsed and expose a chevron control to
  expand or collapse their children. Sprint-only trees do not repeat a
  "Selected" badge. Edit and Manage Material are named icon controls in each
  Sprint header, rather than actions below its Material list (approved
  on 2026-10-19).

- Select Material from the unarchived Library into a future or current Sprint.
  Selecting a parent includes that Material and its current descendants as
  saved membership.
- Selecting nested Material does not implicitly select its ancestors. Sprint
  summaries and selected-Material drafts show only selected identities: omit
  unselected ancestors, siblings, and descendants, including children added
  later. Selected descendants of an unselected node appear under the nearest
  selected ancestor, or at the top level, without changing Library parentage.
  The Available Library picker still shows the Library hierarchy. This
  selected-only display replaces contextual ancestor rows by user request
  on 2026-10-17.
- Membership identifies existing Material; it does not clone the hierarchy
  or change parentage.
- Later children added in the Library do not automatically join a Sprint.
  Include them explicitly.
- Restore the owning root before newly selecting archived Material. Archiving
  after selection preserves existing membership and access from Sprint context.
- Selecting Material in another Sprint is explicit. There is no copy-from-Sprint
  action or automatic carry-forward in this version.
- Current Material names, hierarchy, and Tags are used in past Sprint views;
  selected identities remain preserved. Material has no completion status.

### Refinement And Deferral

- Refine future or current membership without changing the Library. Removing
  selected Material removes its selected subtree, not just the selected parent.
- Deferring a selected subtree from the current Sprint requires no destination.
  Without one, remove that membership and leave Material available for later
  selection.
- An optional destination must be an existing future Sprint. Transfer only
  Material identities selected in the source subtree; do not include previously
  excluded or newly added descendants.
- Preserve memberships elsewhere. A transfer removes source membership and
  adds destination membership together, without losing the selection if the
  destination becomes unavailable or the save fails.
- Start deferral from selected Material in the current Sprint's Manage Material
  dialog. A separate confirmation dialog offers an optional existing future
  Sprint destination. If the source selection changed after the dialog opened,
  reject the transfer, preserve the dialog, and require refreshed selection and
  explicit reconfirmation.
- Deferral never erases or redistributes practice already recorded against
  the selected Material.

### Tag-Based Candidate Filtering

- In the Manage Material dialog, provide a multi-select filter for each Tag
  group. A candidate matches any selected Tag within a group and must match at
  least one selected Tag in every group with an active filter.
- Match direct Tag assignments only. A Tag assigned to an ancestor does not
  match its descendants.
- Filtering changes candidate visibility only; it does not change Library
  hierarchy or saved Sprint membership. Filters are temporary, remain selected
  after a recoverable error, and clear when the dialog closes.
- When a matching nested Material has nonmatching ancestors, show those
  ancestors as context only, without selection controls. Only direct matches
  are selectable.
- Selecting a matching Material includes its full current subtree, including
  descendants that do not match the filters. Before selection, show the number
  of such descendants inline; do not require a second confirmation. Show all
  included Material in the Selected tree after selection.
- Preserve the existing rules for explicit selection, archived Material,
  subtree inclusion, past-Sprint locks, and deferral.

### Protection And Classification

- Every existing membership protects its Material from permanent deletion,
  including membership in a past Sprint.
- Explicit removal, deferral without a destination, or deletion of a future
  Sprint removes only that membership's protection. Other Sprint memberships
  and any practice protection continue to apply.
- Archiving does not stop, discard, or retarget existing practice activity.
- Tag filtering is an agreed later selection capability: OR within a Tag
  group and AND across groups, using direct assignments rather than inheritance.
  It depends on real classification implementation and does not block initial
  scheduling or hierarchy selection.

## Published Story Breakdown

Keep the development hierarchy **Epic #16 -> Feature #18 -> Stories**.
Each Story delivers an end-to-end workflow through the existing React Router
application, core operations, and PostgreSQL. Implementation checklists belong
inside Stories, not in a new Task layer.

The user approved six Stories, splitting creation/browsing from editing so
each remains a manageable vertical slice. GitHub owns their acceptance criteria,
readiness, native blocking relationships, and issue state; do not maintain
duplicate local issue bodies.

| Story                                                                                                          | Direct blockers |
| -------------------------------------------------------------------------------------------------------------- | --------------- |
| [#24: Create and browse calendar Sprints](https://github.com/hady-salhab93/Practice-Planner/issues/24)         | None            |
| [#25: Edit Sprint plans safely](https://github.com/hady-salhab93/Practice-Planner/issues/25)                   | #24             |
| [#26: Select and refine Sprint Material](https://github.com/hady-salhab93/Practice-Planner/issues/26)          | #24             |
| [#27: Defer selected Material to a future Sprint](https://github.com/hady-salhab93/Practice-Planner/issues/27) | #26             |
| [#28: Delete a future Sprint safely](https://github.com/hady-salhab93/Practice-Planner/issues/28)              | #26             |
| [#29: Filter Sprint selection by Tags](https://github.com/hady-salhab93/Practice-Planner/issues/29)            | #26 and #35     |

All six are native sub-issues of Feature #18. No `ready-for-agent` labels were
applied. Story #24 and Story #26 were implemented under explicit
implementation authorization. Story #27 has now been authorized; Stories #25
and #29 remain gated. Story #28 was authorized by the next-available-issue
implementation request on 2026-10-28 and is now implemented. The Story #27
confirmation and stale-selection interaction choices are recorded under
Refinement And Deferral.

Tag-filtering interaction discovery was resolved on 2026-10-29 and is recorded
above. Classification implementation is tracked in [Story #35](https://github.com/hady-salhab93/Practice-Planner/issues/35), a child of Material Management #9. Story #29 has a native blocker on #35 and remains gated until that workflow is implemented and verified. The
[cross-feature requirements](https://github.com/hady-salhab93/Practice-Planner/issues/15)
are a requirements source, not an actionable completed blocker. #29 also remains
blocked by #26 until its membership workflow is available.

Stories #24 and #26 are implemented. Story #27 implementation is in place, but
its focused browser verification remains outstanding. Stories #25 and #29
remain gated; Story #28 is implemented and verified. No prefactoring Story is
justified by the current evidence.

## Verification Agreement

The user approved these seams for TDD on 2026-10-15:

- Public core operations backed by disposable PostgreSQL, observing saved
  outcomes through public interfaces rather than direct-SQL side channels or
  mocked internal collaborators.
- Focused real browser workflows through the application's loaders/actions for
  scheduling, selection, deferral, destructive confirmation, navigation, and
  visible recoverable errors.
- Explicit controlled date/timezone inputs for calendar tests, including day
  boundaries and timezone/DST changes rather than machine-local assumptions.

Follow [testing standards](../TESTING_STANDARDS.md) and
[running checks](../agents/testing.md). Implement one failing behavioral test
and its minimal working slice at a time. Story #24 core operations are tested
against disposable PostgreSQL with controlled time and timezone inputs. A
focused browser check verified creation, reloading, recoverable overlap errors,
the empty-current state, Cancel, and the unsaved-navigation warning at narrow
and desktop widths in both themes. Story #26 adds PostgreSQL-backed checks for
subtree membership, nested selection without ancestors, later descendants,
removal scoped to one Sprint, membership protection, archive behavior, and
past-Sprint locking. Its route workflow was checked for subtree selection,
Cancel, saving, reload-visible membership, and subtree removal; the editor was
also checked at narrow dark and desktop light viewports.

Story #27 adds PostgreSQL-backed checks for exact subtree transfer, removal
without a destination, preservation of other Sprint membership, stale-selection
rejection, and future-source rejection. Its real browser deferral workflow has
not yet been verified.

The 2026-10-17 layout adjustment was checked through the real route workflow:
past-Sprint visibility, selected-only saved and draft trees, side-dialog Save
and Cancel, recoverable validation errors, dirty-dismiss confirmation, keyboard
focus containment and restoration, and mobile navigation. Panel bounds and
horizontal overflow were checked at narrow and desktop widths in both themes.

Story #28 adds public PostgreSQL-backed checks for future-Sprint deletion,
membership cleanup, preservation of Library Material and other Sprint
memberships, and current/past rejection at the saved-timezone date boundary.
Browser verification covered confirmation scope, Cancel with saved membership,
reload, deletion, preservation of another Sprint's shared membership, initial
focus, Tab containment, Escape dismissal, and long names at desktop and narrow
widths in both themes. A current Sprint's confirmation was opened directly to
exercise the real server rejection and retained error context; the actual
future-to-current transition is verified by the controlled-clock core test.
The temporary browser Sprint and its membership were removed. Practice
persistence does not exist yet, so practice-integrity verification remains
unclaimed; this change adds no practice schema or deletion operation.

## Cross-Feature Gates And Remaining Questions

- Delete Material remains blocked until real Sprint memberships, saved practice,
  and in-progress/recoverable practice protection are implemented and verified.
  Story #26 resolves only the Sprint portion of that gate.
- Practice date attribution, recording outside a current Sprint, archive
  eligibility for new practice, timer lifecycle/concurrency/recovery, and
  practice corrections belong to focused-practice discovery. Do not assume
  completing a calendar Sprint stops a timer or modifies practice.
- Practice reports and daily observations must use the saved application
  timezone consistently once their contracts are approved; their date/input
  semantics are not finalized by this Sprint PRD.
- Story #24 currently trims names, rejects blank names, allows duplicate names,
  and prevents duplicate form submission while saving. These are conservative
  implementation defaults, not a broader uniqueness policy.
- Story #26 uses separate Available Library and Selected Sprint trees, draft
  Save/Cancel, and disabled selection controls while saving. These interaction
  choices were confirmed during implementation on 2026-10-16.
- Exact schema, concurrency/constraint mechanisms, routes, and component
  primitives are implementation decisions, not new product vocabulary.
- Story #29 requires additional filter interaction discovery, including controls,
  matching-descendant context, and communicating subtree inclusion from filtered
  candidates.
- No infrastructure changes, automatic work completion, practice redistribution,
  or application-generated improvement assessment are approved here.
