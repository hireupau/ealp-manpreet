import { Hono } from "hono";
import { githubEventSummaryFromPayload, verifyGitHubSignature, type GitHubEventSummary } from "./github-webhook.js";

export type ChatInvoker = (message: string) => Promise<string>;
export type { GitHubEventSummary };

const optionalConfig = [
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "LLM_MODEL",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "SMEE_URL",
] as const;

export function createApp(options: {
  invoke: ChatInvoker;
  webhookSecret: string;
  githubRepo: string;
  authorFilter?: string;
  onGitHubEvent: (summary: GitHubEventSummary) => void | Promise<void>;
}) {
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

  app.post("/webhooks/github", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256");

    if (!verifyGitHubSignature(rawBody, signature, options.webhookSecret)) {
      return c.json({ error: "Invalid GitHub Signature" }, 401);
    }

    const eventName = c.req.header("x-github-event") ?? "";
    if (eventName === "ping") {
      return c.json({ ok: true });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ ok: true });
    }

    const summary = githubEventSummaryFromPayload(
      payload,
      eventName,
      options.githubRepo,
      options.authorFilter,
    );
    if (summary) {
      void Promise.resolve(options.onGitHubEvent(summary)).catch((error: unknown) => {
        console.error("GitHub event handler failed", error);
      });
    }

    return c.json({ ok: true });
  });

  return app;
}
