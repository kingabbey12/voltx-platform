# Setup

## Prerequisites

- Docker Desktop 4+ with Compose v2

## Canonical local workflow

From the repository root, run:

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, runs all Prisma migrations, seeds permissions/roles and billing plans, then starts the API at `http://localhost:3002` and the web app at `http://localhost:3001`.

Wait for `api` and `web` to become healthy, then open `http://localhost:3001`.

To reset local data deliberately:

```bash
docker compose down -v
```
