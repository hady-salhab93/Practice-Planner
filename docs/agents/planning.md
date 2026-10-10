# Collaborative Planning

## Clarify Before Committing To Requirements

Product planning has been reset. Identify feature boundaries from user workflows, interview each feature, and confirm shared understanding before writing its PRD or implementation issues. Existing glossary descriptions and engineering examples are not approved product requirements.

1. Load the sources described in [domain guidance](domain.md).
2. Identify decisions whose prerequisites are settled. Ask those questions together using concrete scenarios, a recommendation, and its trade-off.
3. Wait for answers before exploring dependent decisions. Confirm shared understanding before promoting a proposal into an approved requirement.
4. Record vocabulary, behavior, rationale, and deferred choices in their owning documents. Check links and contradictions before calling the update complete.

Use [stack planning](../STACK_PLANNING.md) when discussing delivery constraints or technology. The initial toolchain and application structure are approved; obtain agreement before selecting unresolved infrastructure or implementing product behavior.

## Specifying A Feature

Capture the user's problem, intended outcome, user stories, concrete behavior, acceptance scenarios, exclusions, open questions, and verification expectations. Link to existing domain rules rather than restating them. Add technical decisions only after approval; a list of speculative technologies is not an implementation plan.

## Breaking Down Approved Work

Propose small end-to-end slices, not separate database, API, and UI projects. Each slice should be verifiable on its own and should identify its outcome, checkable acceptance criteria, and dependencies. Use the layers the selected architecture actually has rather than assuming every slice needs a server.

Present the order and granularity to the user. Resolve ambiguities and obtain approval before creating external work items. Follow [development backlog guidance](backlog.md) for publication; no tracker has been chosen yet.
