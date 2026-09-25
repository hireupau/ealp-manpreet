import { createHmac, timingSafeEqual } from "node:crypto";

export type PullRequestEvent = {
  action: string;
  number: number;
  title: string;
  author: string;
  htmlUrl: string;
};

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
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const body = payload as Record<string, unknown>;
  const repository = body.repository;
  const pullRequest = body.pull_request;

  if (!repository || typeof repository !== "object" || !pullRequest || typeof pullRequest !== "object") {
    return undefined;
  }

  const fullName = (repository as Record<string, unknown>).full_name;
  if (fullName !== expectedRepo) {
    return undefined;
  }

  const pr = pullRequest as Record<string, unknown>;
  const user = pr.user;
  const author =
    user && typeof user === "object" && typeof (user as Record<string, unknown>).login === "string"
      ? ((user as Record<string, unknown>).login as string)
      : "";

  if (
    typeof body.action !== "string" ||
    typeof pr.number !== "number" ||
    typeof pr.title !== "string" ||
    typeof pr.html_url !== "string"
  ) {
    return undefined;
  }

  return {
    action: body.action,
    number: pr.number,
    title: pr.title,
    author,
    htmlUrl: pr.html_url,
  };
}
