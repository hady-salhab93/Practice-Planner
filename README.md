# Practice Planner

## Overview

Practice Planner is a planned application for managing personal guitar practice. It turns a large collection of songs, books, and exercises into a manageable sprint focus and records where practice time went.

Status: product planning has been reset for feature-by-feature discovery. The architecture remains approved and the initial application structure is in place. The app uses React Router framework mode with server-side PostgreSQL access for personal local use. Supabase is excluded. See [stack planning](docs/STACK_PLANNING.md) for selected tooling and unresolved infrastructure choices.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Features

The first Material management slice is implemented: standalone Material can be added to the Library and renamed. See the [approved feature PRD](docs/features/material-management.md) and [implementation slices](docs/issues/material-management/README.md) for scope and remaining work.

## Getting Started

Read the [glossary](GLOSSARY.md) for provisional terminology and the [planning workflow](docs/agents/planning.md) for feature discovery. The previous application-wide specification and draft issues have been removed.

The [documentation map](docs/README.md) indexes agent workflows and frontend and testing standards. The [stack-planning guide](docs/STACK_PLANNING.md) defines the next technology discussion.

Requirements: Node.js 20.19 or later and pnpm 9.12.3.

```powershell
pnpm install
Copy-Item .env.example .env
pnpm db:up
pnpm db:migrate
pnpm dev
```

The local app runs at the URL printed by React Router. PostgreSQL runs in Docker Compose, listens on localhost only, and stores data in a persistent named volume. Database backups are not configured.

## Usage

The Library supports adding and renaming standalone Material. Other product workflows remain future work.

## Architecture

The selected architecture is a pnpm/Turbo workspace with a React Router full-stack app in `apps/local` and server-side domain/database code in `packages/core`. React Router loaders and actions call domain operations; PostgreSQL credentials remain server-side. Database placement remains open.

Accepted decisions guide implementation:

- [React Router full-stack application with PostgreSQL](docs/adr/0004-react-router-fullstack-postgresql.md).

The [earlier storage decision](docs/adr/0003-local-postgresql-first.md) is preserved as superseded history, not current stack guidance.

The [frontend standards](docs/FRONTEND_STANDARDS.md) define the application's visual direction. Tailwind CSS and Lucide are selected; component primitives remain open.

## Configuration

PostgreSQL is selected for server-side persistence, using Drizzle ORM and the `pg` driver. The local database runs in Docker Compose on localhost with a persistent named volume. Backups remain deferred. Supabase is not part of the selected architecture.

## Development

[Copilot guidance](.github/copilot-instructions.md) routes agents to authoritative documents and the [planning workflow](docs/agents/planning.md). Run `pnpm check` for the current static and test checks, `pnpm build` for a production build, and `pnpm format` to format files.

Use `pnpm db:up` to start the local database and `pnpm db:migrate` to apply schema migrations. Set `TEST_DATABASE_URL` in `.env` for PostgreSQL-backed integration tests.

## Troubleshooting

For terminology, consult the provisional glossary. For behavior, consult the approved feature PRD when one exists; otherwise clarify requirements with the user. For technical decision rationale, consult the retained architecture records.
