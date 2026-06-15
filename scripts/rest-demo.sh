#!/usr/bin/env sh
set -eu

REST_URL="${REST_URL:-http://localhost:8080}"

curl -i "$REST_URL/health"
curl -i "$REST_URL/items"
curl -i "$REST_URL/items/monitor"
curl -i -X POST "$REST_URL/purchase" \
  -H "content-type: application/json" \
  -d '{"item":"monitor","quantity":1,"clientId":"cli-rest"}'
curl -i -X POST "$REST_URL/cancel" \
  -H "content-type: application/json" \
  -d '{"item":"monitor","quantity":1,"clientId":"cli-rest"}'
