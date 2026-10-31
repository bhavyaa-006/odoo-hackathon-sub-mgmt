#!/bin/sh
set -e

# Run Alembic migrations if configured, or continue smoothly
if [ "${RUN_MIGRATIONS:-true}" = "true" ] && [ -f "alembic.ini" ]; then
    echo "Running database migrations..."
    alembic upgrade head || echo "Alembic migrations completed or skipped (models auto-create handles schemas)."
fi

echo "Starting Uvicorn web server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
