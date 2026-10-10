# Practice Planner Agent Guidance

## Scope

Product planning proceeds through feature-by-feature discovery. The [documentation map](../docs/README.md) indexes approved feature PRDs and local implementation slices with explicit dependencies. Approval of a breakdown does not authorize starting implementation. The architecture, initial application structure, and stack remain approved; implementing product behavior requires agreed feature requirements and an explicit task. Follow settled technology choices in the stack-planning guide and ask before choosing unresolved infrastructure. This repository's documentation and configuration stand on their own; other projects are optional inspiration, not required workspace context or sources of business rules.

## Read By Task

- For orientation, read [README](../README.md).
- For the full documentation map, read [docs/README](../docs/README.md).
- Before naming concepts or discussing relationships, read the [glossary](../GLOSSARY.md) and [domain guidance](../docs/agents/domain.md). Use agreed terms and confirm new vocabulary during feature discovery.
- Before specifying, decomposing, implementing, or reviewing behavior, consult the approved feature PRD when one exists. Resolve requirements with the user when it does not.
- Before requirements interviews or decomposition, read [planning guidance](../docs/agents/planning.md). Before publishing work items, read [backlog guidance](../docs/agents/backlog.md).
- Before changing the stack or infrastructure, read [stack planning](../docs/STACK_PLANNING.md) and the relevant ADR. Keep new setup consistent with the approved workspace structure.
- Before frontend design or UI work, read [frontend standards](../docs/FRONTEND_STANDARDS.md). For state or keyboard changes, also read [frontend state](../docs/FRONTEND_STATE.md) or [keyboard shortcuts](../docs/KEYBOARD_SHORTCUTS.md).
- Before writing or reviewing tests, read [testing standards](../docs/TESTING_STANDARDS.md). Before validation or delivery, read [running checks](../docs/agents/testing.md) and [delivery guidance](../docs/agents/merging.md).

## Sources And Boundaries

The glossary owns terminology; approved feature PRDs own behavior; ADRs own rationale. The removed application-wide specification, product ADRs, and draft issues are not active requirements. Glossary descriptions and engineering examples do not replace feature requirements. Link to current sources instead of duplicating rules here. Preserve explicit open questions until the user resolves them.

The application's Library and Sprints concern guitar practice, not the project's development issue tracker. No development tracker, remote repository, or autonomous issue-label workflow has been selected; external publication, commits, and pushes require authorization.

For documentation changes, check local links, vocabulary consistency, and alignment with approved requirements. For code changes, use the project's scripts and focused behavioral checks; report checks run and any unverified requirements. Establish product behavior through approved feature requirements.
