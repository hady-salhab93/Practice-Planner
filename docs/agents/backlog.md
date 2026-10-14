# Development Backlog

## Separate Product Concepts From Project Work

The application's Library contains Material and its Sprints describe practice focus. Development work items track building the application; they are not Material or practice Sprints.

The [documentation map](../README.md) indexes approved feature PRDs. [Material management implementation issues](https://github.com/hady-salhab93/Practice-Planner/issues/9) live in GitHub rather than duplicate local issue documents; their [feature PRD](../features/material-management.md) retains the shared delivery contract and safety gates. GitHub Issues in `hady-salhab93/Practice-Planner` is the selected development tracker; see [issue-tracker guidance](issue-tracker.md). Planning approval is not authorization to start implementation. No autonomous issue-label workflow is selected.

## Before Publishing Work

- Confirm the tracker, destination repository or project, and publication authorization.
- Read the originating specification and relevant ADRs. Include their references so a new agent session can recover context.
- Follow the approved breakdown from [planning guidance](planning.md). Each work item describes delivered behavior, acceptance criteria, exclusions where needed, and dependencies.
- Check for existing work before creating duplicates. Preserve user-approved scope and vocabulary.
- Publish only after the user approves the breakdown. Do not assign automation-triggering labels or start implementation implicitly.

GitHub PRD parent issues and native sub-issues are a reference pattern, not an adopted requirement. Local plans, if requested, record execution steps; they do not replace or silently amend an approved feature PRD.
