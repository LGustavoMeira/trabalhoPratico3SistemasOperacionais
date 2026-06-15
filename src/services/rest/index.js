import express from "express";
import { DOMAIN_URL, getPort } from "../../lib/config.js";
import { domainFetch, sendDomainError } from "../../lib/http.js";
import { log } from "../../lib/logger.js";

const SERVICE = "rest";
const PORT = getPort("PORT", 8080);

const app = express();
app.use(express.json());

function withOrigin(body) {
  return {
    ...body,
    origin: "rest"
  };
}

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

app.get("/items", async (_req, res) => {
  try {
    res.json(await domainFetch("/items", { baseUrl: DOMAIN_URL }));
  } catch (error) {
    sendDomainError(res, error);
  }
});

app.get("/items/:item", async (req, res) => {
  try {
    const item = encodeURIComponent(req.params.item);
    res.json(await domainFetch(`/items/${item}`, { baseUrl: DOMAIN_URL }));
  } catch (error) {
    sendDomainError(res, error);
  }
});

app.post("/purchase", async (req, res) => {
  try {
    res.json(
      await domainFetch("/purchase", {
        baseUrl: DOMAIN_URL,
        method: "POST",
        body: JSON.stringify(withOrigin(req.body))
      })
    );
  } catch (error) {
    sendDomainError(res, error);
  }
});

app.post("/cancel", async (req, res) => {
  try {
    res.json(
      await domainFetch("/cancel", {
        baseUrl: DOMAIN_URL,
        method: "POST",
        body: JSON.stringify(withOrigin(req.body))
      })
    );
  } catch (error) {
    sendDomainError(res, error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  log(SERVICE, `listening on ${PORT}; domain=${DOMAIN_URL}`);
});
