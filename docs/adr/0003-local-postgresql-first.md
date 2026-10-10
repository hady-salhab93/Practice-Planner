---
status: superseded by ADR-0004
---

# Start With Local Personal Use And PostgreSQL

Historical decision from 2026-10-09. [ADR 0004](0004-react-router-fullstack-postgresql.md) supersedes it: PostgreSQL and initial personal use remain, but React Router framework mode is selected and Supabase is excluded. The discussion below is preserved as decision history, not current stack guidance.

The first release serves the author's own guitar practice locally; making the application available to other users is a future possibility, not current scope. Use PostgreSQL as the database now rather than browser-only storage or a different database engine, preserving a potential path to Supabase-hosted PostgreSQL later.

Keep core persistence based on PostgreSQL capabilities and versioned migrations rather than requiring Supabase-specific services in the local version. This favors relational integrity and future database portability but requires a running local database and an application-side database access boundary; it is not the same as a standalone static page or browser-local offline storage.

A future move to Supabase is not an approved deployment plan or a guarantee of a drop-in public application. Hosting, authentication, authorization, per-user data isolation, backup, and any synchronization behavior must be decided and verified before access is opened to other users. Frontend framework, server runtime, database tooling, and local PostgreSQL installation method remain undecided.

See [stack planning](../STACK_PLANNING.md) for confirmed and unresolved technical choices. Product requirements are being rediscovered feature by feature.
