# Testing Standards

## What Earns A Test

Test an observable behavior that could plausibly fail for a real user or caller. Use the public interface and representative scenarios from the relevant approved feature PRD; survive internal refactors rather than restating how the code is written.

Product planning has been reset. Choose coverage from each feature's approved behavior and risks. Domain examples elsewhere in this guide illustrate test techniques, not approved requirements. Resolve relevant open questions before asserting an invented behavior.

## Boundaries And Test Levels

- Exercise real internal collaborators. Substitute external systems, clocks, or nondeterministic boundaries where control is necessary; avoid mocking the behavior under test.
- Test pure domain rules and state transitions directly through their public interfaces with controllable time and event sequences.
- Use integration tests for persistence and integrity contracts where a pure rule cannot prove durable behavior.
- Use browser or component tests for control wiring, accessibility, focus ordering, keyboard guards, layout, and browser-specific lifecycle behavior.
- Use a small number of end-to-end checks for the complete material-to-Sprint-to-practice-to-report workflow. Do not assume pure timer tests prove recovery after reload.
- Test timezone and daylight-saving behavior with explicit zones and timestamps rather than the machine's current timezone.

## Low-Value Tests To Avoid

Avoid private helper tests, internal collaborator call-count assertions, static-markup snapshots, near-duplicates, and tests merely proving a third-party library works. Do not duplicate the same business rule at every UI, route, and persistence layer; add a test at another layer only for a distinct integration failure.

Find controls by accessible role or label and assert user-visible results. CSS class snapshots are not visual proof; use the real application styles when checking layout and themes.

## Iteration And UI Evidence

Build one meaningful failing scenario, make it pass, and then extend coverage as behavior is added. For bug fixes, retain a regression scenario that fails without the fix.

The frontend look needs real desktop and narrow-viewport checks in both themes, including long titles, deep trees, menus, timer controls, and wide reports. Visual checks complement behavioral tests rather than replacing them. Follow [running checks](agents/testing.md) for execution and [frontend state](FRONTEND_STATE.md) for state-boundary guidance.

Vitest is selected and configured, but no product behavior tests exist yet. Browser automation and CI are not selected. Keep the actual executable commands in the workspace scripts and [running-checks guide](agents/testing.md).
