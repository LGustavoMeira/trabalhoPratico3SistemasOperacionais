#!/usr/bin/env sh
set -eu

REST_URL="${REST_URL:-http://localhost:8080}"
TARGET="$REST_URL/items"

if command -v hey >/dev/null 2>&1; then
  hey -n 1000 -c 50 "$TARGET"
elif command -v wrk >/dev/null 2>&1; then
  wrk -t2 -c50 -d15s "$TARGET"
else
  echo "Instale hey ou wrk para executar o teste de carga sugerido pelo PDF."
  echo "Alvo: $TARGET"
  exit 1
fi
