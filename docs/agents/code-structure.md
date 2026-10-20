# Code Structure

This guide describes the structure that exists in Practice Planner today. It is
not a requirement to copy another project's folders. Add a new module or
workspace package when an approved feature or a real implementation need calls
for it.

## Workspace At A Glance

```text
apps/
  local/                 React Router application and its server
    app/
      root.tsx            HTML document, shared sidebar shell, and route outlet
      components/
        app-sidebar.tsx   Desktop navigation and mobile navigation drawer
      routes.ts           Explicit route configuration
      routes/
        home.tsx          Current Library page, loader, action, and UI
        sprints.tsx       Sprint lifecycle and Material selection page, loader, action, and UI
      app.css             Global application styles
packages/
  core/                   Domain operations and PostgreSQL persistence
    src/
      index.ts            Package root entry point (currently exports nothing)
      db.server.ts        Server-side database connection
      schema.ts           Drizzle tables and inferred row types
      material-operations.ts
                          Material rules and database operations
      material-operations.test.ts
      sprint-operations.ts
                          Sprint calendar rules and database operations
      sprint-operations.test.ts
      sprint-material-operations.ts
                          Sprint membership rules and persistence
      sprint-material-selection.ts
                          Shared selected-only tree projection
    drizzle/              Database migrations
docker/                   Local infrastructure configuration
docs/                     Product, architecture, workflow, and engineering docs
```

The pnpm workspace currently contains `apps/local` and `packages/core`. There is
one React Router application, not a separate browser app and API server: the
React Router server renders pages and runs route loaders and actions. PostgreSQL
access stays on that server side.

## Follow A Request

The current Library route demonstrates the intended full-stack direction:

1. React Router matches the URL using `app/routes.ts` and loads
   `app/routes/home.tsx`.
2. On a page read, the route's `loader` calls `getDatabase()` and
   `listLibraryMaterialTree(...)` from `@practice-planner/core`.
3. On a form submission, the route's `action` parses the intent and calls a
   Material operation such as `createStandaloneMaterial(...)` or
   `renameMaterial(...)`.
4. Core operations enforce domain rules and read or write PostgreSQL through
   Drizzle. The route returns data for React Router to provide to the UI.

The route imports `@practice-planner/core/material-operations` and
`@practice-planner/core/db.server`. `packages/core/package.json` maps these
subpaths to built files from `src/`. Its `index.ts` is currently empty, so the
package-root import is not the interface used by the app today.

## What Belongs Where

### `apps/local`

The React Router app owns page rendering and HTTP handling. Route modules can
contain a page component together with its `loader`, `action`, and related
route-specific behavior. Keep behavior close to its only caller while the
surface is small; extract it when reuse or complexity makes that a clearer
interface.

`root.tsx` defines the HTML document and shared navigation shell, and renders
the matched route through `<Outlet />`. `routes.ts` explicitly registers the
Library and Sprints routes. `components/app-sidebar.tsx` provides shared
desktop navigation and a mobile drawer. Folders such as `features/`, `hooks/`,
`lib/`, and `services/` do not exist yet.

These are possible organizational choices, not required React Router
conventions. If the app grows, use them to clarify ownership:

- `components/`: visual UI reused across routes or features, such as a shared
  dialog or input. A component can be stateful; this folder means shared UI,
  not necessarily "dumb components." UI used by only one capability can stay
  with that feature.
- `features/`: a cohesive user-facing capability and its app-side pieces. A
  feature might own its components, React hooks, presentation state, and
  feature-specific helpers. Routes would compose those pieces and connect them
  to loaders/actions. Domain rules that must be authoritative belong in
  `packages/core`, not only in browser UI.
- `hooks/`: React hooks reused across otherwise separate features, such as a
  shared focus or URL-state behavior. A hook used only by one feature should
  usually live with that feature rather than becoming a global utility.
- `lib/`: small supporting helpers that do not own a whole user capability or
  domain workflow, such as formatting or URL parsing. Keep browser-safe code
  separate from code that needs Node.js APIs; a `lib/` name does not itself
  make code safe for either runtime.
- `services/`: do not add this as a default layer. Domain operations and
  persistence already belong to `packages/core`, and route loaders/actions
  already provide the server entry points. Add an app-local server module only
  when a concrete application workflow or integration needs a distinct home;
  avoid a pass-through service that merely calls core.
- `test-utils/`: shared fixtures or helpers only when multiple tests need
  them. Keep focused tests beside the module they exercise where practical.

These names describe ownership, not component behavior or runtime. A feature
can contain presentational and stateful UI; a shared component can also manage
state. Start with the current route when a behavior has one caller, then extract
it when reuse or complexity creates a useful, testable interface. Do not create
folders just to match another repository's tree.

### `packages/core`

This workspace package owns server-side domain operations and persistence. The
current Material operations accept a database connection, enforce Material
rules, and use Drizzle; `db.server.ts` constructs the PostgreSQL connection, and
`schema.ts` defines its tables.

This is a separate package even though the local app is currently its only
consumer. That gives the domain and database code a distinct project/build
unit, dependency set, and server-side role. It does not imply that the package
must be published or have multiple consumers.

The package's `exports` map currently exposes built top-level `src` modules as
subpaths. It is not yet using a narrow, curated set of entry points over private
implementation folders. Keep imports aligned with the package's actual exports;
do not assume every package in this workspace has the stricter entry-point
pattern used by other repositories.

## Practical Change Map

- Change URL matching or page output: start in `apps/local/app/routes/` and
  `routes.ts`.
- Change the document shell or global styles: start in `root.tsx` or `app.css`.
- Change Material validation, hierarchy operations, or persistence: start in
  `packages/core/src/material-operations.ts` and its tests.
- Change Sprint calendar rules or persistence: start in
  `packages/core/src/sprint-operations.ts` and its tests; the page is
  `apps/local/app/routes/sprints.tsx`.
- Change Sprint Material membership or its deletion-protection boundary: start
  in `packages/core/src/sprint-material-operations.ts` and its tests; the
  selection workflow is in `apps/local/app/routes/sprints.tsx`, and both saved
  and draft selected-only trees use `sprint-material-selection.ts`.
- Change tables or migrations: start in `packages/core/src/schema.ts` or
  `packages/core/drizzle/`; follow the repository's database workflow.
- Change approved product behavior: consult the feature PRD before implementing
  it. Material management and Sprint creation/browsing are the implemented
  product slices; other planned workflows remain unimplemented.

The [stack-planning guide](../STACK_PLANNING.md) and
[accepted full-stack architecture](../adr/0004-react-router-fullstack-postgresql.md)
own the selected technical direction. The [documentation map](../README.md)
links the current product and engineering sources.

Approved feature PRDs remain the source of product behavior.
