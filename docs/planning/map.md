---
name: Find the route to Practice Planner's first useful version
labels: ["wayfinder:map"]
status: closed
---

# Practice Planner Decision Map

## Destination

Agree on the application's purpose, overall workflow, candidate feature boundaries, and first useful version. Identify the decisions needed before individual feature PRDs and implementation issues can be written.

## Notes

- This is a discovery map, not a whole-project PRD or build plan. No implementation is authorized by it.
- Use wayfinder for breadth-first discovery, grilling for live decision conversations, and domain-modeling when terminology becomes clear.
- The architecture and tooling remain selected; product requirements are being discovered from scratch.
- The first useful workflow is recorded in [Define the minimum useful practice-and-review loop](first-useful-version.md). Approved feature boundaries and the next-stage interview order are recorded in [Agree on feature boundaries and discovery order](feature-boundaries.md).
- Local Markdown is the planning medium for this effort; no external development tracker is selected. Decision records live in this directory and use name, labels, status, assignee, and blocked_by frontmatter. An empty assignee is unclaimed. Claim an open, unblocked decision before working on it.
- Resolve one decision per session through discussion. Record its resolution in its document, close it, and add a named link below. Discover further decisions only as their questions become clear.
- Existing engineering examples and the deleted product plan are not requirements. The glossary stays empty until terms are explicitly confirmed.

## Decisions So Far

- [Establish the application's purpose and planning destination](application-purpose.md): focused practice commitments and time-based review, without assessing musical improvement; map the first useful version before feature specifications.
- [Define the minimum useful practice-and-review loop](first-useful-version.md): material breakdown, Sprint selection, timed practice, optional daily observations, review, and reuse/refinement for another Sprint.
- [Agree on feature boundaries and discovery order](feature-boundaries.md): five features approved for individual discovery, beginning with material management and breakdown; application-level mapping is complete.

## Not Yet Specified

None within this map's application-level destination. Unresolved feature details move to the individual interviews described in the handoff, rather than being treated as decided.

## Out Of Scope

- Implementing the application during this discovery effort.
- Individual feature interviews and their detailed decisions are the next effort, starting with material management and breakdown. Feature-specific dependencies, infrastructure prerequisites, exclusions, acceptance scenarios, and verification needs remain to be discovered there.
- Writing detailed feature PRDs or implementation issues before the corresponding feature interview and approval.
- Assessing musical improvement, mastery, practice quality, or efficiency automatically from recorded time.
- Selecting an external tracker, publishing work items, committing, or pushing changes.
