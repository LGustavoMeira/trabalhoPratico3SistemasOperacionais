import express from "express";
import { buildSchema } from "graphql";
import { createHandler } from "graphql-http/lib/use/express";
import { DOMAIN_URL, getPort } from "../../lib/config.js";
import { DomainError, domainFetch, sendDomainError } from "../../lib/http.js";
import { log } from "../../lib/logger.js";

const SERVICE = "graphql";
const PORT = getPort("PORT", 8082);

const schema = buildSchema(`
  type Item {
    name: String!
    stock: Int!
  }

  type OperationResult {
    success: Boolean!
    item: String!
    quantity: Int
    clientId: String
    remaining: Int!
    message: String!
  }

  type Query {
    items: [Item!]!
    item(name: String!): Item
  }

  type Mutation {
    purchase(item: String!, quantity: Int!, clientId: String!): OperationResult!
    cancel(item: String!, quantity: Int!, clientId: String!): OperationResult!
  }
`);

async function mutate(path, args) {
  try {
    const result = await domainFetch(path, {
      baseUrl: DOMAIN_URL,
      method: "POST",
      body: JSON.stringify({
        ...args,
        origin: "graphql"
      })
    });

    return {
      success: result.success,
      item: result.item,
      quantity: result.quantity,
      clientId: result.clientId,
      remaining: result.remaining,
      message: result.message
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        success: false,
        item: error.payload?.item ?? args.item,
        quantity: args.quantity,
        clientId: args.clientId,
        remaining: error.payload?.remaining ?? 0,
        message: error.payload?.message ?? error.message
      };
    }

    throw error;
  }
}

const rootValue = {
  async items() {
    const result = await domainFetch("/items", { baseUrl: DOMAIN_URL });
    return result.items;
  },

  async item({ name }) {
    try {
      const result = await domainFetch(`/items/${encodeURIComponent(name)}`, {
        baseUrl: DOMAIN_URL
      });
      return result.item;
    } catch (error) {
      if (error instanceof DomainError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  purchase(args) {
    return mutate("/purchase", args);
  },

  cancel(args) {
    return mutate("/cancel", args);
  }
};

const app = express();

app.get("/health", async (_req, res) => {
  try {
    const domain = await domainFetch("/health", { baseUrl: DOMAIN_URL });
    res.json({
      status: "ok",
      service: SERVICE,
      domain
    });
  } catch (error) {
    sendDomainError(res, error);
  }
});

app.get("/", (_req, res) => {
  res.json({
    service: SERVICE,
    endpoint: "/graphql",
    example: "{ items { name stock } }"
  });
});

app.all(
  "/graphql",
  createHandler({
    schema,
    rootValue
  })
);

app.listen(PORT, "0.0.0.0", () => {
  log(SERVICE, `listening on ${PORT}; domain=${DOMAIN_URL}`);
});
