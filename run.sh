#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-::}"
PORT="${PORT:-5080}"
WORKERS="${WORKERS:-2}"

if [[ -n "${BIND:-}" ]]; then
  BIND_ADDR="${BIND}"
elif [[ "${HOST}" == *:* ]]; then
  BIND_ADDR="[${HOST}]:${PORT}"
else
  BIND_ADDR="${HOST}:${PORT}"
fi

if [[ ! -x "${ROOT_DIR}/.venv/bin/gunicorn" ]]; then
  echo "Missing ${ROOT_DIR}/.venv/bin/gunicorn"
  echo "Create the virtualenv and install requirements first."
  exit 1
fi

cd "${ROOT_DIR}"
exec "${ROOT_DIR}/.venv/bin/gunicorn" \
  --bind "${BIND_ADDR}" \
  --workers "${WORKERS}" \
  --timeout 120 \
  app:app
