export function getEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

export function getPort(name, fallback) {
  const value = Number.parseInt(getEnv(name, String(fallback)), 10);
  if (Number.isNaN(value) || value <= 0) {
    return fallback;
  }
  return value;
}

export const DOMAIN_URL = getEnv("DOMAIN_URL", "http://localhost:7000");
