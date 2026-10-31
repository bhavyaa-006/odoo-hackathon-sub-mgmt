#!/bin/sh
set -eu

# The service owns the initial catalogue migration. Migrations run before the
# web process so a new compose environment is ready to accept requests.
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
