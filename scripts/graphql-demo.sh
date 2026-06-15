#!/usr/bin/env sh
set -eu

GRAPHQL_URL="${GRAPHQL_URL:-http://localhost:8082/graphql}"

curl -i "$GRAPHQL_URL" \
  -H "content-type: application/json" \
  -d '{"query":"query { items { name stock } }"}'

curl -i "$GRAPHQL_URL" \
  -H "content-type: application/json" \
  -d '{"query":"mutation { purchase(item: \"monitor\", quantity: 1, clientId: \"cli-graphql\") { success item remaining message } }"}'

curl -i "$GRAPHQL_URL" \
  -H "content-type: application/json" \
  -d '{"query":"mutation { cancel(item: \"monitor\", quantity: 1, clientId: \"cli-graphql\") { success item remaining message } }"}'
