import { Agent } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";

export function createLmStudioAgent(env: NodeJS.ProcessEnv = process.env): Agent {
  const modelId = env.LLM_MODEL;
  const baseURL = env.LLM_BASE_URL;
  const apiKey = env.LLM_API_KEY;

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
  });

  return new Agent({
    model: model,
    systemPrompt: "You are a helpful assistant.",
    printer: false,
  })
}