---
status: accepted
supersedes: 0003-local-postgresql-first
---

# Use React Router Framework Mode With Server-Side PostgreSQL Access

On 2026-10-10, the user selected a traditional full-stack React Router application with PostgreSQL and no Supabase. The application initially runs locally for personal practice; this supersedes ADR 0003's suggested Supabase path without changing the approved PostgreSQL engine or first-release audience.

React renders the UI, server-side loaders supply data, and server-side actions handle mutations. These handlers call domain operations that access PostgreSQL on the server. Database credentials stay server-side; the browser does not directly access the database. The UI and its server handlers belong to one application, not a separately deployed UI API service.

## Why

The user prefers the flexibility of a traditional application server. Timer switching, hierarchy validation, Sprint eligibility, and historical preservation can be expressed in domain services, supported by database constraints and transactions, rather than making browser-to-Supabase access, RLS policies, and database RPC functions the application architecture.

## Boundaries

- Supabase hosting, Auth, Data API, and client SDK are not part of the selected architecture.
- Running an application server is an accepted trade-off. A frontend development server alone is not the full application runtime.
- Database location, installation, backup, and local access restrictions remain open. The stack-planning guide records selected tooling; package manifests and the lockfile own versions. Rejecting Supabase does not by itself choose a database host or require PostgreSQL to run on the same machine.
- Add services, packages, and deployment machinery only when an approved Practice Planner requirement justifies them.
- Future public deployment and user isolation remain out of first-release scope. Choosing the architecture does not authorize scaffolding, provisioning, or implementation.

See [stack planning](../STACK_PLANNING.md) for remaining choices and [frontend standards](../FRONTEND_STANDARDS.md) for the reference look. Product planning has been reset; domain examples in this architecture record are rationale, not approved feature requirements.
