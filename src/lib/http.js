export class DomainError extends Error {
  constructor(status, payload) {
    super(payload?.message || `Domain request failed with status ${status}`);
    this.name = "DomainError";
    this.status = status;
    this.payload = payload;
  }
}

export async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function domainFetch(path, options = {}) {
  const baseUrl = options.baseUrl ?? process.env.DOMAIN_URL ?? "http://localhost:7000";
  const headers = {
    "content-type": "application/json",
    ...(options.headers ?? {})
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new DomainError(response.status, payload);
  }

  return payload;
}

export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export function sendDomainError(res, error) {
  if (error instanceof DomainError) {
    sendJson(res, error.status, error.payload ?? { success: false, message: error.message });
    return;
  }

  console.error(error);
  sendJson(res, 502, {
    success: false,
    message: "Falha ao comunicar com o servico central de dominio"
  });
}
