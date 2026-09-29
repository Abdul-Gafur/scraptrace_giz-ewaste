#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

project_name="scraptrace_phase1_e2e_$$"
postgres_port="${SCRAPTRACE_E2E_POSTGRES_PORT:-55434}"
api_port="${SCRAPTRACE_E2E_API_PORT:-8001}"
web_port="${SCRAPTRACE_E2E_WEB_PORT:-3101}"
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/scraptrace-e2e.XXXXXX")"
api_pid=""
web_pid=""
postgres_password=""

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if [[ -n "$web_pid" ]]; then kill "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; fi
  wait "$web_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
  if [[ -n "$postgres_password" ]]; then
    SCRAPTRACE_LOCAL_POSTGRES_PASSWORD="$postgres_password" \
      SCRAPTRACE_LOCAL_POSTGRES_PORT="$postgres_port" \
      docker compose -p "$project_name" -f apps/api/compose.yaml down --volumes --remove-orphans \
        >/dev/null 2>&1 || true
  fi
  rm -rf "$runtime_dir"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

for command in docker curl npm; do
  command -v "$command" >/dev/null || { echo "Required command is unavailable: $command" >&2; exit 2; }
done
[[ -x .venv/bin/python ]] || { echo "Create the repository .venv before running real E2E." >&2; exit 2; }
[[ -f services/vision/checkpoints/best_model.pth ]] || { echo "The released vision checkpoint is unavailable." >&2; exit 2; }

postgres_password="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(32))')"
auth_secret="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
qr_secret="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
demo_password="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(18))')"

export SCRAPTRACE_ENVIRONMENT=test
export SCRAPTRACE_DATABASE_URL="postgresql+asyncpg://scraptrace:${postgres_password}@127.0.0.1:${postgres_port}/scraptrace"
export SCRAPTRACE_AUTH_TOKEN_SECRET="$auth_secret"
export SCRAPTRACE_QR_TOKEN_SECRET="$qr_secret"
export SCRAPTRACE_SEED_DEMO_PASSWORD="$demo_password"
export SCRAPTRACE_ENABLE_DEMO_ACCOUNT_DISCOVERY=true
export SCRAPTRACE_ALLOWED_ORIGINS="http://127.0.0.1:${web_port}"
export SCRAPTRACE_EVIDENCE_STORAGE_ROOT="$runtime_dir/evidence"
export SCRAPTRACE_RUNTIME_DEVICE=cpu
export SCRAPTRACE_LOG_LEVEL=WARNING
export SCRAPTRACE_AUTH_COOKIE_SECURE=false
export NEXT_PUBLIC_API_MODE=http
export NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:${api_port}"
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:${web_port}"
export SCRAPTRACE_E2E_DEMO_PASSWORD="$demo_password"

SCRAPTRACE_LOCAL_POSTGRES_PASSWORD="$postgres_password" SCRAPTRACE_LOCAL_POSTGRES_PORT="$postgres_port" \
  docker compose -p "$project_name" -f apps/api/compose.yaml up -d --wait postgres >/dev/null

if [[ "${SCRAPTRACE_E2E_RUN_API_SUITE:-false}" == "true" ]]; then
  env -u SCRAPTRACE_AUTH_COOKIE_SECURE -u SCRAPTRACE_ENABLE_DEMO_ACCOUNT_DISCOVERY \
    SCRAPTRACE_TEST_DATABASE_URL="$SCRAPTRACE_DATABASE_URL" npm run api:test
fi
PYTHONPATH=. .venv/bin/alembic -c apps/api/alembic.ini upgrade head
if [[ "${SCRAPTRACE_E2E_RUN_API_SUITE:-false}" == "true" ]]; then
  PYTHONPATH=. .venv/bin/alembic -c apps/api/alembic.ini downgrade -1
  PYTHONPATH=. .venv/bin/alembic -c apps/api/alembic.ini upgrade head
  npm run api:db:check
fi
PYTHONPATH=. .venv/bin/python -m apps.api.app.cli seed --e2e-fixtures

PYTHONPATH=. .venv/bin/python -m uvicorn apps.api.app.main:app \
  --host 127.0.0.1 --port "$api_port" >"$runtime_dir/api.log" 2>&1 &
api_pid=$!
for _ in {1..120}; do
  if curl --fail --silent "http://127.0.0.1:${api_port}/health/ready" >/dev/null; then break; fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "FastAPI stopped before readiness; log follows." >&2
    sed -n '1,160p' "$runtime_dir/api.log" >&2
    exit 1
  fi
  sleep 1
done
curl --fail --silent "http://127.0.0.1:${api_port}/health/ready" >/dev/null || {
  echo "FastAPI did not become ready; log follows." >&2
  sed -n '1,160p' "$runtime_dir/api.log" >&2
  exit 1
}

npm run dev --workspace @scraptrace/web -- --webpack --hostname 127.0.0.1 --port "$web_port" \
  >"$runtime_dir/web.log" 2>&1 &
web_pid=$!
for _ in {1..120}; do
  if curl --fail --silent "http://127.0.0.1:${web_port}/en/sign-in" >/dev/null; then break; fi
  if ! kill -0 "$web_pid" 2>/dev/null; then
    echo "Next.js stopped before readiness; log follows." >&2
    sed -n '1,160p' "$runtime_dir/web.log" >&2
    exit 1
  fi
  sleep 1
done
curl --fail --silent "http://127.0.0.1:${web_port}/en/sign-in" >/dev/null || {
  echo "Next.js did not become ready; log follows." >&2
  sed -n '1,160p' "$runtime_dir/web.log" >&2
  exit 1
}

npm run test:e2e:http --workspace @scraptrace/web -- "$@"
