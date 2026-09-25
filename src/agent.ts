import { Agent, tool } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod";
import type { GitHubEventSummary } from "./github-webhook.js";
import { createJiraClient } from "./jira.js";
import { replyText } from "./reply.js";

const webhookSystemPrompt = `You receive a JSON summary of a GitHub webhook.

If this is not a pull request, do nothing. Do not call any tool.

If it is a pull request, look in the title, body, and branch name for a Jira issue key (for example EALP-12).
- action "opened" or "reopened": transition that issue to "In Review"
- action "closed" and merged is true: transition that issue to "Done"
- any other action, or no issue key: do nothing

Use the transition_jira_issue tool when you should change Jira. Do not invent issue keys.`;

const transitionJiraIssueTool = tool({
  name: "transition_jira_issue",
  description: "Transition a Jira issue to a named status",
  inputSchema: z.object({
    key: z.string().describe("Jira issue key, example EALP-19"),
    statusName: z.string().describe('Target status name, for example "In Review" or "Done"'),
  }),
  callback: async ({ key, statusName }) => {
    try {
      const jira = createJiraClient();
      await jira.transitionIssue(key, statusName);
      await jira.addComment(
        key,
        `Transitioned to "${statusName}" by the AI agent from a GitHub pull request event. This was not a human change.`,
      );
      return `Transitioned ${key} to ${statusName}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("transition_jira_issue failed", error);
      return message;
    }
  }
})

export function createLmStudioAgent(env: NodeJS.ProcessEnv = process.env): Agent {
  return createAgent({
    env,
    systemPrompt: "You are a helpful assistant that helps transitioning Jira tickets based on the Pull Request status in GitHub.",
  });
}

function createWebhookAgent(env: NodeJS.ProcessEnv = process.env): Agent {
  return createAgent({
    env,
    systemPrompt: webhookSystemPrompt,
    tools: [transitionJiraIssueTool],
  });
}

function createAgent(options: {
  env: NodeJS.ProcessEnv;
  systemPrompt: string;
  tools?: Agent["tools"];
}): Agent {
  const modelId = options.env.LLM_MODEL;
  const baseURL = options.env.LLM_BASE_URL;
  const apiKey = options.env.LLM_API_KEY;

  if (!modelId) {
    throw new Error("LLM_MODEL is required");
  }

  if (!baseURL) {
    throw new Error("LLM_BASE_URL is required");
  }

  if (!apiKey) {
    throw new Error("LLM_API_KEY is required");
  }

  const model = new OpenAIModel({
    api: "chat",
    modelId: modelId,
    apiKey: apiKey,
    clientConfig: { baseURL },
    temperature: 0.7,
  });

  return new Agent({
    model,
    systemPrompt: options.systemPrompt,
    tools: options.tools,
    printer: false,
  });
}

export async function handleGitHubEvent(summary: GitHubEventSummary): Promise<void> {
  const agent = createWebhookAgent();
  const result = await agent.invoke(JSON.stringify(summary, null, 2));
  console.log(`GitHub ${summary.eventName}: ${replyText(result.lastMessage)}`);
}
