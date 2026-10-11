# Domain Documentation

## Before Exploring Or Planning

1. Read the root [glossary](../../GLOSSARY.md) before naming concepts. If a root `GLOSSARY-MAP.md` is added, use it to locate the relevant context glossary. The current single-context layout has one root glossary; its behavioral descriptions remain provisional following the product-planning reset.
2. Read the approved feature PRD and relevant decisions when they exist. Until a feature has an approved PRD, establish requirements through feature interviews rather than treating the previous model as settled.
3. Read relevant ADRs under [`docs/adr/`](../adr/) for technical constraints, not product requirements. The current single-context layout keeps ADRs at the repository root.

## During Discussion

- Use consistent terms in prose, future work items, interfaces, and tests. Confirm terminology changes with the user during discovery.
- Stress-test relationships with concrete guitar-practice scenarios relevant to the feature under discussion.
- Surface contradictions with newly approved feature requirements and retained architecture decisions. Ask whether the user intends to change a decision before recording a replacement.
- Check this repository's existing implementation when it exists; distinguish actual behavior from a proposed change. Other applications are not evidence for Practice Planner's business rules.

## Recording Decisions

The glossary owns short definitions and synonyms to avoid, not schemas or feature specifications. Approved feature PRDs will own behavior, acceptance criteria, exclusions, and open questions. ADRs own reasoning behind significant trade-offs.

Update the appropriate source after agreement. Record an ADR only when a real trade-off is costly to reverse and a future reader would otherwise miss its reasoning; number it after the latest existing ADR. Keep unresolved choices explicit.
