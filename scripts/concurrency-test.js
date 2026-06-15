const REST_URL = process.env.REST_URL ?? "http://localhost:8080";
const ITEM = process.env.ITEM ?? "monitor";

async function request(path, options = {}) {
  const response = await fetch(`${REST_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const payload = await response.json();
  return {
    status: response.status,
    payload
  };
}

async function stockOf(item) {
  const response = await request(`/items/${encodeURIComponent(item)}`);
  if (response.status !== 200) {
    throw new Error(response.payload.message ?? `Item ${item} indisponivel`);
  }
  return response.payload.item.stock;
}

async function normalizeToOneUnit(item) {
  let stock = await stockOf(item);

  if (stock <= 0) {
    await request("/cancel", {
      method: "POST",
      body: JSON.stringify({ item, quantity: 1 - stock, clientId: "setup-concurrency" })
    });
    stock = await stockOf(item);
  }

  if (stock > 1) {
    await request("/purchase", {
      method: "POST",
      body: JSON.stringify({
        item,
        quantity: stock - 1,
        clientId: "setup-concurrency"
      })
    });
  }
}

async function main() {
  console.log(`REST_URL=${REST_URL}`);
  console.log(`Preparando '${ITEM}' com estoque 1...`);
  await normalizeToOneUnit(ITEM);
  console.log("Estoque antes:", await stockOf(ITEM));

  const attempts = await Promise.all([
    request("/purchase", {
      method: "POST",
      body: JSON.stringify({ item: ITEM, quantity: 1, clientId: "corrida-a" })
    }),
    request("/purchase", {
      method: "POST",
      body: JSON.stringify({ item: ITEM, quantity: 1, clientId: "corrida-b" })
    })
  ]);

  console.log("Resultado das duas compras concorrentes:");
  console.log(JSON.stringify(attempts, null, 2));
  console.log("Estoque depois:", await stockOf(ITEM));
  console.log("Esperado: uma compra 200/success=true e uma 409/success=false.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
