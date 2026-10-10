# Stack Planning

## Status And Decision Boundary

React Router framework mode, traditional server-side PostgreSQL access, initial personal local application use, and the application structure and toolchain are approved. Supabase is excluded. PostgreSQL placement, installation, backup, and access restrictions remain open. Product planning has been reset; future approved feature PRDs will own behavior. The [frontend standards](FRONTEND_STANDARDS.md) own the agreed visual direction. Product examples below illustrate evaluation concerns, not approved feature requirements.

Practice Planner uses its own pnpm/Turbo workspace and local development tooling. Package manifests and the lockfile own dependency versions; setup and maintenance require no other project checkout. Add tools and packages only for this application's needs.

## Confirmed Choices

- Serve the author's own guitar practice locally first. Public availability to other users is a future possibility, not a first-release requirement.
- Use React Router framework mode as a traditional full-stack React application, with server-side loaders and actions in the same application as the UI.
- Route reads and writes through server-side domain operations and PostgreSQL access. Keep credentials server-side and enforce integrity through the domain boundary, database constraints, and transactions.
- Use PostgreSQL for persistence. Supabase is not selected for database hosting, authentication, APIs, or client access.
- The selected tooling is pnpm workspaces, Turbo, Node.js, TypeScript, React 19, React Router framework mode with its Node server adapter, Vite, Drizzle ORM, `pg`, Vitest, Oxlint, Prettier, Tailwind CSS, and Lucide. Consult this repository's package manifests and lockfile for versions.
- Keep the React Router application in `apps/local` and domain/database ownership in `packages/core`; add other apps or packages only for an approved requirement.
- The browser and application server run locally initially. PostgreSQL location is still open; local application use does not require a database on the same machine or imply offline operation.
- Database placement, installation, backup, local access restrictions, and UI component primitives remain open. See [ADR 0004](adr/0004-react-router-fullstack-postgresql.md); [ADR 0003](adr/0003-local-postgresql-first.md) is superseded.

## Approved Request Flow

The browser requests a page or submits an action. A React Router server loader or action calls the relevant domain operation, which reads or writes PostgreSQL and returns a result to the UI. Sensitive configuration and authoritative mutation rules live on the server; UI guards improve usability but do not replace those rules.

No separate UI API service is required by this architecture. External APIs, background jobs, or a CLI service would need an actual future requirement before being added.

## Ask Delivery Questions First

1. Beyond the selected local browser workflow, is phone, tablet, or local-network access needed initially?
2. Must the same data and running timer be available across devices, or is one-device storage sufficient initially?
3. Must practice work without an internet connection? If so, does that include editing material, recording time, and later synchronizing?
4. Which local access restrictions are appropriate? Sign-in and separate user data for any future public version must be resolved before deployment; shared use is not current scope.
5. What storage durability, backup, portability, hosting cost, and maintenance constraints matter?
6. Where will PostgreSQL run, and what installation and backup approach meets the user's durability needs?

Ask only questions whose prerequisites are settled and do not reopen confirmed choices without a reason. Choose database tooling around the approved PostgreSQL engine; a cloud provider or hosted database is not needed to begin local use.

## Evaluate Candidates

| Concern                   | Evidence Required Before Selection                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Frontend                  | Accessible hierarchy, tables, dialogs, and menus; ability to reproduce the agreed neutral visual style |
| Runtime and delivery      | Supported devices, installation expectations, offline requirements, and deployment model               |
| State                     | Deterministic transitions and reliable recovery across the agreed interruption and device scenarios    |
| Storage                   | Recursive material, Sprint references, stable history, durable timing records, and safe corrections    |
| Time handling             | Calendar dates in a fixed Sprint timezone, actual elapsed duration, daylight-saving boundaries         |
| Server and authentication | Justified by sharing, synchronization, durability, or access-control needs rather than habit           |
| Testing                   | Focused domain tests, persistence integration checks, and real browser workflow validation             |
| Operations                | Cost, backup and restore, migrations, observability, and maintenance suited to expected use            |

The traditional locally served browser application and its implementation toolchain are selected; an installed desktop application and a browser-to-database Supabase design are not current candidates. Public hosting and cross-device synchronization remain deferred decisions.

## Approval Output

For remaining infrastructure choices, present a recommendation and credible alternatives with trade-offs, including what each does not support. Preserve the approved framework, architecture, and toolchain rather than reopening them without a reason. Separate confirmed requirements from assumptions and ground choices in the user's durability and access needs.

Record costly-to-reverse architecture or storage decisions in an ADR and update the relevant approved feature PRD when one exists. Keep setup and validation commands grounded in the actual workspace scripts.
