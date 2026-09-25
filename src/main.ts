import { serve } from "@hono/node-server";
import { createLmStudioAgent } from "./agent.js";
import { createApp } from "./app.js";
import { replyText } from "./reply.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer, received "${process.env.PORT}"`);
}

const agent = createLmStudioAgent();

const app = createApp({
  invoke: async (message) => replyText((await agent.invoke(message)).lastMessage),
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
