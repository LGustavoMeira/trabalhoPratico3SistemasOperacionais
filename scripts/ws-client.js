import { WebSocket } from "ws";

const url = process.env.WS_URL ?? "ws://localhost:8081/ws";
const timeoutMs = Number.parseInt(process.env.WS_CLIENT_TIMEOUT_MS ?? "30000", 10);
const socket = new WebSocket(url);

socket.on("open", () => {
  console.log(`Connected to ${url}`);
  socket.send(JSON.stringify({ type: "list_items" }));
});

socket.on("message", (message) => {
  console.log(message.toString());
});

socket.on("error", (error) => {
  console.error(error);
});

if (timeoutMs > 0) {
  setTimeout(() => {
    socket.close();
  }, timeoutMs);
}
