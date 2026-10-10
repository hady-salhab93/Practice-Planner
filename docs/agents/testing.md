# Running Checks

Use [testing standards](../TESTING_STANDARDS.md) to decide what deserves a test. This document defines how to validate a change, not which testing libraries to install.

## Documentation Phase

Check changed documents for valid local links and heading anchors, consistent glossary terms, alignment with approved requirements, clear unresolved choices, and Markdown diagnostics. Read the meaning as well as checking keywords: different wording is not necessarily missing coverage.

The workspace now provides `pnpm check` for typecheck, lint, and tests, `pnpm build` for a production build, and `pnpm dev` to start the local app. Both packages currently allow an empty test suite; passing `pnpm check` does not verify product behavior.

## Code Validation

1. Inspect the actual project scripts and the nearest relevant tests.
2. Run the cheapest behavior-scoped check after the first substantive edit. Repair a local failure and rerun that check before widening the change.
3. While iterating, target the test files or cases covering the change. Add relevant type, lint, integration, or browser checks when the change warrants them.
4. Run the agreed broader release gates before delivery. Targeted local checks are not a substitute for a full suite unless an established CI gate actually provides it.
5. Report checks run, failures, and unverified requirements. A failing check is not dismissed as flakiness without evidence.

For UI changes, validate meaningful desktop and narrow-viewport layouts, keyboard access, focus, themes, and the real workflow when an app can be launched. The configured frontend uses React Router, Vite, Tailwind CSS, and Lucide.
