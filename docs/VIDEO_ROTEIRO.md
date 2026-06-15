# Roteiro sugerido para video de 6 a 10 minutos

1. Apresentar a Arquitetura B: cinco containers, um dominio central e quatro interfaces.
2. Mostrar `docker compose up --build`.
3. Chamar REST com `./scripts/rest-demo.sh`.
4. Chamar GraphQL com `./scripts/graphql-demo.sh`.
5. Chamar gRPC com `docker compose exec grpc node scripts/grpc-client.js`.
6. Abrir WebSocket com `docker compose exec websocket node scripts/ws-client.js` e disparar uma compra por REST ou gRPC.
7. Mostrar que a alteracao feita por uma interface aparece nas demais.
8. Rodar `docker compose exec rest node scripts/concurrency-test.js` e explicar por que uma compra falha.
9. Explicar rapidamente socket vs WebSocket, JSON vs Protocol Buffers e REST vs GraphQL vs gRPC.
10. Mostrar nome da imagem Docker Hub publicada.
