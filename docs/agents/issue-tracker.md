# Issue tracker: GitHub

Issues for this repo live in GitHub Issues at `hady-salheb93/Practice-Planner`. Use the `gh` CLI with the explicit `--repo hady-salheb93/Practice-Planner` option; do not rely on remote inference.

## Issue operations

- Create: `gh issue create --repo hady-salheb93/Practice-Planner --title "..." --body "..."`
- Read: `gh issue view <number> --repo hady-salheb93/Practice-Planner --comments`
- List open issues: `gh issue list --repo hady-salheb93/Practice-Planner --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --repo hady-salheb93/Practice-Planner --body "..."`
- Add or remove labels with `gh issue edit` and the explicit repo option.
- Close only when authorized: `gh issue close <number> --repo hady-salheb93/Practice-Planner --comment "..."`

## Ticket dependencies

Use GitHub's native issue dependencies for blocking relationships where available. The blocker reference requires the blocker's numeric database ID, not its issue number. If native dependencies are unavailable, include a `Blocked by: #<number>` line in the dependent issue body.

## Pull requests as a triage surface

**No.** Pull requests are not treated as feature requests for triage.

## Wayfinding

- Use one map issue for the Notes, Decisions-so-far, and Fog; label it `wayfinder:map`.
- Link child tickets as GitHub sub-issues where available. Otherwise, maintain a task list in the map and identify the parent in each child.
- Represent blockers with native issue dependencies where available; otherwise state them in the child issue body.
- Follow the wayfinding skill for claiming and resolving tickets. Do not close or modify a parent issue unless explicitly authorized.

## Publication and labels

Publish only after the user approves the breakdown. Do not apply `ready-for-agent` or other automation-triggering labels unless agent implementation is explicitly approved for that ticket. See [triage-labels](triage-labels.md) for the canonical label mapping.
