import { Hono } from "hono";

export type ChatInvoker = (message: string) => Promise<string>;

const optionalConfig = [
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "LLM_MODEL",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "SMEE_URL",
] as const;

export function createApp(options: { invoke: ChatInvoker }) {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({
      ok: true,
      agentMode: process.env.AGENT_MODE ?? null,
      missingConfig: optionalConfig.filter((key) => !process.env[key]),
    }),
  );

  app.post("/chat", async (c) => {
    const body = await c.req.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }

    const reply = await options.invoke(message);
    return c.json({ reply });
  });

  return app;
}
