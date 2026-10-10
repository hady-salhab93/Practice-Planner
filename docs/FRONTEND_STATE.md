# Frontend State

## Portable Principle

Use deterministic state transitions. React Router framework mode is selected in [ADR 0004](adr/0004-react-router-fullstack-postgresql.md); state libraries remain open, and pure transitions are a design principle rather than a dependency requirement.

Keep a surface's meaningful decisions in one explicit state model. Presentation renders state and reports events; external work is performed at an explicit boundary. Avoid multiple independent booleans encoding mutually exclusive states.

## Ownership And Events

- Distinguish persisted product data, temporary UI state, form drafts, and derived values. Give each value one owner.
- Express events as facts, such as Start clicked, Pause clicked, save succeeded, or save failed. Derive the next state rather than spreading decisions among lifecycle callbacks.
- Describe requested external operations with their inputs. A thin runner performs the operation and returns its outcome to the state model.
- Pass timestamps, request identities, and other external values into transitions; a pure transition does not read the clock, randomness, storage, or the DOM itself.
- Compute derived values instead of keeping separately synchronized copies. Displayed elapsed time is derived from recorded timing information and the current timestamp, not counted by assuming each interval callback ran.
- Keep domain rules behind their owning interface and enforce data integrity there as well. UI state is not the sole authority for timer uniqueness, Sprint eligibility, or historical integrity.

## Async And Recovery

Account for repeated commands, late responses, failures, retry, and leaving a surface while work is pending. Ignore an outcome only when its request or target is demonstrably obsolete; an unrelated response must not overwrite the current selection.

Product planning has been reset. Confirm recovery and timing requirements in the relevant feature interview before implementing them. Persistence, cross-tab coordination, and offline recovery mechanisms depend on approved delivery constraints; an in-memory model alone cannot satisfy a durable-recovery requirement.

Simple local presentation state may remain local when it has no coupled transition or product rule. Use an explicit model when timer state, selection, dialogs, and pending operations interact. Do not mandate a reducer for a static label or an independent hover.

## Tests

Drive meaningful event sequences through the public transition interface and assert the observable outcome and any declared external operations. Use a controllable clock. Browser tests cover the actual controls, focus, and integration with that model; avoid duplicating the same transition through every component. See [testing standards](TESTING_STANDARDS.md).
