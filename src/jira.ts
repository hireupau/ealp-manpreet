import { z } from "zod";

const jiraEnvSchema = z.object({
  JIRA_EMAIL: z.string().min(1),
  JIRA_API_TOKEN: z.string().min(1),
  JIRA_CLOUD_ID: z.string().min(1),
});

const jiraIssueResponseSchema = z.object({
  key: z.string(),
  fields: z.object({
    summary: z.string(),
    status: z.object({
      name: z.string(),
    }),
  }),
});

const jiraTransitionsResponseSchema = z.object({
  transitions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      to: z.object({ name: z.string() }).optional(),
    }),
  ),
});

export type JiraIssue = {
  key: string;
  summary: string;
  status: string;
};

export type JiraClient = {
  getIssue: (key: string) => Promise<JiraIssue>;
  transitionIssue: (key: string, statusName: string) => Promise<void>;
};

export function createJiraClient(env: NodeJS.ProcessEnv = process.env): JiraClient {
  const { JIRA_EMAIL: email, JIRA_API_TOKEN: token, JIRA_CLOUD_ID: cloudId } = jiraEnvSchema.parse(env);

  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  const authorization = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Jira ${init?.method ?? "GET"} ${path} failed (${response.status}): ${body}`);
    }

    return response;
  }

  async function getIssue(key: string): Promise<JiraIssue> {
    const response = await request(`/issue/${encodeURIComponent(key)}?fields=summary,status`);
    const data = jiraIssueResponseSchema.parse(await response.json());

    return {
      key: data.key,
      summary: data.fields.summary,
      status: data.fields.status.name,
    };
  }

  async function transitionIssue(key: string, statusName: string): Promise<void> {
    const encodedKey = encodeURIComponent(key);
    const response = await request(`/issue/${encodedKey}/transitions`);
    const { transitions } = jiraTransitionsResponseSchema.parse(await response.json());
    const wanted = statusName.toLowerCase();
    const match = transitions.find((transition) => {
      const toName = transition.to?.name ?? transition.name;
      return toName.toLowerCase() === wanted || transition.name.toLowerCase() === wanted;
    });

    if (!match) {
      const offered = transitions
        .map((transition) => transition.to?.name ?? transition.name)
        .join(", ");
      throw new Error(
        `No Jira transition to "${statusName}" for ${key}. Available: ${offered || "(none)"}`,
      );
    }

    await request(`/issue/${encodedKey}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: match.id } }),
    });
  }

  return { getIssue, transitionIssue };
}
