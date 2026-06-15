import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { DOMAIN_URL, getPort } from "../../lib/config.js";
import { DomainError, domainFetch } from "../../lib/http.js";
import { log, logError } from "../../lib/logger.js";

const SERVICE = "grpc";
const GRPC_PORT = getPort("GRPC_PORT", 50051);
const PROTO_PATH = path.resolve("proto/inventory.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  defaults: true,
  enums: String,
  longs: String,
  oneofs: true
});
const inventoryProto = grpc.loadPackageDefinition(packageDefinition).inventory;

function asGrpcUnavailable(error) {
  return {
    code: grpc.status.UNAVAILABLE,
    message: error.message || "Servico central de dominio indisponivel"
  };
}

async function listItems(_call, callback) {
  try {
    const result = await domainFetch("/items", { baseUrl: DOMAIN_URL });
    callback(null, { items: result.items });
  } catch (error) {
    logError(SERVICE, "ListItems failed", error);
    callback(asGrpcUnavailable(error));
  }
}

async function getItem(call, callback) {
  const name = call.request.item;

  try {
    const result = await domainFetch(`/items/${encodeURIComponent(name)}`, {
      baseUrl: DOMAIN_URL
    });
    callback(null, {
      found: true,
      item: result.item,
      message: "Item encontrado"
    });
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) {
      callback(null, {
        found: false,
        item: { name, stock: 0 },
        message: error.payload?.message ?? "Item nao encontrado"
      });
      return;
    }

    logError(SERVICE, "GetItem failed", error);
    callback(asGrpcUnavailable(error));
  }
}

async function mutate(pathname, request, callback) {
  try {
    const result = await domainFetch(pathname, {
      baseUrl: DOMAIN_URL,
      method: "POST",
      body: JSON.stringify({
        item: request.item,
        quantity: request.quantity,
        clientId: request.clientId,
        origin: "grpc"
      })
    });

    callback(null, {
      success: result.success,
      item: result.item,
      remaining: result.remaining,
      message: result.message
    });
  } catch (error) {
    if (error instanceof DomainError) {
      callback(null, {
        success: false,
        item: error.payload?.item ?? request.item,
        remaining: error.payload?.remaining ?? 0,
        message: error.payload?.message ?? error.message
      });
      return;
    }

    logError(SERVICE, `${pathname} failed`, error);
    callback(asGrpcUnavailable(error));
  }
}

function purchase(call, callback) {
  mutate("/purchase", call.request, callback);
}

function cancel(call, callback) {
  mutate("/cancel", call.request, callback);
}

const server = new grpc.Server();
server.addService(inventoryProto.InventoryService.service, {
  listItems,
  getItem,
  purchase,
  cancel
});

server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (error, boundPort) => {
    if (error) {
      logError(SERVICE, "failed to bind", error);
      process.exit(1);
    }

    log(SERVICE, `listening on ${boundPort}; domain=${DOMAIN_URL}`);
  }
);
