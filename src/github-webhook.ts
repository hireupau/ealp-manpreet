import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type PullRequestEvent = {
  action: string;
  number: number;
  title: string;
  author: string;
  htmlUrl: string;
};

const pullRequestPayloadSchema = z.object({
  action: z.string(),
  repository: z.object({
    full_name: z.string(),
  }),
  pull_request: z.object({
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    user: z.object({ login: z.string() }).optional(),
  }),
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

export function pullRequestEventFromPayload(payload: unknown, expectedRepo: string): PullRequestEvent | undefined {
  const parsed = pullRequestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return undefined;
  }

  const body = parsed.data;
  if (body.repository.full_name !== expectedRepo) {
    return undefined;
  }

  return {
    action: body.action,
    number: body.pull_request.number,
    title: body.pull_request.title,
    author: body.pull_request.user?.login ?? "",
    htmlUrl: body.pull_request.html_url,
  };
}
