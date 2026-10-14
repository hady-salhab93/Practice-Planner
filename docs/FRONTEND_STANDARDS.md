# Frontend Standards

## Visual Direction And Scope

Use neutral shadcn new-york styling, Inter typography, Lucide icons, restrained borders, compact controls, and system-driven light and dark themes. Preserve this work-focused appearance rather than creating a marketing page or a guitar-themed decorative interface.

React Router framework mode is selected in [ADR 0004](adr/0004-react-router-fullstack-postgresql.md). Tailwind CSS and Lucide are selected as the styling and icon foundations; add component primitives as concrete workflows need them. Product planning has been reset; future approved feature PRDs will own behavior. Product-specific examples here are design guidance, not feature approval.

## Design Tokens

The following values define the visual baseline. Use semantic tokens rather than scattering literals through components.

| Token            | Light                     | Dark                      |
| ---------------- | ------------------------- | ------------------------- |
| Background       | oklch(1 0 0)              | oklch(0.145 0 0)          |
| Foreground       | oklch(0.145 0 0)          | oklch(0.85 0 0)           |
| Muted surface    | oklch(0.97 0 0)           | oklch(0.269 0 0)          |
| Muted foreground | oklch(0.556 0 0)          | oklch(0.708 0 0)          |
| Border           | oklch(0.922 0 0)          | oklch(1 0 0 / 10%)        |
| Primary          | oklch(0.205 0 0)          | oklch(0.922 0 0)          |
| Destructive      | oklch(0.577 0.245 27.325) | oklch(0.704 0.191 22.216) |

- Follow the system color preference as the baseline. A manual theme override has not been agreed.
- Use Inter with a sans-serif fallback, normal letter spacing, and restrained heading sizes. Standard button text is 14px with medium weight.
- The radius baseline is 10px, with 6px small and 8px medium radii. Compact controls use the medium radius; keep shapes consistent rather than introducing pill-shaped panels.
- Button heights are 32px small, 36px default, and 40px large; icon buttons are 36px square and common icons are 16px. Increase hit areas when needed for touch accessibility without changing the visual language.
- Use semantic chart and status colors sparingly. Color alone must not carry a status, and text and focus contrast must be verified in both themes.

## Layout And Density

- Favor scan-friendly rows, indented hierarchy, toolbars, and tables over decorative card grids. Use spacing, alignment, and subtle separators to show structure.
- Give the current practice item and timer clear prominence without hero-scale typography. Keep timer dimensions stable as digits change, using tabular numerals.
- Use panels when content genuinely needs framing; avoid nested cards and floating-card styling for every page section.
- Long material titles must wrap or truncate with access to the full name. They must not obscure actions or make controls shift.
- On narrow screens, preserve hierarchy and all core actions. Wide Sprint Reports may scroll within their own table region rather than forcing the whole page to overflow.
- Initial screens should present the usable practice workflow, not a promotional landing page. Navigation structure remains a design task, not an assumed product requirement.

## Controls And States

- Reuse supported buttons, inputs, menus, dialogs, tooltips, and tables consistently. Prefer the chosen stack's accessible primitives to hand-built equivalents.
- Use Lucide icons where available, familiar symbols for timer and tool actions, checkboxes or toggles for binary choices, and inputs or pickers for values.
- Give icon-only controls accessible names and descriptive tooltips. Visible label text is appropriate for clear commands and menus.
- Provide coherent hover, focus-visible, disabled, selected, loading, validation-error, and empty states. Pending operations must not permit accidental duplicate actions.
- Keep operation failures visible and recoverable while preserving relevant input. Empty-state wording should describe the current state and provide an applicable action, not advertise features.

## Entity Action Menus

Adapt these interaction conventions from the reference's action-menu standards without importing its components or course actions:

1. Give an entity with actions a visible Actions menu. Where right-click is supported, it opens the same action list; touch and keyboard users must not depend on right-click.
2. Group actions in this order when applicable: open, edit, create, move, run, copy, danger. Put separators between groups rather than between every item.
3. Use verb-first Title Case labels. Omit the menu entity's noun when obvious, such as Rename. Use the same label and icon for the same action everywhere.
4. An ellipsis means more input is required before execution. Use Archive for recoverable material removal and Remove from Sprint for changing membership; Delete is not a synonym for either.
5. Put destructive actions last with destructive styling. Confirm irreversible operations. Do not add actions that are absent from the specification.
6. Hide inapplicable actions; disable temporarily unavailable ones and make the reason discoverable. Keep submenu depth to one level.
7. Use one icon size and show shortcut hints only for implemented shortcuts. Copy Link is conditional on a future deep-link design, not a new approved feature.
8. Close Actions menus when focus leaves the menu. Moving focus between the trigger and its actions must keep it open; returning to a row must not reopen a dismissed menu.

## Accessibility And Verification

Use semantic controls and tables, associated labels, visible focus, keyboard operability, and proper dialog focus entry and return. Do not announce timer changes every second to assistive technology; announce meaningful transitions instead. Respect reduced-motion preferences.

Before a UI change is delivered, verify real content in both themes and at desktop and narrow widths, including long names, deep nesting, zero practice, loading, and errors. Check timer controls and menus with keyboard and touch-capable interactions. See [keyboard guidance](KEYBOARD_SHORTCUTS.md), [state guidance](FRONTEND_STATE.md), and [testing standards](TESTING_STANDARDS.md).

No UI, browser screenshots, or pixel match has been verified yet. These standards document inspected source conventions; visual proof follows implementation.
