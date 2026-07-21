# Local development

`docker compose up --build` is the supported full-platform workflow. It requires no local database, Redis, migration, or seed command.

Useful commands:

```bash
docker compose ps
docker compose logs -f api web
docker compose down
docker compose --profile test run --rm e2e
```

Use `docker compose down -v` only when you intend to discard the local PostgreSQL and Redis volumes.
