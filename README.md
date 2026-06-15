# BCC264 TP3 - IPC em visao ampliada

Implementacao da Arquitetura B do TP3: REST/JSON, GraphQL, gRPC e WebSocket em servicos separados, todos compartilhando a mesma fonte de verdade por meio de um servico central de dominio.

## Arquitetura

```text
                +----------------+
REST :8080 ---> |                |
GraphQL :8082 ->| domain :7000   |---- SSE events ----> WebSocket :8081/ws
gRPC :50051 --->| estoque unico  |
                +----------------+
```

- `domain`: mantem o estado compartilhado do estoque em memoria e serializa mutacoes com uma fila local.
- `rest`: expoe `GET /items`, `GET /items/:item`, `POST /purchase`, `POST /cancel` e `GET /health`.
- `graphql`: expoe queries e mutations em `POST /graphql`.
- `grpc`: expoe o contrato `proto/inventory.proto`.
- `websocket`: expoe `ws://localhost:8081/ws` e repassa eventos de estoque emitidos pelo dominio.

Estado inicial:

| Item | Quantidade |
| --- | ---: |
| cadeira | 5 |
| mesa | 3 |
| monitor | 2 |

## Execucao com Docker

Subir tudo:

```sh
docker compose up --build
```

Portas publicas:

- REST: `http://localhost:8080`
- GraphQL: `http://localhost:8082/graphql`
- gRPC: `localhost:50051`
- WebSocket: `ws://localhost:8081/ws`

Imagem Docker Hub:

```sh
export DOCKERHUB_IMAGE="luisgustavomeiracamargos/bcc264-tp3:latest"
docker compose build
docker push "$DOCKERHUB_IMAGE"
docker compose up
```

Antes da submissao, ajuste `luisgustavomeiracamargos/bcc264-tp3:latest` se sua conta real do Docker Hub for diferente e registre o mesmo nome no relatorio.

## Exemplos REST

```sh
curl -i http://localhost:8080/health
curl -i http://localhost:8080/items
curl -i http://localhost:8080/items/monitor
curl -i -X POST http://localhost:8080/purchase \
  -H "content-type: application/json" \
  -d '{"item":"monitor","quantity":1,"clientId":"cli-rest"}'
curl -i -X POST http://localhost:8080/cancel \
  -H "content-type: application/json" \
  -d '{"item":"monitor","quantity":1,"clientId":"cli-rest"}'
```

Ou:

```sh
./scripts/rest-demo.sh
```

## Exemplos GraphQL

```sh
curl -i http://localhost:8082/graphql \
  -H "content-type: application/json" \
  -d '{"query":"query { items { name stock } }"}'

curl -i http://localhost:8082/graphql \
  -H "content-type: application/json" \
  -d '{"query":"mutation { purchase(item: \"monitor\", quantity: 1, clientId: \"cli-graphql\") { success item remaining message } }"}'
```

Contrato GraphQL: `schema/inventory.graphql`.

## Exemplos gRPC

Contrato: `proto/inventory.proto`.

```sh
docker compose exec grpc node scripts/grpc-client.js
```

Se usar `grpcurl`:

```sh
grpcurl -plaintext -import-path proto -proto inventory.proto localhost:50051 inventory.InventoryService/ListItems
grpcurl -plaintext -import-path proto -proto inventory.proto \
  -d '{"item":"monitor","quantity":1,"clientId":"cli-grpc"}' \
  localhost:50051 inventory.InventoryService/Purchase
```

## Exemplo WebSocket

Em um terminal:

```sh
docker compose exec websocket node scripts/ws-client.js
```

Em outro terminal, dispare uma compra por qualquer interface:

```sh
curl -i -X POST http://localhost:8080/purchase \
  -H "content-type: application/json" \
  -d '{"item":"monitor","quantity":1,"clientId":"cli-ws-demo"}'
```

O cliente WebSocket deve receber eventos como `purchase`, `stock_update`, `low_stock` ou `out_of_stock`.

## Demonstracao de consistencia entre interfaces

1. Abra o WebSocket: `docker compose exec websocket node scripts/ws-client.js`.
2. Consulte REST: `curl -s http://localhost:8080/items`.
3. Execute uma compra por gRPC: `docker compose exec grpc node scripts/grpc-client.js`.
4. Consulte REST ou GraphQL novamente.
5. Observe no WebSocket o evento com `origin: "grpc"`.

Isso demonstra que as quatro interfaces nao possuem estoques independentes. Todas passam pelo `domain`.

## Concorrencia

O teste abaixo deixa `monitor` com uma unidade e dispara duas compras concorrentes:

```sh
docker compose exec rest node scripts/concurrency-test.js
```

Resultado esperado: uma compra bem-sucedida e outra rejeitada por estoque insuficiente. A fila local do `domain` serializa as mutacoes e evita que o estoque fique negativo em uma unica instancia.

## Teste de carga

Com `hey` ou `wrk` instalado no host:

```sh
./scripts/load-test.sh
```

O relatorio deve correlacionar a vazao observada com o modelo de concorrencia do Node.js: event loop assincrono para I/O de rede e execucao de callbacks em uma thread principal, reduzindo a necessidade de uma thread por conexao.

## Entregaveis presentes

- Codigo-fonte em `src/`.
- Contrato GraphQL em `schema/inventory.graphql`.
- Contrato gRPC em `proto/inventory.proto`.
- `Dockerfile`.
- `docker-compose.yml`.
- Scripts de teste em `scripts/`.
- Colecao Postman em `postman/bcc264-tp3.postman_collection.json`.
- Relatorio curto em `docs/RELATORIO.md`.
