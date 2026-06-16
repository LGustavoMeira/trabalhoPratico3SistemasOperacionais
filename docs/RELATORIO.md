# Relatorio curto - BCC264 TP3

## 1. Objetivo e arquitetura escolhida

O objetivo do trabalho e demonstrar que a comunicacao entre processos continua sendo o problema central, mas agora usando protocolos e contratos de aplicacao em vez de socket TCP bruto. A implementacao usa a Arquitetura B: existem servicos separados para REST, GraphQL, gRPC e WebSocket, todos ligados a um servico central chamado `domain`.

O `domain` e a fonte de verdade do estoque. Ele guarda os itens `cadeira`, `mesa` e `monitor`, valida compras e cancelamentos, serializa mutacoes com uma fila local e emite eventos. As interfaces externas nao mantem copias proprias do estoque.

## 2. Interfaces implementadas

REST/JSON expoe `GET /items`, `GET /items/:item`, `POST /purchase`, `POST /cancel` e `GET /health`. As mensagens usam JSON e seguem o modelo orientado a recursos e endpoints HTTP.

GraphQL expoe uma query `items`, uma query `item(name)`, uma mutation `purchase` e uma mutation `cancel`. O cliente escolhe os campos retornados, o que evidencia o modelo de consulta flexivel.

gRPC expoe o servico `InventoryService` definido em `proto/inventory.proto`, com `ListItems`, `GetItem`, `Purchase` e `Cancel`. A interface e contratual, tipada e serializada com Protocol Buffers.

WebSocket expoe `ws://localhost:8081/ws` para notificacoes em tempo real. O canal recebe eventos emitidos pelo dominio, como `purchase`, `cancel`, `stock_update`, `low_stock` e `out_of_stock`.

## 3. Comparacao conceitual obrigatoria

Este TP amplia a nocao classica de IPC porque mostra processos cooperando via rede, IP, porta e protocolos de aplicacao. No TP2, o foco era socket TCP bruto, protocolo proprio e concorrencia no servidor. Aqui, o socket continua existindo por baixo, mas a aplicacao conversa por REST, GraphQL, gRPC e WebSocket.

Socket nao e WebSocket. Socket e a interface basica de comunicacao oferecida ao processo para usar rede. WebSocket e um protocolo de aplicacao que cria um canal persistente e full-duplex sobre uma conexao HTTP inicial.

HTTP, REST, GraphQL, gRPC e WebSocket ficam na camada de aplicacao da pilha conceitual. TCP fica abaixo, na camada de transporte. IP fica abaixo do transporte. JSON, Protocol Buffers, schemas e contratos descrevem a representacao e a semantica dos dados.

GraphQL e gRPC nao devem ser confundidos com transporte. GraphQL e um modelo de API com schema, queries e mutations, normalmente servido sobre HTTP. gRPC e um modelo RPC contratual que usa HTTP/2 e Protocol Buffers. O transporte continua sendo provido por camadas inferiores.

JSON e textual, legivel e flexivel, usado em REST e GraphQL nesta implementacao. Protocol Buffers e binario, tipado e mais compacto, usado no gRPC conforme o contrato `.proto`.

## 4. Estado compartilhado, consistencia e concorrencia

O estado compartilhado e o mapa de estoque mantido pelo servico `domain`. Todas as compras e cancelamentos passam por ele. A consistencia em uma unica instancia e protegida por uma fila local de mutacoes, que serializa operacoes de compra e devolucao.

O teste `docker compose exec rest node scripts/concurrency-test.js` prepara o item `monitor` com uma unidade e dispara duas compras concorrentes. O comportamento esperado e uma compra com sucesso e uma falha por estoque insuficiente. Isso mostra que o estoque nao fica negativo.

Em multiplas instancias ou hosts, um mutex local nao basta, porque cada processo teria sua propria memoria e sua propria fila. Para escalar horizontalmente mantendo consistencia, seria necessario mover a fonte de verdade para um banco transacional, usar operacoes atomicas externas ou algum mecanismo distribuido adequado. O TP nao exige lock distribuido, mas exige reconhecer esse limite.

## 5. Threads, assincronia, carga e containerizacao

O Node.js usa um modelo baseado em event loop para I/O de rede. Isso permite lidar com muitas conexoes sem criar uma thread por requisicao. Em teste de carga contra REST, a vazao deve ser analisada considerando esse modelo: enquanto as operacoes sao I/O-bound, o servidor tende a multiplexar conexoes com baixo custo de troca de contexto; se houvesse CPU pesada, a thread principal se tornaria gargalo.

No gRPC, o uso de HTTP/2 permite multiplexar chamadas concorrentes sobre uma conexao TCP, reduzindo overhead de conexoes e consumo de file descriptors quando comparado ao padrao REST/HTTP 1.1 tradicional.

O ambiente e empacotado com `Dockerfile` e `docker-compose.yml`. O Compose sobe cinco containers: `tp3-domain`, `tp3-rest`, `tp3-graphql`, `tp3-grpc` e `tp3-websocket`. A imagem da submissao foi publicada no Docker Hub como `gustavomeira1/tp3so:latest`.

Comandos minimos para reproducao pelo avaliador:

```sh
docker pull gustavomeira1/tp3so:latest
DOCKERHUB_IMAGE=gustavomeira1/tp3so:latest docker compose up
```

Para reconstruir e publicar uma nova versao da imagem:

```sh
docker login
docker build -t gustavomeira1/tp3so:latest .
docker push gustavomeira1/tp3so:latest
```

Imagem Docker Hub da submissao: `gustavomeira1/tp3so:latest`.
