export type JiraIssue = {
  key: string;
  summary: string;
  status: string;
};

export type JiraClient = {
  getIssue: (key: string) => Promise<JiraIssue>;
  transitionIssue: (key: string, statusName: string) => Promise<void>;
};

type JiraTransition = {
  id: string;
  name: string;
  to?: { name?: string };
};

export function createJiraClient(env: NodeJS.ProcessEnv = process.env): JiraClient {
  const email = env.JIRA_EMAIL;
  const token = env.JIRA_API_TOKEN;
  const cloudId = env.JIRA_CLOUD_ID;

  if (!email) {
    throw new Error("JIRA_EMAIL is required");
  }
  if (!token) {
    throw new Error("JIRA_API_TOKEN is required");
  }
  if (!cloudId) {
    throw new Error("JIRA_CLOUD_ID is required");
  }

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
    const data = (await response.json()) as {
      key?: string;
      fields?: { summary?: string; status?: { name?: string } };
    };

    if (!data.key || !data.fields?.summary || !data.fields.status?.name) {
      throw new Error(`Jira issue ${key} was missing key, summary, or status`);
    }

    return {
      key: data.key,
      summary: data.fields.summary,
      status: data.fields.status.name,
    };
  }

  async function transitionIssue(key: string, statusName: string): Promise<void> {
    const encodedKey = encodeURIComponent(key);
    const response = await request(`/issue/${encodedKey}/transitions`);
    const data = (await response.json()) as { transitions?: JiraTransition[] };
    const transitions = data.transitions ?? [];
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
