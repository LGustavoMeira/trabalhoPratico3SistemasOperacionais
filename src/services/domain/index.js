import express from "express";
import { getPort } from "../../lib/config.js";
import { log } from "../../lib/logger.js";

const SERVICE = "domain";
const PORT = getPort("PORT", 7000);
const LOW_STOCK_THRESHOLD = getPort("LOW_STOCK_THRESHOLD", 1);

const initialItems = new Map([
  ["cadeira", 5],
  ["mesa", 3],
  ["monitor", 2]
]);

const items = new Map(initialItems);
const eventClients = new Set();
let eventSequence = 0;
let mutationQueue = Promise.resolve();

const app = express();
app.use(express.json());

function normalizeItemName(item) {
  return String(item ?? "").trim().toLowerCase();
}

function parseQuantity(quantity) {
  const value = Number(quantity);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function itemSnapshot(name) {
  return {
    name,
    stock: items.get(name)
  };
}

function allItemsSnapshot() {
  return [...items.keys()].sort().map(itemSnapshot);
}

function withMutationLock(operation) {
  const run = mutationQueue.then(operation, operation);
  mutationQueue = run.catch(() => undefined);
  return run;
}

function publish(event) {
  const payload = {
    id: ++eventSequence,
    timestamp: new Date().toISOString(),
    ...event
  };
  const encoded = `id: ${payload.id}\nevent: ${payload.event}\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of eventClients) {
    client.write(encoded);
  }

  log(SERVICE, "event", payload);
  return payload;
}

function publishStockEvents({ action, item, quantity, clientId, stock, origin }) {
  publish({
    event: action,
    item,
    quantity,
    clientId,
    stock,
    origin
  });

  publish({
    event: "stock_update",
    item,
    stock,
    origin
  });

  if (stock === 0) {
    publish({
      event: "out_of_stock",
      item,
      stock,
      origin
    });
  } else if (stock <= LOW_STOCK_THRESHOLD) {
    publish({
      event: "low_stock",
      item,
      stock,
      origin
    });
  }
}

function validationError(message) {
  return {
    status: 400,
    body: { success: false, message }
  };
}

function notFound(item) {
  return {
    status: 404,
    body: {
      success: false,
      item,
      message: `Item '${item}' nao encontrado`
    }
  };
}

function purchase({ item, quantity, clientId, origin }) {
  const name = normalizeItemName(item);
  const amount = parseQuantity(quantity);

  if (!name) {
    return validationError("Campo 'item' e obrigatorio");
  }
  if (amount === null) {
    return validationError("Campo 'quantity' deve ser um inteiro positivo");
  }
  if (!items.has(name)) {
    return notFound(name);
  }

  const current = items.get(name);
  if (current < amount) {
    return {
      status: 409,
      body: {
        success: false,
        item: name,
        requested: amount,
        remaining: current,
        message: `Estoque insuficiente para '${name}'`
      }
    };
  }

  const remaining = current - amount;
  items.set(name, remaining);
  publishStockEvents({
    action: "purchase",
    item: name,
    quantity: amount,
    clientId,
    stock: remaining,
    origin
  });

  return {
    status: 200,
    body: {
      success: true,
      item: name,
      quantity: amount,
      clientId,
      remaining,
      message: "Compra/reserva realizada"
    }
  };
}

function cancel({ item, quantity, clientId, origin }) {
  const name = normalizeItemName(item);
  const amount = parseQuantity(quantity);

  if (!name) {
    return validationError("Campo 'item' e obrigatorio");
  }
  if (amount === null) {
    return validationError("Campo 'quantity' deve ser um inteiro positivo");
  }
  if (!items.has(name)) {
    return notFound(name);
  }

  const remaining = items.get(name) + amount;
  items.set(name, remaining);
  publishStockEvents({
    action: "cancel",
    item: name,
    quantity: amount,
    clientId,
    stock: remaining,
    origin
  });

  return {
    status: 200,
    body: {
      success: true,
      item: name,
      quantity: amount,
      clientId,
      remaining,
      message: "Cancelamento/devolucao realizado"
    }
  };
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: SERVICE,
    sharedState: "in-memory inventory protected by local mutation queue"
  });
});

app.get("/items", (_req, res) => {
  res.json({ items: allItemsSnapshot() });
});

app.get("/items/:item", (req, res) => {
  const name = normalizeItemName(req.params.item);
  if (!items.has(name)) {
    const error = notFound(name);
    res.status(error.status).json(error.body);
    return;
  }

  res.json({ item: itemSnapshot(name) });
});

app.post("/purchase", async (req, res) => {
  const result = await withMutationLock(() => purchase(req.body));
  res.status(result.status).json(result.body);
});

app.post("/cancel", async (req, res) => {
  const result = await withMutationLock(() => cancel(req.body));
  res.status(result.status).json(result.body);
});

app.get("/events", (req, res) => {
  res.writeHead(200, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
    "x-accel-buffering": "no"
  });
  res.write(
    `event: ready\ndata: ${JSON.stringify({
      event: "ready",
      service: SERVICE,
      timestamp: new Date().toISOString()
    })}\n\n`
  );

  eventClients.add(res);
  req.on("close", () => {
    eventClients.delete(res);
  });
});

app.listen(PORT, "0.0.0.0", () => {
  log(SERVICE, `listening on ${PORT}`);
});
