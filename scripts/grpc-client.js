import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";

const target = process.env.GRPC_TARGET ?? "localhost:50051";
const protoPath = path.resolve("proto/inventory.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  defaults: true,
  enums: String,
  longs: String,
  oneofs: true
});
const inventoryProto = grpc.loadPackageDefinition(packageDefinition).inventory;
const client = new inventoryProto.InventoryService(target, grpc.credentials.createInsecure());

function lowerFirst(value) {
  return `${value[0].toLowerCase()}${value.slice(1)}`;
}

function unary(method, request) {
  const fn = client[lowerFirst(method)] ?? client[method];
  if (typeof fn !== "function") {
    throw new Error(`Metodo gRPC nao encontrado: ${method}`);
  }

  return new Promise((resolve, reject) => {
    fn.call(client, request, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

async function main() {
  console.log(`gRPC target: ${target}`);
  console.log("ListItems:", await unary("ListItems", {}));
  console.log(
    "Purchase:",
    await unary("Purchase", {
      item: "monitor",
      quantity: 1,
      clientId: "cli-grpc"
    })
  );
  console.log("GetItem:", await unary("GetItem", { item: "monitor" }));
  console.log(
    "Cancel:",
    await unary("Cancel", {
      item: "monitor",
      quantity: 1,
      clientId: "cli-grpc"
    })
  );
  client.close();
}

main().catch((error) => {
  console.error(error);
  client.close();
  process.exit(1);
});
