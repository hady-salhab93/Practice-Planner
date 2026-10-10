# Keyboard Shortcuts

## Consistency And Scope

Keep keyboard actions consistent, scoped, and guarded while users are entering text. Choose bindings for Practice Planner's approved workflows.

- The same implemented action should use the same shortcut across surfaces where it applies.
- Scope shortcuts to the active surface. A dialog owns its keyboard interactions; background shortcuts must not also fire.
- Ignore page-level shortcuts while typing in inputs, textareas, editable content, or Daily Notes. Preserve browser and assistive-technology conventions.
- Prefer one shared eligibility check once code exists rather than slightly different guards on each page.
- Keyboard users must be able to navigate controls and activate actions without knowing a shortcut. Keep focus indicators visible.
- Display supported shortcuts alongside the relevant action or tooltip, using platform-appropriate modifier labels.
- Global single-character shortcuts require an accessible way to disable or remap them, or must operate only while the relevant control has focus.

## Timer Safety

If timing is approved as a feature, keep navigation and timing separate: focus changes should not implicitly start practice. Confirm the timing workflow in its feature PRD before choosing commands or bindings.

Prevent held-key repetition from producing duplicate timing commands. A Daily Note's Space or Enter input must never start, pause, or stop practice.

## Deferred Key Map

No app-specific key bindings are selected yet. Define them with the first interaction design and verify conflicts, input guards, menus, and dialog focus in real browser tests. See [frontend standards](FRONTEND_STANDARDS.md) and [testing standards](TESTING_STANDARDS.md).
