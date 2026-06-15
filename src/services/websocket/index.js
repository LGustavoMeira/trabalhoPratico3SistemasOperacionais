import express from "express";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { DOMAIN_URL, getPort } from "../../lib/config.js";
import { domainFetch } from "../../lib/http.js";
import { log, logError } from "../../lib/logger.js";

const SERVICE = "websocket";
const PORT = getPort("PORT", 8081);
const RECONNECT_DELAY_MS = 1000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function broadcast(payload) {
  const encoded = JSON.stringify(payload);
  let delivered = 0;

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
      delivered += 1;
    }
  }

  log(SERVICE, "broadcast", {
    event: payload.event,
    item: payload.item,
    origin: payload.origin,
    clients: delivered
  });
}

function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/);
  const data = [];
  let event = "message";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trim());
    }
  }

  if (data.length === 0) {
    return null;
  }

  const text = data.join("\n");
  try {
    return {
      event,
      ...JSON.parse(text)
    };
  } catch {
    return { event, data: text };
  }
}

async function subscribeToDomainEvents() {
  for (;;) {
    try {
      log(SERVICE, `connecting to domain events at ${DOMAIN_URL}/events`);
      const response = await fetch(`${DOMAIN_URL}/events`);
      if (!response.ok || response.body === null) {
        throw new Error(`Domain event stream returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          throw new Error("Domain event stream closed");
        }

        buffer += decoder.decode(value, { stream: true });
        let separator = buffer.indexOf("\n\n");

        while (separator >= 0) {
          const frame = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          separator = buffer.indexOf("\n\n");

          const event = parseSseFrame(frame);
          if (event && event.event !== "ready") {
            log(SERVICE, "domain event received", {
              event: event.event,
              item: event.item,
              origin: event.origin
            });
            broadcast(event);
          }
        }
      }
    } catch (error) {
      logError(SERVICE, "domain event subscription lost", error);
      await sleep(RECONNECT_DELAY_MS);
    }
  }
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: SERVICE,
    websocketPath: "/ws",
    connectedClients: wss.clients.size
  });
});

app.get("/", (_req, res) => {
  res.json({
    service: SERVICE,
    websocket: "ws://localhost:8081/ws"
  });
});

wss.on("connection", (socket) => {
  socket.send(
    JSON.stringify({
      event: "connected",
      service: SERVICE,
      message: "Conectado ao canal de eventos de estoque"
    })
  );

  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "ping") {
        socket.send(JSON.stringify({ event: "pong", timestamp: new Date().toISOString() }));
        return;
      }

      if (message.type === "list_items") {
        socket.send(
          JSON.stringify({
            event: "items_snapshot",
            ...(await domainFetch("/items", { baseUrl: DOMAIN_URL }))
          })
        );
      }
    } catch (error) {
      socket.send(
        JSON.stringify({
          event: "error",
          message: "Mensagem WebSocket invalida"
        })
      );
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  log(SERVICE, `listening on ${PORT}; domain=${DOMAIN_URL}`);
  subscribeToDomainEvents();
});
