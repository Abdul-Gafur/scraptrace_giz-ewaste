#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

for name in SCRAPTRACE_LOCAL_POSTGRES_PASSWORD SCRAPTRACE_AUTH_TOKEN_SECRET SCRAPTRACE_QR_TOKEN_SECRET SCRAPTRACE_SEED_DEMO_PASSWORD; do
  [[ -n "${!name:-}" ]] || { echo "Set $name before running the application." >&2; exit 2; }
done
[[ -x .venv/bin/python ]] || { echo "Create the repository .venv first." >&2; exit 2; }

export SCRAPTRACE_ENVIRONMENT=development
postgres_port="${SCRAPTRACE_LOCAL_POSTGRES_PORT:-55432}"
export SCRAPTRACE_DATABASE_URL="${SCRAPTRACE_DATABASE_URL:-postgresql+asyncpg://scraptrace:${SCRAPTRACE_LOCAL_POSTGRES_PASSWORD}@127.0.0.1:${postgres_port}/scraptrace}"
export SCRAPTRACE_ALLOWED_ORIGINS="http://127.0.0.1:3000"
export SCRAPTRACE_ENABLE_DEMO_ACCOUNT_DISCOVERY=true
export SCRAPTRACE_AUTH_COOKIE_SECURE=false
export NEXT_PUBLIC_API_MODE=http
export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000

docker compose -f apps/api/compose.yaml up -d --wait postgres
PYTHONPATH=. .venv/bin/alembic -c apps/api/alembic.ini upgrade head
PYTHONPATH=. .venv/bin/python -m apps.api.app.cli seed

PYTHONPATH=. .venv/bin/python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8000 &
api_pid=$!
cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run dev --workspace @scraptrace/web -- --webpack --hostname 127.0.0.1 --port 3000
