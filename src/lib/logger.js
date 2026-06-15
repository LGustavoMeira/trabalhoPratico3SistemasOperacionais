export function log(service, message, details) {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  console.log(`[${new Date().toISOString()}] [${service}] ${message}${suffix}`);
}

export function logError(service, message, error) {
  console.error(`[${new Date().toISOString()}] [${service}] ${message}`, error);
}
