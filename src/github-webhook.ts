import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type GitHubEventSummary = {
  eventName: string;
  action?: string;
  repository?: string;
  pullRequest?: {
    number: number;
    title: string;
    body: string | null;
    author: string;
    htmlUrl: string;
    merged?: boolean;
    branch?: string;
  };
};

const githubWebhookPayloadSchema = z.object({
  action: z.string().optional(),
  repository: z
    .object({
      full_name: z.string(),
    })
    .optional(),
  pull_request: z
    .object({
      number: z.number(),
      title: z.string(),
      html_url: z.string(),
      body: z.string().nullable().optional(),
      merged: z.boolean().optional(),
      user: z.object({ login: z.string() }).optional(),
      head: z.object({ ref: z.string() }).optional(),
    })
    .optional(),
});

export function verifyGitHubSignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function githubEventSummaryFromPayload(
  payload: unknown,
  eventName: string,
  expectedRepo: string,
  authorFilter?: string,
): GitHubEventSummary | undefined {
  const parsed = githubWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { eventName };
  }

  const body = parsed.data;
  const repository = body.repository?.full_name;
  if (repository && repository !== expectedRepo) {
    return undefined;
  }

  const pullRequest = body.pull_request
    ? {
        number: body.pull_request.number,
        title: body.pull_request.title,
        body: body.pull_request.body ?? null,
        author: body.pull_request.user?.login ?? "",
        htmlUrl: body.pull_request.html_url,
        merged: body.pull_request.merged,
        branch: body.pull_request.head?.ref,
      }
    : undefined;

  const allowedAuthors = authorFilter
    ?.split(",")
    .map((login) => login.trim())
    .filter(Boolean);

  if (allowedAuthors?.length && pullRequest && !allowedAuthors.includes(pullRequest.author)) {
    return undefined;
  }

  return {
    eventName,
    action: body.action,
    repository,
    pullRequest,
  };
}
