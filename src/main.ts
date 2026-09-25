import { serve } from "@hono/node-server";
import { createLmStudioAgent } from "./agent.js";
import { createApp } from "./app.js";
import { replyText } from "./reply.js";
import { createAndStartSmeeClient } from "./smee.js";

const port = Number(process.env.PORT ?? 3000);
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
const githubRepo = process.env.GITHUB_REPO;

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer, received "${process.env.PORT}"`);
}

if (!webhookSecret) {
  throw new Error("GITHUB_WEBHOOK_SECRET is required");
}

if (!githubRepo) {
  throw new Error("GITHUB_REPO is required");
}

const agent = createLmStudioAgent();

const app = createApp({
  invoke: async (message) => replyText((await agent.invoke(message)).lastMessage),
  webhookSecret,
  githubRepo,
  onPullRequest: (event) => {
    console.log(
      `Pull request ${event.action}: #${event.number} ${event.title} by ${event.author} (${event.htmlUrl})`,
    );
  },
});

let smee: ReturnType<typeof createAndStartSmeeClient>;

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
  smee = createAndStartSmeeClient(info);
});

async function shutdown() {
  await smee?.stop();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
