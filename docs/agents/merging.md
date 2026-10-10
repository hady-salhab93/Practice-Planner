# Delivering A Change

## Current Boundaries

This project has no selected remote, branch policy, pull-request workflow, or CI gates. The initial project structure and toolchain are approved; product behavior still needs an explicit implementation task. This does not authorize commits, pushes, external work-item creation, or merges.

## Local Delivery

Keep a change within its approved scope and preserve unrelated user changes. Use the [validation workflow](testing.md), then report what changed and what remains unverified. Documentation completion does not mean an application capability exists.

## After Repository Workflow Selection

- Record the agreed branch and review policy and actual required checks here.
- Obtain authorization for commits, pushes, PR creation, and merging before performing them.
- Before a PR is ready, run the relevant checks and verify changed user-facing workflows; the description should connect the change to its specification and verification evidence.
- Respect branch protection and required CI gates. Approval to open a PR is not approval to bypass checks or merge it.
- Choose worktrees only if the selected workflow needs isolation. Do not copy Claude-specific paths, agent attribution, GitHub labels, or reference-project commands.
